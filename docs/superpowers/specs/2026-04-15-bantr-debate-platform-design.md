# Bantr Debate Platform — Design Spec

## Overview

Bantr is a voice-based debate platform where a user creates an AI debate opponent by writing a prompt, then enters a WebRTC voice room to debate it in real time. After the debate, the system generates a transcript, runs structured analysis on debate performance, and stores everything in a vector-searchable memory that powers a chatbot with full context of all past debates.

This is a single-user proof of concept. Functionality is the priority; scalability is not.

## Architecture

Monolith + sidecar agent. Two processes, one database, one repo.

```
FastAPI (API server)  ←→  Neon Postgres (pgvector)
                                 ↑
LiveKit AgentServer   ───────────┘
       ↕
 LiveKit Cloud (WebRTC)
```

- **FastAPI** handles all HTTP endpoints: debate CRUD, triggering analysis, the chatbot, LiveKit token generation.
- **LiveKit AgentServer** (`agent_worker.py`) is a standalone Python process that connects to LiveKit Cloud and receives job dispatches. When a user starts a debate, LiveKit Cloud routes the agent into the room. The agent reads its prompt from room metadata.
- **Neon Postgres** with pgvector stores all application data including transcript embeddings.

Both processes share the same `.env` and database.

## Tech Stack

| Component | Technology |
|---|---|
| API server | FastAPI (existing) |
| Agent worker | LiveKit Agents SDK (`AgentServer` + `cli.run_app`) |
| STT | Deepgram Nova-3 via LiveKit Inference |
| LLM (debate) | OpenAI GPT-4.1 mini via LiveKit Inference |
| TTS | ElevenLabs via LiveKit Inference |
| VAD | Silero (LiveKit plugin) |
| LLM (analysis) | OpenAI API (direct, structured output) |
| Embeddings | OpenAI text-embedding-3-small (direct) |
| Vector store | pgvector on Neon Postgres |
| WebRTC transport | LiveKit Cloud |
| Database | Neon Postgres (existing) |

## Data Models

All models inherit from the existing `Base` class (UUID PK, `created_at`, `updated_at` with `DateTime(timezone=True)`).

### Debate

```
debates
├── id              UUID PK
├── user_id         FK → users.id, NOT NULL
├── title           VARCHAR(200), NOT NULL
├── topic           TEXT, NOT NULL (the debate question)
├── agent_prompt    TEXT, NOT NULL (full system prompt for the AI agent)
├── agent_voice_id  VARCHAR(100), NOT NULL (ElevenLabs voice ID)
├── status          VARCHAR(20), NOT NULL, default "pending"
│                   enum: pending → active → completed → failed
├── livekit_room_name  VARCHAR(100), UNIQUE, NOT NULL
├── started_at      TIMESTAMPTZ, nullable
├── ended_at        TIMESTAMPTZ, nullable
├── created_at      TIMESTAMPTZ (from Base)
├── updated_at      TIMESTAMPTZ (from Base)
```

Status transitions:
- `pending` — debate created, room not yet started
- `active` — LiveKit room created, user and agent are in the room
- `completed` — debate ended, transcript saved
- `failed` — something went wrong (room creation failed, agent crashed, etc.)

### Transcript

```
transcripts
├── id                UUID PK
├── debate_id         FK → debates.id, UNIQUE, NOT NULL
├── full_text         TEXT, NOT NULL (complete transcript as plain text)
├── speaker_segments  JSONB, NOT NULL
│                     Array of: {speaker: "user"|"agent", text: str, start_time: float, end_time: float}
├── created_at        TIMESTAMPTZ
├── updated_at        TIMESTAMPTZ
```

One transcript per debate (1:1 relationship enforced by UNIQUE on debate_id).

### DebateAnalysis

