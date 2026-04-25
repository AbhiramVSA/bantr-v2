from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.errors import AppError
from app.services import analysis_service, debate_reconciler, debate_service


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


@pytest.mark.asyncio
async def test_start_debate_failure_resets_to_pending(monkeypatch):
    delete_room = AsyncMock()

    class FakeAPI:
        def __init__(self, **_kwargs):
            self.room = SimpleNamespace(
                create_room=AsyncMock(return_value=None),
                delete_room=delete_room,
            )
            self.agent_dispatch = SimpleNamespace(
                create_dispatch=AsyncMock(side_effect=RuntimeError("dispatch failed"))
            )

        async def aclose(self):
            return None

    monkeypatch.setattr(debate_service, "LiveKitAPI", FakeAPI)

    db = SimpleNamespace(flush=AsyncMock())
    debate = SimpleNamespace(
        id="debate-1",
        status="pending",
        livekit_room_name="room-1",
        started_at=None,
        ended_at=None,
    )

    with pytest.raises(AppError) as exc:
        await debate_service.start_debate(db, debate, user_id="user-1")

    assert exc.value.code == "ROOM_START_FAILED"
    assert debate.status == "pending"
    assert delete_room.await_count == 1


@pytest.mark.asyncio
async def test_start_debate_recovers_inconsistent_active_room(monkeypatch):
    create_room = AsyncMock(return_value=None)
    create_dispatch = AsyncMock(return_value=SimpleNamespace(id="dispatch-1"))

    class FakeAPI:
        def __init__(self, **_kwargs):
            self.room = SimpleNamespace(
                list_rooms=AsyncMock(return_value=SimpleNamespace(rooms=[])),
                create_room=create_room,
                delete_room=AsyncMock(return_value=None),
            )
            self.agent_dispatch = SimpleNamespace(
                list_dispatch=AsyncMock(return_value=[]),
                create_dispatch=create_dispatch,
            )

        async def aclose(self):
            return None

    monkeypatch.setattr(debate_service, "LiveKitAPI", FakeAPI)

    db = SimpleNamespace(flush=AsyncMock())
    debate = SimpleNamespace(
        id="debate-1",
        status="active",
        livekit_room_name="room-1",
        started_at=None,
        ended_at=None,
    )

    token, url = await debate_service.start_debate(db, debate, user_id="user-1")

    assert debate.status == "active"
    assert debate.started_at is not None
    assert create_room.await_count == 1
    assert create_dispatch.await_count == 1
    assert token
    assert url == debate_service.settings.LIVEKIT_URL


@pytest.mark.asyncio
async def test_end_debate_is_idempotent_for_terminal_and_ending_status(monkeypatch):
    class FailingAPI:
        def __init__(self, **_kwargs):
            raise AssertionError("LiveKitAPI should not be called")

    monkeypatch.setattr(debate_service, "LiveKitAPI", FailingAPI)
    db = SimpleNamespace(flush=AsyncMock())

    for status in ("ending", "completed", "failed"):
        debate = SimpleNamespace(status=status)
        await debate_service.end_debate(db, debate)


