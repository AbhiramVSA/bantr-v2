import json
import logging
import uuid

from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli
from livekit.plugins import silero

load_dotenv("../.env")
load_dotenv(".env")

logger = logging.getLogger(__name__)

server = AgentServer()


@server.rtc_session(agent_name="bantr-debate")
async def debate_session(ctx: JobContext):
    metadata = json.loads(ctx.room.metadata or "{}")
    debate_id = metadata.get("debate_id")
    if not debate_id:
        logger.error("Missing debate_id in room metadata")
        return

    debate_config = await _load_debate_config(debate_id)
    if not debate_config:
        logger.error("Unable to load debate config for %s", debate_id)
        try:
            await _mark_debate_terminal(uuid.UUID(debate_id), status="failed")
        except ValueError:
            pass
        return

    logger.info("Starting debate session for debate_id=%s", debate_id)
    tts_model = (
        f"elevenlabs/{debate_config['agent_voice_id']}"
        if debate_config["agent_voice_id"]
        else "elevenlabs/aria"
    )
    session = AgentSession(
        stt="deepgram/nova-3:multi",
        llm="openai/gpt-4.1-mini",
        tts=tts_model,
        vad=silero.VAD.load(),
    )
    agent = Agent(instructions=debate_config["agent_prompt"])

    await session.start(agent=agent, room=ctx.room)
    await session.generate_reply(
        instructions="Begin the debate. State your position clearly and concisely."
    )

    await ctx.room.disconnected()
    await _save_transcript(debate_id, session)


async def _load_debate_config(debate_id: str) -> dict | None:
    try:
        from app.crud.debate import get_debate_by_id
        from app.db.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            debate = await get_debate_by_id(db, uuid.UUID(debate_id))
            if not debate:
                return None
            return {
                "agent_prompt": debate.agent_prompt,
                "agent_voice_id": debate.agent_voice_id,
            }
    except Exception:
        logger.exception("Failed to load debate config for %s", debate_id)
        return None


def _extract_text_content(message) -> str:
    text = getattr(message, "text_content", None)
    if isinstance(text, str):
        return text.strip()
    if callable(text):
        value = text()
        if isinstance(value, str):
            return value.strip()
    content = getattr(message, "content", None)
    if isinstance(content, str):
        return content.strip()
    return ""


async def _save_transcript(debate_id: str, session: AgentSession):
    from app.crud.debate import get_debate_by_id
    from app.crud.transcript import create_transcript, get_transcript_by_debate_id
    from app.db.session import AsyncSessionLocal

    try:
        did = uuid.UUID(debate_id)
    except ValueError:
        logger.error("Invalid debate_id in transcript save: %s", debate_id)
        return

    segments = []
    full_parts = []
    for msg in session.history.messages:
        role = str(getattr(msg, "role", "assistant"))
        if role not in ("user", "assistant"):
            continue
        text = _extract_text_content(msg)
        if not text:
            continue
        speaker = "user" if role == "user" else "agent"
        segments.append(
            {
                "speaker": speaker,
                "text": text,
                "start_time": 0.0,
                "end_time": 0.0,
            }
        )
        full_parts.append(f"[{speaker.upper()}]: {text}")

    if not segments:
        logger.warning("No transcript segments found for debate %s", debate_id)
        await _mark_debate_terminal(did, status="failed")
        return

    full_text = "\n".join(full_parts)

    async with AsyncSessionLocal() as db:
        try:
            debate = await get_debate_by_id(db, did)
            if not debate:
                logger.error("Debate %s not found in DB", debate_id)
                return

            existing = await get_transcript_by_debate_id(db, did)
            if not existing:
                await create_transcript(
                    db,
                    debate_id=did,
                    full_text=full_text,
                    speaker_segments=segments,
                )
            else:
                logger.info("Transcript already exists for debate %s", debate_id)

            if debate.status in {"active", "ending"}:
                debate.status = "completed"
            await db.flush()
            await db.commit()
            logger.info("Transcript persisted for debate %s", debate_id)
        except Exception:
            await db.rollback()
            logger.exception("Failed to persist transcript for debate %s", debate_id)
            await _mark_debate_terminal(did, status="failed")


async def _mark_debate_terminal(debate_id: uuid.UUID, status: str) -> None:
    from app.crud.debate import get_debate_by_id
    from app.db.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            debate = await get_debate_by_id(db, debate_id)
            if not debate:
                return
            if debate.status in {"completed", "failed"}:
                return
            debate.status = status
            await db.flush()
            await db.commit()
    except Exception:
        logger.exception(
            "Failed to set terminal status '%s' for debate %s", status, debate_id
        )


if __name__ == "__main__":
    cli.run_app(server)