```
debate_analyses
├── id                  UUID PK
├── debate_id           FK → debates.id, UNIQUE, NOT NULL
├── argument_strength   JSONB, NOT NULL
│                       {user_score: int 1-10, agent_score: int 1-10, reasoning: str}
├── logical_fallacies   JSONB, NOT NULL
│                       Array of: {speaker: str, fallacy: str, quote: str}
├── persuasiveness      JSONB, NOT NULL
│                       {user_rating: int 1-10, agent_rating: int 1-10, summary: str}
├── key_moments         JSONB, NOT NULL
│                       Array of: {description: str, speaker: str, impact: str}
├── improvement_areas   JSONB, NOT NULL
│                       Array of: {area: str, suggestion: str}
├── overall_summary     TEXT, NOT NULL
├── winner              VARCHAR(10), nullable ("user" | "agent" | "draw")
├── created_at          TIMESTAMPTZ
├── updated_at          TIMESTAMPTZ
```

One analysis per debate (1:1).

### DebateEmbedding

```
debate_embeddings
├── id            UUID PK
├── debate_id     FK → debates.id, NOT NULL
├── user_id       FK → users.id, NOT NULL (denormalized for efficient vector search filtering)
├── chunk_index   INTEGER, NOT NULL (ordering within transcript)
├── chunk_text    TEXT, NOT NULL
├── embedding     VECTOR(1536), NOT NULL (OpenAI text-embedding-3-small dimension)
├── speaker       VARCHAR(10), NOT NULL ("user" | "agent")
├── created_at    TIMESTAMPTZ
├── updated_at    TIMESTAMPTZ
```

Index: `ivfflat` on `embedding` column with `vector_cosine_ops` for similarity search. Many embeddings per debate (1:N).

`user_id` is denormalized from `debates.user_id` so the chatbot can filter embeddings by user without joining through debates.

### ChatMessage

```
chat_messages
├── id                  UUID PK
├── user_id             FK → users.id, NOT NULL
├── role                VARCHAR(10), NOT NULL ("user" | "assistant")
├── content             TEXT, NOT NULL
├── context_debate_ids  JSONB, nullable (array of debate UUIDs that were referenced)
├── created_at          TIMESTAMPTZ
├── updated_at          TIMESTAMPTZ
```

Index on `(user_id, created_at)` for paginated history queries.

## API Endpoints

All under `/api/v1`. Existing auth endpoints unchanged. All new endpoints require authentication (access_token cookie). Debates and chat endpoints are scoped to the authenticated user.

### Debates

| Method | Path | Description |
|---|---|---|
| POST | `/debates` | Create a debate |
| GET | `/debates` | List user's debates (filterable by status) |
| GET | `/debates/{id}` | Get debate details |
| POST | `/debates/{id}/start` | Start debate (creates LiveKit room, returns join token) |
| POST | `/debates/{id}/end` | End debate (closes room, triggers transcript save) |
| DELETE | `/debates/{id}` | Delete debate and all related data (transcript, analysis, embeddings) |

#### POST /debates

Request:
```json
{
  "title": "Should AI replace teachers?",
  "topic": "Argue that AI should replace human teachers in schools",
  "agent_prompt": "You are a passionate education reformer who believes AI tutors are superior to human teachers. Defend this position aggressively...",
  "agent_voice_id": "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
}
```

Response: `201` with the full debate object (status: `pending`).

#### POST /debates/{id}/start

Precondition: status must be `pending`.

Actions:
1. Create LiveKit room via Server SDK with metadata: `{"debate_id": "<id>", "agent_prompt": "<prompt>", "voice_id": "<voice_id>"}`
2. Update status to `active`, set `started_at`
3. Generate a LiveKit participant token for the user

Response:
```json
{
  "status": "active",
  "livekit_token": "eyJ...",
  "livekit_url": "wss://..."
}
```

#### POST /debates/{id}/end

Precondition: status must be `active`.

Actions:
1. Delete the LiveKit room (disconnects all participants)
2. Update status to `completed`, set `ended_at`

The agent worker handles transcript saving on disconnect (see Agent Worker section). If the agent worker fails to save the transcript, the status remains `completed` but the transcript endpoint returns 404.

