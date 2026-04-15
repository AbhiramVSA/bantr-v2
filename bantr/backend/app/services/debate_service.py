import json
import logging
import uuid
from datetime import datetime, timezone

from livekit.api import (
    CreateAgentDispatchRequest,
    CreateRoomRequest,
    DeleteRoomRequest,
    LiveKitAPI,
    TwirpError,
    TwirpErrorCode,
)
from livekit.api.access_token import AccessToken, VideoGrants
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, ConflictError
from app.crud.debate import create_debate
from app.models.debate import Debate
from app.schemas.debate import DebateCreate

logger = logging.getLogger(__name__)

DEFAULT_AGENT_NAME = "bantr-debate"


async def create_new_debate(
    db: AsyncSession, user_id: uuid.UUID, data: DebateCreate
) -> Debate:
    return await create_debate(
        db,
        user_id=user_id,
        title=data.title,
        topic=data.topic,
        agent_prompt=data.agent_prompt,
        agent_voice_id=data.agent_voice_id,
        livekit_room_name=f"debate-{uuid.uuid4().hex[:12]}",
    )


async def start_debate(
    db: AsyncSession, debate: Debate, user_id: uuid.UUID
) -> tuple[str, str]:
    if debate.status != "pending":
        raise ConflictError(
            "INVALID_STATUS", f"Debate is '{debate.status}', expected 'pending'"
        )

    metadata = {"debate_id": str(debate.id)}

    api = LiveKitAPI(
        url=settings.LIVEKIT_URL,
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    try:
        await api.room.create_room(
            CreateRoomRequest(
                name=debate.livekit_room_name,
                metadata=json.dumps(metadata),
            )
        )
        await api.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                room=debate.livekit_room_name,
                agent_name=DEFAULT_AGENT_NAME,
                metadata=json.dumps(metadata),
            )
        )
    except Exception as exc:
        debate.status = "failed"
        await db.flush()
        logger.exception("Failed to start debate room/dispatch")
        raise AppError(
            "ROOM_START_FAILED",
            "Failed to create debate room and dispatch agent",
            status_code=502,
        ) from exc
    finally:
        await api.aclose()

    debate.status = "active"
    debate.started_at = datetime.now(timezone.utc)
    await db.flush()

    token = _generate_participant_token(debate.livekit_room_name, str(user_id), "user")
    return token, settings.LIVEKIT_URL


async def end_debate(db: AsyncSession, debate: Debate) -> None:
    if debate.status != "active":
        raise ConflictError(
            "INVALID_STATUS", f"Debate is '{debate.status}', expected 'active'"
        )

    api = LiveKitAPI(
        url=settings.LIVEKIT_URL,
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    try:
        await api.room.delete_room(DeleteRoomRequest(room=debate.livekit_room_name))
    except TwirpError as exc:
        if exc.code == TwirpErrorCode.NOT_FOUND:
            logger.info("LiveKit room already absent: %s", debate.livekit_room_name)
        else:
            logger.exception("Failed to delete LiveKit room %s", debate.livekit_room_name)
            raise AppError(
                "ROOM_DELETE_FAILED",
                "Failed to end debate room",
                status_code=502,
            ) from exc
    except Exception as exc:
        logger.exception("Failed to delete LiveKit room %s", debate.livekit_room_name)
        raise AppError(
            "ROOM_DELETE_FAILED",
            "Failed to end debate room",
            status_code=502,
        ) from exc
    finally:
        await api.aclose()

    debate.status = "ending"
    debate.ended_at = datetime.now(timezone.utc)
    await db.flush()


def generate_join_token(room_name: str, user_id: str) -> str:
    return _generate_participant_token(room_name, user_id, "user")


def _generate_participant_token(
    room_name: str, identity: str, name: str
) -> str:
    token = AccessToken(
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    token.identity = identity
    token.name = name
    token.add_grant(
        VideoGrants(
            room_join=True,
            room=room_name,
        )
    )
    return token.to_jwt()
