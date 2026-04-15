import asyncio
import logging

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


async def embed_transcript(
    db: AsyncSession, debate: Debate, transcript: Transcript
) -> None:
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
        embedding_records.append(
            DebateEmbedding(
                debate_id=debate.id,
                user_id=debate.user_id,
                chunk_index=chunk["chunk_index"],
                chunk_text=chunk["chunk_text"],
                embedding=embedding_data.embedding,
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
            logger.exception(
                "OpenAI query embedding call failed on attempt %s", attempt + 1
            )
            if attempt == OPENAI_RETRIES - 1:
                raise AppError(
                    "EMBEDDING_FAILED",
                    "Failed to embed chat query",
                    status_code=502,
                )

    return response.data[0].embedding
