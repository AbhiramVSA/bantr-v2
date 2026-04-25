import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transcript import Transcript


async def create_transcript(
    db: AsyncSession,
    *,
    debate_id: uuid.UUID,
    full_text: str,
    speaker_segments: list[dict[str, Any]],
) -> Transcript:
    transcript = Transcript(
        debate_id=debate_id,
        full_text=full_text,
        speaker_segments=speaker_segments,
    )
    db.add(transcript)
    await db.flush()
    await db.refresh(transcript)
    return transcript


async def get_transcript_by_debate_id(db: AsyncSession, debate_id: uuid.UUID) -> Transcript | None:
    result = await db.execute(select(Transcript).where(Transcript.debate_id == debate_id))
    return result.scalars().first()