Response:
```json
{
  "status": "completed"
}
```

### Transcripts & Analysis

| Method | Path | Description |
|---|---|---|
| GET | `/debates/{id}/transcript` | Get transcript |
| POST | `/debates/{id}/analyze` | Trigger analysis + embedding generation |
| GET | `/debates/{id}/analysis` | Get analysis results |

#### POST /debates/{id}/analyze

Precondition: debate status is `completed` and transcript exists. Returns 409 if analysis already exists.

Actions (run sequentially — PoC, no background workers):
1. Load transcript from DB
2. Call OpenAI with structured output prompt, parse into DebateAnalysis fields
3. Store analysis record
4. Chunk transcript into ~500 token segments
5. Call OpenAI embeddings API for each chunk
6. Store embeddings in `debate_embeddings` with pgvector

Response: `201` with the full analysis object.

This endpoint will take 10-30 seconds depending on transcript length. For PoC this is acceptable as a synchronous call. The client should handle the wait.

### Chat

| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Send a message, get a response |
| GET | `/chat/history` | Get chat history (paginated) |
| DELETE | `/chat/history` | Clear all chat history |

#### POST /chat

Request:
```json
{
  "message": "What was my strongest argument in the AI teachers debate?"
}
```

Actions:
1. Embed the user's message via OpenAI embeddings API
2. Query pgvector: top 5 most similar chunks WHERE `user_id = current_user.id`
3. Load last 10 chat messages for conversation continuity
4. Build OpenAI prompt:
   - System: "You are a helpful debate coach. You have access to the user's past debate transcripts. Use the provided context to give specific, actionable advice. Reference specific moments from their debates when relevant."
   - Context chunks (with debate title and speaker labels)
   - Recent chat history
   - User message
5. Call OpenAI, get response
6. Store both user message and assistant response as ChatMessage records (with `context_debate_ids` extracted from the chunks used)
7. Return assistant response

Response:
```json
{
  "response": "In your debate about AI teachers, your strongest argument was...",
  "context_debates": [
    {"id": "...", "title": "Should AI replace teachers?"}
  ]
}
```

### LiveKit Token

| Method | Path | Description |
|---|---|---|
| POST | `/livekit/token` | Generate a join token for a debate room |

This is a utility endpoint for frontends that need to rejoin a room. The `/debates/{id}/start` endpoint already returns a token, but if a client disconnects and needs a fresh token:

Request:
```json
{
  "debate_id": "..."
}
```

Precondition: debate must be `active` and owned by the authenticated user.

Response:
```json
{
  "token": "eyJ...",
  "url": "wss://..."
}
```

## Agent Worker

### File: `agent_worker.py`

Located at `backend/agent_worker.py`. A standalone process using the LiveKit Agents SDK.

### Startup

```python
server = AgentServer()

@server.rtc_session(agent_name="bantr-debate")
async def debate_session(ctx: JobContext):
    # Read debate config from room metadata
    metadata = json.loads(ctx.room.metadata)
    debate_id = metadata["debate_id"]
    agent_prompt = metadata["agent_prompt"]
    voice_id = metadata["voice_id"]

    session = AgentSession(
        stt="deepgram/nova-3:multi",
        llm="openai/gpt-4.1-mini",
        tts=f"elevenlabs/{voice_id}",  # voice_id is the ElevenLabs voice ID; exact inference model string TBD from LiveKit docs at implementation time
        vad=silero.VAD.load(),
    )

    agent = Agent(instructions=agent_prompt)

    await session.start(agent=agent, room=ctx.room)
    await session.generate_reply(
        instructions="Begin the debate. State your position clearly and concisely."
    )
```

### Transcript Collection

When the session ends (user disconnects or room is deleted), the agent worker:

1. Collects the conversation transcript from the `AgentSession` (LiveKit SDK provides this)
2. Connects to the database directly using the shared `ASYNC_DATABASE_URI`
3. Creates a `Transcript` record with `full_text` and `speaker_segments`
4. Updates the debate status to `completed` if not already

