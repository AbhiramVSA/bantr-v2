import asyncio
import json
import logging
import math
import os
import sys
import uuid

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    AssignmentTimeoutError,
    JobContext,
    JobRequest,
    cli,
)
from livekit.agents.voice import room_io
from livekit.plugins import elevenlabs, silero
from livekit.rtc._proto import room_pb2
from pydantic_ai import Agent as PydanticAgent

from app.prompts import WORKER_PLANNER_INSTRUCTIONS, build_worker_planner_prompt
from app.schemas.llm import WorkerPlanOutput

load_dotenv("../.env")
load_dotenv(".env")

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Keep worker availability permissive for single-user demo reliability.
server = AgentServer(
    load_threshold=math.inf,
    num_idle_processes=1,
)
REQUIRED_WORKER_ENV = (
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "OPENAI_API_KEY",
    "DEEPGRAM_API_KEY",
    "ELEVENLABS_API_KEY",
)
WORKER_PLAN_RETRIES = 2
WORKER_PLAN_TIMEOUT_SECONDS = 45
JOB_ACCEPT_RETRIES = 3
JOB_ACCEPT_BACKOFF_SECONDS = 0.5

_worker_planner_agent: PydanticAgent[WorkerPlanOutput] | None = None


def _get_worker_planner_agent() -> PydanticAgent[WorkerPlanOutput]:
    global _worker_planner_agent
    if _worker_planner_agent is None:
        _worker_planner_agent = PydanticAgent(
            model=settings.OPENAI_COMPLEX_MODEL,
            output_type=WorkerPlanOutput,
            instructions=WORKER_PLANNER_INSTRUCTIONS,
            retries=WORKER_PLAN_RETRIES,
            output_retries=WORKER_PLAN_RETRIES,
            defer_model_check=True,
        )
    return _worker_planner_agent


async def _on_job_request(job_request: JobRequest) -> None:
    logger.info(
        "Received job request: room=%s job_id=%s",
        job_request.job.room.name,
        job_request.job.id,
    )
    for attempt in range(1, JOB_ACCEPT_RETRIES + 1):
        try:
            await job_request.accept()
            logger.info(
                "Accepted job request: room=%s job_id=%s attempt=%s",
                job_request.job.room.name,
                job_request.job.id,
                attempt,
            )
            return
        except AssignmentTimeoutError:
            logger.warning(
                "Job assignment timed out on attempt %s/%s for room=%s",
                attempt,
                JOB_ACCEPT_RETRIES,
                job_request.job.room.name,
            )
            if attempt == JOB_ACCEPT_RETRIES:
                raise
            await asyncio.sleep(JOB_ACCEPT_BACKOFF_SECONDS * attempt)


