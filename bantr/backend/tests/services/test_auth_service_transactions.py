from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.errors import AuthError
from app.services import auth_service


@pytest.mark.asyncio
async def test_authenticate_user_commits_failed_login_audit(monkeypatch):
    db = SimpleNamespace(commit=AsyncMock())
    request = SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        headers={"user-agent": "pytest"},
    )

    monkeypatch.setattr(auth_service, "get_user_by_email", AsyncMock(return_value=None))
    monkeypatch.setattr(auth_service, "create_audit_log", AsyncMock(return_value=None))

    with pytest.raises(AuthError) as exc:
        await auth_service.authenticate_user(
            db,
            request,
            email="missing@example.com",
            password="bad-password",
        )

    assert exc.value.code == "INVALID_CREDENTIALS"
    assert db.commit.await_count == 1


@pytest.mark.asyncio
async def test_refresh_user_session_commits_token_reuse_audit(monkeypatch):
    db = SimpleNamespace(commit=AsyncMock())
    request = SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        headers={"user-agent": "pytest"},
        cookies={"refresh_token": "raw-refresh-token"},
    )
    response = SimpleNamespace()
    token_record = SimpleNamespace(
        is_revoked=True,
        user_id="user-1",
        expires_at=None,
        absolute_expiry=None,
    )

    monkeypatch.setattr(auth_service, "hash_token", lambda _value: "hashed")
    monkeypatch.setattr(
        auth_service,
        "get_refresh_token_by_hash",
        AsyncMock(return_value=token_record),
    )
    monkeypatch.setattr(
        auth_service,
        "revoke_active_tokens_for_user",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(auth_service, "create_audit_log", AsyncMock(return_value=None))

    with pytest.raises(AuthError) as exc:
        await auth_service.refresh_user_session(db, request, response)

    assert exc.value.code == "TOKEN_REUSED"
    assert db.commit.await_count == 1
