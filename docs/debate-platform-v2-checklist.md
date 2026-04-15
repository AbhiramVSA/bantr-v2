# Debate Platform v2 Execution Checklist

## Phase 0: Reliability Gates

- [x] Add LiveKit/OpenAI/pgvector/dotenv dependencies.
- [x] Add config vars for LiveKit + OpenAI models.
- [x] Update `.env.example`.
- [x] Add `docs/demo-checklist.md`.
- [x] Add `GET /health/integrations`.

## Phase 1: Data Layer

- [x] Register pgvector with asyncpg in DB session setup.
- [x] Add models: `Debate`, `Transcript`, `DebateAnalysis`, `DebateEmbedding`, `ChatMessage`.
- [x] Add `User.debates` relationship.
- [x] Register all models in `app/models/__init__.py`.
- [x] Create and apply Alembic migration for debate platform tables + `vector` extension.

## Phase 2: Schemas, CRUD, Services

- [x] Add schemas for debates/transcript/analysis/chat/livekit token.
- [x] Add CRUD modules for debates/transcripts/analysis/embeddings/chat messages.
- [x] Add hardened `debate_service` with room creation + dispatch + token generation.
- [x] Add `analysis_service` with structured OpenAI response and retries/timeouts.
- [x] Add `embedding_service` with transcript chunking and vector persistence.
- [x] Add `chat_service` with retrieval-augmented coaching responses.

## Phase 3: API Routers

- [x] Add `debates` router with CRUD/start/end/transcript/analysis endpoints.
- [x] Add `chat` router with send/history/clear endpoints.
- [x] Add `livekit` router with token endpoint.
- [x] Register all routers in `api/v1/api.py`.

## Phase 4: Agent Worker

- [x] Add `backend/agent_worker.py`.
- [x] Load debate configuration from DB via `debate_id` metadata.
- [x] Persist transcript with idempotency check.
- [x] Transition `ending -> completed` or `ending -> failed`.

## Phase 5: Demo Validation Assets

- [x] Add `backend/scripts/demo_smoke_test.py` for deterministic end-to-end API checks.
- [x] Update runbook with startup and smoke-test commands.
