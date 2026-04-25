import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.debate_analysis import DebateAnalysis


async def create_debate_analysis(
    db: AsyncSession,
    *,
    debate_id: uuid.UUID,
    argument_strength: dict[str, Any],
    logical_fallacies: list[dict[str, Any]],
    persuasiveness: dict[str, Any],
    key_moments: list[dict[str, Any]],
    improvement_areas: list[dict[str, Any]],
    overall_summary: str,
    winner: str | None,
) -> DebateAnalysis:
    analysis = DebateAnalysis(
        debate_id=debate_id,
        argument_strength=argument_strength,
        logical_fallacies=logical_fallacies,
        persuasiveness=persuasiveness,
        key_moments=key_moments,
        improvement_areas=improvement_areas,
        overall_summary=overall_summary,
        winner=winner,
    )
    db.add(analysis)
    await db.flush()
    await db.refresh(analysis)
    return analysis


async def get_analysis_by_debate_id(
    db: AsyncSession, debate_id: uuid.UUID
) -> DebateAnalysis | None:
    result = await db.execute(select(DebateAnalysis).where(DebateAnalysis.debate_id == debate_id))
    return result.scalars().first()
