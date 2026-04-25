import asyncio
import logging
import uuid
from typing import TypedDict

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.crud.chat_message import create_chat_message, get_recent_chat_messages
from app.crud.debate import get_debate_by_id
from app.crud.debate_embedding import search_similar_embeddings
from app.models.chat_message import ChatMessage
from app.prompts import CHAT_AGENT_INSTRUCTIONS, build_chat_user_prompt
from app.schemas.llm import ChatCoachOutput
from app.services.embedding_service import embed_query

logger = logging.getLogger(__name__)

CHAT_TIMEOUT_SECONDS = 60
CHAT_RETRIES = 2


class ContextDebate(TypedDict):
    id: str
    title: str


_chat_model_name = settings.OPENAI_SIMPLE_MODEL.removeprefix("openai:")
chat_agent = Agent(
    model=OpenAIChatModel(
        _chat_model_name,
        provider=OpenAIProvider(api_key=settings.OPENAI_API_KEY),
    ),
    output_type=ChatCoachOutput,
    instructions=CHAT_AGENT_INSTRUCTIONS,
    retries=CHAT_RETRIES,
    output_retries=CHAT_RETRIES,
    defer_model_check=True,
)


def _format_recent_history(messages: list[ChatMessage]) -> str:
    if not messages:
        return "No previous chat messages."
    lines: list[str] = []
    for message in messages:
        role = message.role.upper()
        lines.append(f"{role}: {message.content}")
    return "\n".join(lines)


async def _generate_chat_response(
    *,
    user_message: str,
    context_text: str,
    history_text: str,
) -> str:
    try:
        result = await asyncio.wait_for(
            chat_agent.run(
                build_chat_user_prompt(
                    user_message=user_message,
                    context_text=context_text,
                    history_text=history_text,
                )
            ),
            timeout=CHAT_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.exception("Chat agent call failed")
        raise AppError(
            "CHAT_FAILED",
            "Failed to generate chat response",
            status_code=502,
        ) from exc

    return result.output.response


async def handle_chat_message(
    db: AsyncSession, user_id: uuid.UUID, message: str
) -> tuple[ChatMessage, list[ContextDebate]]:
    query_embedding = await embed_query(message)
    similar = await search_similar_embeddings(db, user_id, query_embedding, limit=5)

    context_parts = []
    debate_ids_seen: dict[str, str] = {}
    for emb in similar:
        debate = await get_debate_by_id(db, emb.debate_id)
        if not debate:
            continue
        debate_id_str = str(debate.id)
        if debate_id_str not in debate_ids_seen:
            debate_ids_seen[debate_id_str] = debate.title
        context_parts.append(f"[From debate: {debate.title}]\n{emb.chunk_text}")

    context_text = (
        "\n\n---\n\n".join(context_parts) if context_parts else "No relevant debate history found."
    )

    recent = await get_recent_chat_messages(db, user_id, limit=10)
    history_text = _format_recent_history(recent)
    assistant_content = await _generate_chat_response(
        user_message=message,
        context_text=context_text,
        history_text=history_text,
    )

    context_ids = list(debate_ids_seen.keys()) if debate_ids_seen else None
    await create_chat_message(
        db,
        user_id=user_id,
        role="user",
        content=message,
        context_debate_ids=context_ids,
    )
    assistant_msg = await create_chat_message(
        db,
        user_id=user_id,
        role="assistant",
        content=assistant_content,
        context_debate_ids=context_ids,
    )

    context_debates: list[ContextDebate] = [
        {"id": did, "title": title} for did, title in debate_ids_seen.items()
    ]
    return assistant_msg, context_debates
