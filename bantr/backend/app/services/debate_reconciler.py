import logging
from datetime import datetime, timedelta, timezone

from livekit.api import ListParticipantsRequest, ListRoomsRequest, LiveKitAPI
from livekit.protocol.models import ParticipantInfo
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.debate import Debate
from app.models.transcript import Transcript
from app.services.debate_service import delete_livekit_room

logger = logging.getLogger(__name__)

TRANSITION_STALE_STATUSES = {"starting", "ending"}


async def reconcile_stale_debates(
    db: AsyncSession,
    *,
    stale_after_seconds: int,
    empty_room_seconds: int,
    active_max_seconds: int,
) -> int:
    now = datetime.now(timezone.utc)
    transition_cutoff = now - timedelta(seconds=stale_after_seconds)
    empty_room_cutoff = now - timedelta(seconds=empty_room_seconds)
    active_cutoff = now - timedelta(seconds=active_max_seconds)
    result = await db.execute(
        select(Debate).where(
            or_(
                and_(
                    Debate.status.in_(TRANSITION_STALE_STATUSES),
                    Debate.updated_at < transition_cutoff,
                ),
                and_(
                    Debate.status == "active",
                    or_(
                        Debate.started_at < active_cutoff,
                        and_(
                            Debate.started_at.is_(None),
                            Debate.updated_at < active_cutoff,
                        ),
                        Debate.started_at < empty_room_cutoff,
                        and_(
                            Debate.started_at.is_(None),
                            Debate.updated_at < empty_room_cutoff,
                        ),
                    ),
                ),
            )
        )
    )
    stale_debates = list(result.scalars().all())
    if not stale_debates:
        return 0

    debate_ids = [debate.id for debate in stale_debates]
    transcripts_result = await db.execute(
        select(Transcript.debate_id).where(Transcript.debate_id.in_(debate_ids))
    )
    transcript_debate_ids = {row[0] for row in transcripts_result.all()}

    updated_count = 0
    completed = 0
    failed = 0
    reset_to_pending = 0
    moved_to_ending = 0
    api: LiveKitAPI | None = None

    for debate in stale_debates:
        if debate.id in transcript_debate_ids:
            debate.status = "completed"
            if debate.ended_at is None:
                debate.ended_at = now
            completed += 1
            updated_count += 1
            continue

        if debate.status == "starting":
            try:
                await delete_livekit_room(debate.livekit_room_name)
            except Exception:
                logger.exception(
                    "Failed to cleanup stale starting room %s during reconciliation",
                    debate.livekit_room_name,
                )
            debate.status = "pending"
            debate.started_at = None
            debate.ended_at = None
            reset_to_pending += 1
            updated_count += 1
            continue

        if debate.status == "active":
            if api is None:
                api = LiveKitAPI(
                    url=settings.LIVEKIT_URL,
                    api_key=settings.LIVEKIT_API_KEY,
                    api_secret=settings.LIVEKIT_API_SECRET,
                )

            room_state = await _get_room_state(api, debate.livekit_room_name)
            reference_time = getattr(debate, "started_at", None) or getattr(
                debate, "updated_at", None
            )
            exceeded_active_max = (
                reference_time is None or reference_time < active_cutoff
            )
            exceeded_empty_room = (
                reference_time is None or reference_time < empty_room_cutoff
            )

            should_end = (
                not room_state["room_exists"]
                or exceeded_active_max
                or (
                    exceeded_empty_room
                    and not room_state["has_human_participant"]
                )
            )

            if not should_end:
                continue

            try:
                if room_state["room_exists"]:
                    await delete_livekit_room(debate.livekit_room_name)
            except Exception:
                logger.exception(
                    "Failed to cleanup stale active room %s during reconciliation",
                    debate.livekit_room_name,
                )
            debate.status = "ending"
            if debate.ended_at is None:
                debate.ended_at = now
            moved_to_ending += 1
            updated_count += 1
            continue

        if debate.status == "ending":
            debate.status = "failed"
            if debate.ended_at is None:
                debate.ended_at = now
            failed += 1
            updated_count += 1
            continue

        debate.status = "failed"
        failed += 1
        updated_count += 1
        if debate.ended_at is None:
            debate.ended_at = now

    if api is not None:
        await api.aclose()

    if not updated_count:
        return 0

    await db.flush()
    logger.warning(
        "Reconciled stale debates: total=%s completed=%s failed=%s reset_to_pending=%s moved_to_ending=%s",
        updated_count,
        completed,
        failed,
        reset_to_pending,
        moved_to_ending,
    )
    return updated_count


async def _get_room_state(api: LiveKitAPI, room_name: str) -> dict[str, bool]:
    rooms = await api.room.list_rooms(ListRoomsRequest(names=[room_name]))
    room_exists = any(room.name == room_name for room in rooms.rooms)
    if not room_exists:
        return {"room_exists": False, "has_human_participant": False}

    participants = await api.room.list_participants(ListParticipantsRequest(room=room_name))
    has_human_participant = any(
        participant.kind == ParticipantInfo.Kind.STANDARD
        for participant in participants.participants
    )
    return {
        "room_exists": True,
        "has_human_participant": has_human_participant,
    }