@server.rtc_session(agent_name=settings.LIVEKIT_AGENT_NAME, on_request=_on_job_request)
async def debate_session(ctx: JobContext):
    logger.info("Debate session entrypoint invoked for room=%s", ctx.room.name)
    # Connect immediately to satisfy LiveKit job lifecycle deadlines.
    connect_kwargs = {}
    if settings.LIVEKIT_FORCE_RELAY:
        connect_kwargs["rtc_config"] = rtc.RtcConfiguration(
            ice_transport_type=room_pb2.IceTransportType.TRANSPORT_RELAY
        )
        logger.info("Connecting with relay-only ICE transport")
    else:
        logger.info("Connecting with default ICE transport")

    try:
        await asyncio.wait_for(
            ctx.connect(**connect_kwargs),
            timeout=settings.LIVEKIT_CONNECT_TIMEOUT_SECONDS,
        )
    except Exception:
        logger.exception("Failed to connect worker to room")
        ctx.shutdown("rtc connect failed")
        return

    job_metadata_raw = getattr(ctx.job, "metadata", "") or ""
    room_metadata_raw = getattr(ctx.room, "metadata", "") or ""
    metadata = _parse_json_dict(job_metadata_raw)
    debate_id = metadata.get("debate_id")
    if not debate_id:
        room_metadata_raw = getattr(ctx.room, "metadata", "") or ""
        metadata = _parse_json_dict(room_metadata_raw)
        debate_id = metadata.get("debate_id")

    if not debate_id:
        logger.error(
            "Missing debate_id in metadata (job_metadata=%r room_metadata=%r)",
            job_metadata_raw,
            room_metadata_raw,
        )
        ctx.shutdown("missing debate_id metadata")
        return

    debate_config = await _load_debate_config(debate_id)
    if not debate_config:
        logger.error("Unable to load debate config for %s", debate_id)
        try:
            await _mark_debate_terminal(uuid.UUID(debate_id), status="failed")
        except ValueError:
            pass
        ctx.shutdown("missing debate configuration")
        return

    logger.info("Starting debate session for debate_id=%s", debate_id)
    plan = await _build_worker_plan(
        title=debate_config["title"],
        topic=debate_config["topic"],
        agent_prompt=debate_config["agent_prompt"],
    )
    requested_voice_id = debate_config["agent_voice_id"]
    if requested_voice_id:
        logger.info("Using ElevenLabs voice_id=%s", requested_voice_id)
    else:
        logger.info("No voice_id provided; using ElevenLabs plugin default voice")

    elevenlabs_tts = elevenlabs.TTS(
        api_key=settings.ELEVENLABS_API_KEY,
        model=settings.ELEVENLABS_TTS_MODEL,
        voice_id=requested_voice_id or elevenlabs.DEFAULT_VOICE_ID,
    )

    session = AgentSession(
        stt="deepgram/nova-3:multi",
        llm=settings.LIVEKIT_LLM_MODEL,
        tts=elevenlabs_tts,
        vad=silero.VAD.load(),
        use_tts_aligned_transcript=True,
        turn_handling={
            "turn_detection": "vad",
            "interruption": {
                "enabled": True,
                "mode": "vad",
                "discard_audio_if_uninterruptible": False,
                "resume_false_interruption": True,
                "min_duration": 0.15,
                "min_words": 0,
            },
            "endpointing": {
                "mode": "dynamic",
                "min_delay": 0.2,
                "max_delay": 1.2,
            },
        },
    )
    agent = Agent(instructions=plan.refined_system_prompt)

    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=True,
            text_input=True,
            audio_output=True,
            text_output=room_io.TextOutputOptions(sync_transcription=True),
            close_on_disconnect=True,
        ),
    )
    try:
        await session.generate_reply(
            instructions=plan.opening_statement,
            allow_interruptions=True,
        )
    except Exception:
        logger.exception("Failed to generate opening reply")

    disconnected_event = asyncio.Event()
    ctx.room.on("disconnected", lambda *_: disconnected_event.set())
    await disconnected_event.wait()
    try:
        await _save_transcript(debate_id, session)
    except Exception:
        logger.exception("Unhandled transcript save failure for debate %s", debate_id)
        try:
            await _mark_debate_terminal(uuid.UUID(debate_id), status="failed")
        except ValueError:
            pass


def _parse_json_dict(raw: str) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def _load_debate_config(debate_id: str) -> dict | None:
    try:
        from app.crud.debate import get_debate_by_id
        from app.db.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            debate = await get_debate_by_id(db, uuid.UUID(debate_id))
            if not debate:
                return None
            return {
                "title": debate.title,
                "topic": debate.topic,
                "agent_prompt": debate.agent_prompt,
                "agent_voice_id": debate.agent_voice_id,
            }
    except Exception:
        logger.exception("Failed to load debate config for %s", debate_id)
        return None


async def _build_worker_plan(
    *,
    title: str,
    topic: str,
    agent_prompt: str,
) -> WorkerPlanOutput:
    default_plan = WorkerPlanOutput(
        refined_system_prompt=agent_prompt,
        opening_statement=(
            "Begin the debate. State your position clearly, use concrete evidence, "
            "and challenge assumptions respectfully."
        ),
    )
    try:
        run_result = await asyncio.wait_for(
            _get_worker_planner_agent().run(
                build_worker_planner_prompt(
                    title=title,
                    topic=topic,
                    agent_prompt=agent_prompt,
                )
            ),
            timeout=WORKER_PLAN_TIMEOUT_SECONDS,
        )
    except Exception:
        logger.exception("Worker planner agent failed; using fallback plan")
        return default_plan
    return run_result.output


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
    for msg in _iter_chat_messages(session):
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


def _iter_chat_messages(session: AgentSession):
    history = session.history
    maybe_messages = getattr(history, "messages", None)
    if callable(maybe_messages):
        return maybe_messages()
    if isinstance(maybe_messages, list):
        return maybe_messages
    return []


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


def _validate_worker_env() -> None:
    missing = [key for key in REQUIRED_WORKER_ENV if not os.getenv(key)]
    if missing:
        logger.error("Agent worker missing required env vars: %s", ", ".join(missing))
        raise SystemExit(2)


if __name__ == "__main__":
    _validate_worker_env()
    if sys.platform.startswith("win") and "dev" in sys.argv:
        logger.error(
            "Refusing to run in `dev` mode on Windows because watcher mode is unstable. "
            "Run: `uv run python agent_worker.py start`"
        )
        raise SystemExit(2)
    logger.info(
        "Starting LiveKit agent worker for agent_name=%s mode=%s",
        settings.LIVEKIT_AGENT_NAME,
        "dev" if "dev" in sys.argv else "start",
    )
    cli.run_app(server)
