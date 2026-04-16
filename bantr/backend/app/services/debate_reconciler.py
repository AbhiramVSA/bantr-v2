import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.debate import Debate
from app.models.transcript import Transcript

logger = logging.getLogger(__name__)

STALE_STATUSES = {"starting", "ending"}


async def reconcile_stale_debates(
    db: AsyncSession, *, stale_after_seconds: int
) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_after_seconds)
    result = await db.execute(
        select(Debate).where(
            Debate.status.in_(STALE_STATUSES),
            Debate.updated_at < cutoff,
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

    now = datetime.now(timezone.utc)
    completed = 0
    failed = 0
    for debate in stale_debates:
        if debate.id in transcript_debate_ids:
            debate.status = "completed"
            completed += 1
        else:
            debate.status = "failed"
            failed += 1
        if debate.ended_at is None:
            debate.ended_at = now

    await db.flush()
    logger.warning(
        "Reconciled stale debates: total=%s completed=%s failed=%s",
        len(stale_debates),
        completed,
        failed,
    )
    return len(stale_debates)
