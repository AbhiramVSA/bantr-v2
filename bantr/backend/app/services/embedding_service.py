import asyncio
import json
import logging
from collections.abc import Iterable
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.crud.debate_embedding import create_embeddings_batch
from app.models.debate import Debate
from app.models.debate_embedding import DebateEmbedding
from app.models.transcript import Transcript

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500  # approximate tokens per chunk
OPENAI_TIMEOUT_SECONDS = 45
OPENAI_RETRIES = 2


def _normalize_embedding_vector(value: Any) -> list[float]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise AppError(
                "EMBEDDING_FAILED",
                "Embedding response was not valid JSON",
                status_code=502,
            ) from exc

    if not isinstance(value, Iterable) or isinstance(value, (str, bytes)):
        raise AppError(
            "EMBEDDING_FAILED",
            "Embedding response had an unexpected format",
            status_code=502,
        )

    try:
        vector = [float(x) for x in value]
    except (TypeError, ValueError) as exc:
        raise AppError(
            "EMBEDDING_FAILED",
            "Embedding response contained non-numeric values",
            status_code=502,
        ) from exc

    if not vector:
        raise AppError(
            "EMBEDDING_FAILED",
            "Embedding response was empty",
            status_code=502,
        )

    return vector


def chunk_transcript(transcript: Transcript) -> list[dict]:
    chunks = []
    current_chunk = ""
    current_speaker = ""
    chunk_index = 0

    for segment in transcript.speaker_segments:
        speaker = str(segment.get("speaker", "agent"))
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        label = f"[{speaker.upper()}]: {text}\n"

        if len(current_chunk.split()) + len(label.split()) > CHUNK_SIZE and current_chunk:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "chunk_text": current_chunk.strip(),
                    "speaker": current_speaker if current_speaker else speaker,
                }
            )
            chunk_index += 1
            current_chunk = ""

        current_chunk += label
        current_speaker = speaker

    if current_chunk.strip():
        chunks.append(
            {
                "chunk_index": chunk_index,
                "chunk_text": current_chunk.strip(),
                "speaker": current_speaker if current_speaker else "agent",
            }
        )

    return chunks


async def embed_transcript(db: AsyncSession, debate: Debate, transcript: Transcript) -> None:
    chunks = chunk_transcript(transcript)
    if not chunks:
        return

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    texts = [c["chunk_text"] for c in chunks]

    response = None
    for attempt in range(OPENAI_RETRIES):
        try:
            response = await asyncio.wait_for(
                client.embeddings.create(
                    model=settings.OPENAI_EMBED_MODEL,
                    input=texts,
                ),
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
            break
        except Exception:
            logger.exception("OpenAI embedding call failed on attempt %s", attempt + 1)
            if attempt == OPENAI_RETRIES - 1:
                raise AppError(
                    "EMBEDDING_FAILED",
                    "Failed to generate transcript embeddings",
                    status_code=502,
                )

    if not response:
        return

    embedding_records = []
    for chunk, embedding_data in zip(chunks, response.data):
        vector = _normalize_embedding_vector(embedding_data.embedding)
        embedding_records.append(
            DebateEmbedding(
                debate_id=debate.id,
                user_id=debate.user_id,
                chunk_index=chunk["chunk_index"],
                chunk_text=chunk["chunk_text"],
                embedding=vector,
                speaker=chunk["speaker"],
            )
        )

    await create_embeddings_batch(db, embedding_records)


async def embed_query(text: str) -> list[float]:
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    response = None
    for attempt in range(OPENAI_RETRIES):
        try:
            response = await asyncio.wait_for(
                client.embeddings.create(
                    model=settings.OPENAI_EMBED_MODEL,
                    input=text,
                ),
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
            break
        except Exception:
            logger.exception("OpenAI query embedding call failed on attempt %s", attempt + 1)
            if attempt == OPENAI_RETRIES - 1:
                raise AppError(
                    "EMBEDDING_FAILED",
                    "Failed to embed chat query",
                    status_code=502,
                )

    if response is None:
        raise AppError(
            "EMBEDDING_FAILED",
            "Failed to embed chat query",
            status_code=502,
        )

    return _normalize_embedding_vector(response.data[0].embedding)
