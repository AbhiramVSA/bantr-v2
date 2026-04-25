import asyncio
import logging
import uuid

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, ConflictError
from app.crud.debate import get_debate_by_id
from app.crud.debate_analysis import create_debate_analysis, get_analysis_by_debate_id
from app.crud.transcript import get_transcript_by_debate_id
from app.db.session import AsyncSessionLocal
from app.models.debate import Debate
from app.models.debate_analysis import DebateAnalysis
from app.prompts import ANALYSIS_AGENT_INSTRUCTIONS, build_analysis_user_prompt
from app.schemas.llm import DebateAnalysisOutput
from app.services.embedding_service import embed_transcript

logger = logging.getLogger(__name__)

ANALYSIS_TIMEOUT_SECONDS = 120
ANALYSIS_RETRIES = 2

_analysis_model_name = settings.OPENAI_ANALYSIS_MODEL.removeprefix("openai:")
_embedding_tasks: set[asyncio.Task[None]] = set()
analysis_agent = Agent(
    model=OpenAIChatModel(
        _analysis_model_name,
        provider=OpenAIProvider(api_key=settings.OPENAI_API_KEY),
    ),
    output_type=DebateAnalysisOutput,
    instructions=ANALYSIS_AGENT_INSTRUCTIONS,
    retries=ANALYSIS_RETRIES,
    output_retries=ANALYSIS_RETRIES,
    defer_model_check=True,
)


async def _generate_analysis_output(transcript_text: str) -> DebateAnalysisOutput:
    try:
        result = await asyncio.wait_for(
            analysis_agent.run(build_analysis_user_prompt(transcript_text)),
            timeout=ANALYSIS_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.exception("Analysis agent call failed")
        raise AppError(
            "ANALYSIS_FAILED",
            "Failed to analyze debate",
            status_code=502,
        ) from exc
    return result.output


async def _embed_transcript_async(debate_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as session:
        try:
            debate = await get_debate_by_id(session, debate_id)
            transcript = await get_transcript_by_debate_id(session, debate_id)
            if not debate or not transcript:
                logger.warning(
                    "Skipping transcript embedding for debate %s because debate or transcript is missing",
                    debate_id,
                )
                return

            await embed_transcript(session, debate, transcript)
            await session.commit()
        except AppError:
            await session.rollback()
            logger.exception(
                "Embedding failed after analysis persistence for debate %s", debate_id
            )
        except Exception:
            await session.rollback()
            logger.exception(
                "Unexpected embedding failure after analysis persistence for debate %s",
                debate_id,
            )


def schedule_embedding(debate_id: uuid.UUID) -> None:
    task = asyncio.create_task(_embed_transcript_async(debate_id))
    _embedding_tasks.add(task)
    task.add_done_callback(_embedding_tasks.discard)


async def analyze_debate(
    db: AsyncSession, debate: Debate
) -> DebateAnalysis:
    if debate.status != "completed":
        raise AppError(
            "DEBATE_NOT_COMPLETED",
            "Debate must be completed before analysis",
            status_code=400,
        )

    existing = await get_analysis_by_debate_id(db, debate.id)
    if existing:
        raise ConflictError("ANALYSIS_EXISTS", "Analysis already exists for this debate")

    transcript = await get_transcript_by_debate_id(db, debate.id)
    if not transcript:
        raise AppError(
            "NO_TRANSCRIPT",
            "Transcript not found for this debate",
            status_code=400,
        )

    output = await _generate_analysis_output(transcript.full_text)
    analysis = await create_debate_analysis(
        db,
        debate_id=debate.id,
        argument_strength=output.argument_strength.model_dump(),
        logical_fallacies=[item.model_dump() for item in output.logical_fallacies],
        persuasiveness=output.persuasiveness.model_dump(),
        key_moments=[item.model_dump() for item in output.key_moments],
        improvement_areas=[item.model_dump() for item in output.improvement_areas],
        overall_summary=output.overall_summary,
        winner=output.winner,
    )
    return analysis
