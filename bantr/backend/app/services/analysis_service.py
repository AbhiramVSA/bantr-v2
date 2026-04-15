import asyncio
import json
import logging

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, ConflictError
from app.crud.debate_analysis import create_debate_analysis, get_analysis_by_debate_id
from app.crud.transcript import get_transcript_by_debate_id
from app.models.debate import Debate
from app.models.debate_analysis import DebateAnalysis
from app.services.embedding_service import embed_transcript

logger = logging.getLogger(__name__)

OPENAI_TIMEOUT_SECONDS = 90
OPENAI_RETRIES = 2

ANALYSIS_SYSTEM_PROMPT = """You are an expert debate analyst. Analyze the debate transcript and produce strict JSON.

Return this exact shape:
{
  "argument_strength": {"user_score": 1-10, "agent_score": 1-10, "reasoning": "string"},
  "logical_fallacies": [{"speaker": "user|agent", "fallacy": "string", "quote": "string"}],
  "persuasiveness": {"user_rating": 1-10, "agent_rating": 1-10, "summary": "string"},
  "key_moments": [{"description": "string", "speaker": "user|agent", "impact": "string"}],
  "improvement_areas": [{"area": "string", "suggestion": "string"}],
  "overall_summary": "string",
  "winner": "user|agent|draw"
}
"""


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

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = None
    for attempt in range(OPENAI_RETRIES):
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=[
                        {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                        {"role": "user", "content": transcript.full_text},
                    ],
                    response_format={"type": "json_object"},
                ),
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
            break
        except Exception:
            logger.exception("OpenAI analysis call failed on attempt %s", attempt + 1)
            if attempt == OPENAI_RETRIES - 1:
                raise AppError(
                    "ANALYSIS_FAILED",
                    "Failed to analyze debate",
                    status_code=502,
                )

    content = response.choices[0].message.content if response else None
    if not content:
        raise AppError(
            "ANALYSIS_INVALID",
            "OpenAI returned empty analysis output",
            status_code=502,
        )

    try:
        result = json.loads(content)
    except json.JSONDecodeError as exc:
        raise AppError(
            "ANALYSIS_INVALID",
            "OpenAI returned invalid analysis JSON",
            status_code=502,
        ) from exc

    required_fields = {
        "argument_strength",
        "logical_fallacies",
        "persuasiveness",
        "key_moments",
        "improvement_areas",
        "overall_summary",
    }
    missing = required_fields - set(result.keys())
    if missing:
        raise AppError(
            "ANALYSIS_INVALID",
            f"Analysis JSON missing required fields: {sorted(missing)}",
            status_code=502,
        )

    analysis = await create_debate_analysis(
        db,
        debate_id=debate.id,
        argument_strength=result["argument_strength"],
        logical_fallacies=result["logical_fallacies"],
        persuasiveness=result["persuasiveness"],
        key_moments=result["key_moments"],
        improvement_areas=result["improvement_areas"],
        overall_summary=result["overall_summary"],
        winner=result.get("winner"),
    )

    await embed_transcript(db, debate, transcript)
    return analysis