@pytest.mark.asyncio
async def test_analysis_persists_even_if_embedding_fails(monkeypatch):
    analysis_obj = SimpleNamespace(id="analysis-1")
    transcript_obj = SimpleNamespace(full_text="hello world")
    analysis_output = SimpleNamespace(
        argument_strength=SimpleNamespace(model_dump=lambda: {}),
        logical_fallacies=[],
        persuasiveness=SimpleNamespace(model_dump=lambda: {}),
        key_moments=[],
        improvement_areas=[],
        overall_summary="summary",
        winner="draw",
    )
    debate = SimpleNamespace(id="debate-1", status="completed")
    db = SimpleNamespace()

    async def fake_get_analysis(_db, _debate_id):
        return None

    async def fake_get_transcript(_db, _debate_id):
        return transcript_obj

    async def fake_create_analysis(_db, **_kwargs):
        return analysis_obj

    async def fake_embed_transcript(_db, _debate, _transcript):
        raise AppError("EMBEDDING_FAILED", "Embedding failed", status_code=502)

    async def fake_generate_output(_transcript_text: str):
        return analysis_output

    monkeypatch.setattr(analysis_service, "_generate_analysis_output", fake_generate_output)
    monkeypatch.setattr(analysis_service, "get_analysis_by_debate_id", fake_get_analysis)
    monkeypatch.setattr(analysis_service, "get_transcript_by_debate_id", fake_get_transcript)
    monkeypatch.setattr(analysis_service, "create_debate_analysis", fake_create_analysis)
    monkeypatch.setattr(analysis_service, "embed_transcript", fake_embed_transcript)

    result = await analysis_service.analyze_debate(db, debate)
    assert result is analysis_obj


@pytest.mark.asyncio
async def test_reconcile_stale_debates_resets_starting_and_ends_active(monkeypatch):
    cleanup_room = AsyncMock(return_value=None)
    monkeypatch.setattr(debate_reconciler, "delete_livekit_room", cleanup_room)
    monkeypatch.setattr(
        debate_reconciler,
        "_get_room_state",
        AsyncMock(return_value={"room_exists": True, "has_human_participant": False}),
    )
    monkeypatch.setattr(
        debate_reconciler,
        "LiveKitAPI",
        lambda **_kwargs: SimpleNamespace(aclose=AsyncMock(return_value=None)),
    )

    stale1 = SimpleNamespace(
        id="debate-1",
        status="starting",
        ended_at=None,
        started_at=None,
        updated_at=None,
        livekit_room_name="room-1",
    )
    stale2 = SimpleNamespace(
        id="debate-2",
        status="ending",
        ended_at=None,
        started_at=None,
        updated_at=None,
        livekit_room_name="room-2",
    )
    stale3 = SimpleNamespace(
        id="debate-3",
        status="active",
        ended_at=None,
        started_at=None,
        updated_at=None,
        livekit_room_name="room-3",
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _Result([stale1, stale2, stale3]),
                _Result([]),
            ]
        ),
        flush=AsyncMock(),
    )

    updated = await debate_reconciler.reconcile_stale_debates(
        db, stale_after_seconds=30, empty_room_seconds=60, active_max_seconds=300
    )

    assert updated == 3
    assert stale1.status == "pending"
    assert stale2.status == "failed"
    assert stale3.status == "ending"
    assert stale1.ended_at is None
    assert stale2.ended_at is not None
    assert stale3.ended_at is not None
    assert cleanup_room.await_count == 2
    assert db.flush.await_count == 1


@pytest.mark.asyncio
async def test_reconcile_active_debate_with_human_participant_skips_end(monkeypatch):
    cleanup_room = AsyncMock(return_value=None)
    monkeypatch.setattr(debate_reconciler, "delete_livekit_room", cleanup_room)
    monkeypatch.setattr(
        debate_reconciler,
        "_get_room_state",
        AsyncMock(return_value={"room_exists": True, "has_human_participant": True}),
    )
    monkeypatch.setattr(
        debate_reconciler,
        "LiveKitAPI",
        lambda **_kwargs: SimpleNamespace(aclose=AsyncMock(return_value=None)),
    )

    active = SimpleNamespace(
        id="debate-1",
        status="active",
        ended_at=None,
        started_at=None,
        updated_at=datetime.now(timezone.utc),
        livekit_room_name="room-1",
    )
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_Result([active]), _Result([])]),
        flush=AsyncMock(),
    )

    updated = await debate_reconciler.reconcile_stale_debates(
        db, stale_after_seconds=30, empty_room_seconds=60, active_max_seconds=300
    )

    assert updated == 0
    assert active.status == "active"
    assert cleanup_room.await_count == 0
    assert db.flush.await_count == 0
