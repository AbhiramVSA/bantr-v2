import json
import logging
import uuid
from datetime import datetime, timezone

from livekit.api import (
    CreateAgentDispatchRequest,
    CreateRoomRequest,
    DeleteRoomRequest,
    ListRoomsRequest,
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

DEFAULT_AGENT_NAME = settings.LIVEKIT_AGENT_NAME
END_IDEMPOTENT_STATUSES = {"ending", "completed", "failed"}
RECOVERABLE_START_STATUSES = {"pending", "starting", "active"}


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
    if debate.status not in RECOVERABLE_START_STATUSES:
        raise ConflictError(
            "INVALID_STATUS",
            f"Debate is '{debate.status}', expected one of {sorted(RECOVERABLE_START_STATUSES)}",
        )

    api = LiveKitAPI(
        url=settings.LIVEKIT_URL,
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    try:
        if debate.status == "active":
            room_exists = await _room_exists(api, debate.livekit_room_name)
            dispatch_exists = (
                await _dispatch_exists(api, debate.livekit_room_name, DEFAULT_AGENT_NAME)
                if room_exists
                else False
            )
            if room_exists and dispatch_exists:
                token = _generate_participant_token(
                    debate.livekit_room_name, str(user_id), "user"
                )
                return token, settings.LIVEKIT_URL

            logger.warning(
                "Recovering inconsistent active debate %s (room_exists=%s dispatch_exists=%s)",
                debate.id,
                room_exists,
                dispatch_exists,
            )

        debate.status = "starting"
        debate.ended_at = None
        await db.flush()

        await _provision_room_and_dispatch(api, debate)
    except Exception as exc:
        debate.status = "pending"
        debate.started_at = None
        debate.ended_at = None
        await db.flush()
        logger.exception("Failed to start debate room/dispatch")
        raise _map_start_error(exc) from exc
    finally:
        await api.aclose()

    debate.status = "active"
    debate.started_at = datetime.now(timezone.utc)
    await db.flush()

    token = _generate_participant_token(debate.livekit_room_name, str(user_id), "user")
    return token, settings.LIVEKIT_URL


async def end_debate(db: AsyncSession, debate: Debate) -> None:
    if debate.status in END_IDEMPOTENT_STATUSES:
        return

    if debate.status != "active":
        raise ConflictError(
            "INVALID_STATUS", f"Debate is '{debate.status}', expected 'active'"
        )

    # Transition first to avoid a race where worker persists transcript before
    # status is updated, leaving debates stuck in "ending".
    debate.status = "ending"
    debate.ended_at = datetime.now(timezone.utc)
    await db.flush()

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


def generate_join_token(room_name: str, user_id: str) -> str:
    return _generate_participant_token(room_name, user_id, "user")


def _generate_participant_token(
    room_name: str, identity: str, name: str
) -> str:
    token = (
        AccessToken(
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        )
        .with_identity(identity)
        .with_name(name)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room_name,
            )
        )
    )
    return token.to_jwt()


async def delete_livekit_room(room_name: str) -> None:
    api = LiveKitAPI(
        url=settings.LIVEKIT_URL,
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    try:
        await _delete_room_if_exists(api, room_name)
    finally:
        await api.aclose()


async def _provision_room_and_dispatch(api: LiveKitAPI, debate: Debate) -> None:
    metadata = {"debate_id": str(debate.id)}
    await _delete_room_if_exists(api, debate.livekit_room_name)
    await api.room.create_room(
        CreateRoomRequest(
            name=debate.livekit_room_name,
            metadata=json.dumps(metadata),
        )
    )
    dispatch = await api.agent_dispatch.create_dispatch(
        CreateAgentDispatchRequest(
            room=debate.livekit_room_name,
            agent_name=DEFAULT_AGENT_NAME,
            metadata=json.dumps(metadata),
        )
    )
    logger.info(
        "LiveKit dispatch created: room=%s agent=%s dispatch_id=%s",
        debate.livekit_room_name,
        DEFAULT_AGENT_NAME,
        getattr(dispatch, "id", None),
    )


async def _room_exists(api: LiveKitAPI, room_name: str) -> bool:
    rooms = await api.room.list_rooms(ListRoomsRequest(names=[room_name]))
    return any(room.name == room_name for room in rooms.rooms)


async def _dispatch_exists(
    api: LiveKitAPI, room_name: str, agent_name: str
) -> bool:
    dispatches = await api.agent_dispatch.list_dispatch(room_name)
    return any(getattr(dispatch, "agent_name", None) == agent_name for dispatch in dispatches)


async def _delete_room_if_exists(api: LiveKitAPI, room_name: str) -> None:
    try:
        await api.room.delete_room(DeleteRoomRequest(room=room_name))
    except TwirpError as exc:
        if exc.code != TwirpErrorCode.NOT_FOUND:
            raise


def _map_start_error(exc: Exception) -> AppError:
    if isinstance(exc, TwirpError) and exc.code == TwirpErrorCode.UNAUTHENTICATED:
        return AppError(
            "LIVEKIT_UNAUTHENTICATED",
            "LiveKit rejected the configured API credentials or target project.",
            status_code=502,
        )
    return AppError(
        "ROOM_START_FAILED",
        "Failed to create debate room and dispatch agent",
        status_code=502,
    )
