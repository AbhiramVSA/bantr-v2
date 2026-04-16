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
async def test_start_debate_compensates_room_and_commits_failed(monkeypatch):
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

    db = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
    debate = SimpleNamespace(
        id="debate-1",
        status="pending",
        livekit_room_name="room-1",
        ended_at=None,
    )

    with pytest.raises(AppError) as exc:
        await debate_service.start_debate(db, debate, user_id="user-1")

    assert exc.value.code == "ROOM_START_FAILED"
    assert debate.status == "failed"
    assert db.commit.await_count == 1
    assert delete_room.await_count == 1


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

    monkeypatch.setattr(
        analysis_service, "_generate_analysis_output", fake_generate_output
    )
    monkeypatch.setattr(analysis_service, "get_analysis_by_debate_id", fake_get_analysis)
    monkeypatch.setattr(
        analysis_service, "get_transcript_by_debate_id", fake_get_transcript
    )
    monkeypatch.setattr(analysis_service, "create_debate_analysis", fake_create_analysis)
    monkeypatch.setattr(analysis_service, "embed_transcript", fake_embed_transcript)

    result = await analysis_service.analyze_debate(db, debate)
    assert result is analysis_obj


@pytest.mark.asyncio
async def test_reconcile_stale_debates_marks_failed():
    stale1 = SimpleNamespace(id="debate-1", status="starting", ended_at=None)
    stale2 = SimpleNamespace(id="debate-2", status="ending", ended_at=None)
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _Result([stale1, stale2]),
                _Result([("debate-1",)]),
            ]
        ),
        flush=AsyncMock(),
    )

    updated = await debate_reconciler.reconcile_stale_debates(
        db, stale_after_seconds=30
    )

    assert updated == 2
    assert stale1.status == "completed"
    assert stale2.status == "failed"
    assert stale1.ended_at is not None
    assert stale2.ended_at is not None
    assert db.flush.await_count == 1
