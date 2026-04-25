import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.api.deps import get_current_user, get_db, validate_csrf
from app.api.v1.api import api_router
from app.api.v1.routers import debates as debates_router
from app.core.config import settings
from app.core.errors import AppError


def _build_test_app() -> FastAPI:
    app = FastAPI()

    @app.exception_handler(AppError)
    async def app_error_handler(_request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request",
                    "details": exc.errors(),
                }
            },
        )

    app.include_router(api_router, prefix=settings.API_V1_STR)
    return app


def test_debate_route_flow_start_end_transcript_analyze(monkeypatch):
    app = _build_test_app()
    user_id = uuid.uuid4()
    debate_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(id=user_id)
    debate = SimpleNamespace(
        id=debate_id,
        user_id=user_id,
        status="pending",
        livekit_room_name="debate-test-room",
    )
    analysis_state = {"available": False}
    transcript = SimpleNamespace(
        id=uuid.uuid4(),
        debate_id=debate_id,
        full_text="[USER]: hello\n[AGENT]: hi",
        speaker_segments=[
            {"speaker": "user", "text": "hello"},
            {"speaker": "agent", "text": "hi"},
        ],
        created_at=now,
    )
    analysis = SimpleNamespace(
        id=uuid.uuid4(),
        debate_id=debate_id,
        argument_strength={},
        logical_fallacies=[],
        persuasiveness={},
        key_moments=[],
        improvement_areas=[],
        overall_summary="summary",
        winner="draw",
        created_at=now,
    )

    async def fake_get_db():
        yield SimpleNamespace(commit=AsyncMock(), flush=AsyncMock(), delete=AsyncMock())

    async def fake_get_current_user():
        return user

    async def fake_validate_csrf():
        return None

    async def fake_get_user_debate_for_update(_db, _debate_id, _user_id):
        return debate

    async def fake_get_user_debate(_db, _debate_id, _user_id):
        return debate

    async def fake_start_debate(_db, _debate, _user_id):
        debate.status = "active"
        return "token-1", "wss://example.livekit.cloud"

    async def fake_end_debate(_db, _debate):
        if debate.status == "active":
            debate.status = "ending"

    async def fake_get_transcript(_db, _debate_id):
        return transcript if debate.status in {"ending", "completed"} else None

    async def fake_analyze_debate(_db, _debate):
        analysis_state["available"] = True
        return analysis

    async def fake_get_analysis(_db, _debate_id):
        return analysis if analysis_state["available"] else None

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user
    app.dependency_overrides[validate_csrf] = fake_validate_csrf

    monkeypatch.setattr(
        debates_router, "get_user_debate_for_update", fake_get_user_debate_for_update
    )
    monkeypatch.setattr(debates_router, "get_user_debate", fake_get_user_debate)
    monkeypatch.setattr(debates_router, "start_debate", fake_start_debate)
    monkeypatch.setattr(debates_router, "end_debate", fake_end_debate)
    monkeypatch.setattr(debates_router, "get_transcript_by_debate_id", fake_get_transcript)
    monkeypatch.setattr(debates_router, "analyze_debate", fake_analyze_debate)
    monkeypatch.setattr(debates_router, "get_analysis_by_debate_id", fake_get_analysis)
    monkeypatch.setattr(debates_router, "schedule_embedding", lambda _debate_id: None)

    with TestClient(app) as client:
        start_res = client.post(f"{settings.API_V1_STR}/debates/{debate_id}/start")
        assert start_res.status_code == 200
        assert start_res.json()["status"] == "active"

        end_res = client.post(f"{settings.API_V1_STR}/debates/{debate_id}/end")
        assert end_res.status_code == 200
        assert end_res.json()["status"] == "ending"

        end_retry_res = client.post(f"{settings.API_V1_STR}/debates/{debate_id}/end")
        assert end_retry_res.status_code == 200
        assert end_retry_res.json()["status"] == "ending"

        transcript_res = client.get(f"{settings.API_V1_STR}/debates/{debate_id}/transcript")
        assert transcript_res.status_code == 200
        assert transcript_res.json()["debate_id"] == str(debate_id)

        debate.status = "completed"
        analyze_res = client.post(f"{settings.API_V1_STR}/debates/{debate_id}/analyze")
        assert analyze_res.status_code == 201
        assert analyze_res.json()["winner"] == "draw"

        analysis_res = client.get(f"{settings.API_V1_STR}/debates/{debate_id}/analysis")
        assert analysis_res.status_code == 200
        assert analysis_res.json()["debate_id"] == str(debate_id)


def test_delete_rejects_non_terminal_debate(monkeypatch):
    app = _build_test_app()
    user_id = uuid.uuid4()
    debate_id = uuid.uuid4()
    user = SimpleNamespace(id=user_id)
    debate = SimpleNamespace(id=debate_id, user_id=user_id, status="active")

    async def fake_get_db():
        yield SimpleNamespace(commit=AsyncMock(), flush=AsyncMock(), delete=AsyncMock())

    async def fake_get_current_user():
        return user

    async def fake_validate_csrf():
        return None

    async def fake_get_user_debate(_db, _debate_id, _user_id):
        return debate

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user
    app.dependency_overrides[validate_csrf] = fake_validate_csrf
    monkeypatch.setattr(debates_router, "get_user_debate", fake_get_user_debate)

    with TestClient(app) as client:
        res = client.delete(f"{settings.API_V1_STR}/debates/{debate_id}")
        assert res.status_code == 409
        assert res.json()["error"]["code"] == "DEBATE_NOT_TERMINAL"


def test_list_debates_rejects_invalid_pagination():
    app = _build_test_app()
    user = SimpleNamespace(id=uuid.uuid4())

    async def fake_get_db():
        yield SimpleNamespace()

    async def fake_get_current_user():
        return user

    async def fake_validate_csrf():
        return None

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user
    app.dependency_overrides[validate_csrf] = fake_validate_csrf

    with TestClient(app) as client:
        negative_skip = client.get(f"{settings.API_V1_STR}/debates?skip=-1")
        oversized_limit = client.get(f"{settings.API_V1_STR}/debates?limit=101")

    assert negative_skip.status_code == 422
    assert negative_skip.json()["error"]["code"] == "VALIDATION_ERROR"
    assert oversized_limit.status_code == 422
    assert oversized_limit.json()["error"]["code"] == "VALIDATION_ERROR"