### Running

```bash
# Development (with hot reload)
uv run agent_worker.py dev

# Production
uv run agent_worker.py start
```

### Environment Variables

In addition to the shared `.env`:
```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxx
LIVEKIT_API_SECRET=xxxxx
```

## Dependencies to Add

Add to `pyproject.toml` dependencies:
```
livekit-agents>=1.0.0
livekit-plugins-deepgram>=1.0.0
livekit-plugins-openai>=1.0.0
livekit-plugins-elevenlabs>=1.0.0
livekit-plugins-silero>=1.0.0
livekit-api>=1.0.0
pgvector>=0.4.0
openai>=1.60.0
```

## New .env Variables

```
# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# OpenAI (for analysis + embeddings — direct API calls)
OPENAI_API_KEY=
```

Note: The agent worker uses LiveKit Inference for STT/LLM/TTS (no separate provider keys needed — billed through LiveKit Cloud). The `OPENAI_API_KEY` is only needed for the analysis and embedding calls made by the FastAPI server.

## File Structure

New and modified files within `backend/app/`:

```
backend/
├── agent_worker.py                      (NEW — LiveKit agent process)
├── app/
│   ├── core/
│   │   └── config.py                    (MODIFIED — add new env vars)
│   ├── models/
│   │   ├── __init__.py                  (MODIFIED — register new models)
│   │   ├── debate.py                    (NEW)
│   │   ├── transcript.py               (NEW)
│   │   ├── debate_analysis.py          (NEW)
│   │   ├── debate_embedding.py         (NEW)
│   │   └── chat_message.py             (NEW)
│   ├── schemas/
│   │   ├── debate.py                    (NEW)
│   │   ├── transcript.py               (NEW)
│   │   ├── analysis.py                 (NEW)
│   │   └── chat.py                      (NEW)
│   ├── crud/
│   │   ├── debate.py                    (NEW)
│   │   ├── transcript.py               (NEW)
│   │   ├── debate_analysis.py          (NEW)
│   │   ├── debate_embedding.py         (NEW)
│   │   └── chat_message.py             (NEW)
│   ├── services/
│   │   ├── debate_service.py           (NEW — room creation, token gen, lifecycle)
│   │   ├── analysis_service.py         (NEW — OpenAI structured output)
│   │   ├── embedding_service.py        (NEW — chunking, embedding, vector search)
│   │   └── chat_service.py             (NEW — chatbot logic)
│   └── api/v1/
│       ├── api.py                       (MODIFIED — register new routers)
│       └── routers/
│           ├── debates.py               (NEW)
│           ├── chat.py                  (NEW)
│           └── livekit.py               (NEW)
```

## Migration

One Alembic migration to add:
- `debates` table
- `transcripts` table
- `debate_analyses` table
- `debate_embeddings` table with pgvector extension (`CREATE EXTENSION IF NOT EXISTS vector`)
- `chat_messages` table
- Relevant indexes including the ivfflat index on the embedding column

## Error Handling

- Starting a debate that isn't `pending` → 409 Conflict
- Ending a debate that isn't `active` → 409 Conflict
- Requesting transcript for a debate without one → 404
- Requesting analysis for a debate without a transcript → 400 (transcript required first)
- Requesting analysis when one already exists → 409 Conflict
- Accessing another user's debate → 404 (not 403, to avoid leaking existence)
- LiveKit room creation failure → set debate status to `failed`, return 502
- OpenAI API failure during analysis → return 502, don't store partial results
- Agent worker crash mid-debate → debate stays `active`; user must call `/end` manually which cleans up

## Out of Scope

- Frontend / UI
- Multi-user debates
- Real-time streaming of analysis
- Debate recording (audio files)
- Background task queue for analysis (synchronous is fine for PoC)
- Rate limiting on analysis/chat endpoints (auth rate limits from existing code are sufficient)
- Agent prompt templates or preset debate formats
