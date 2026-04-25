# Bantr Debate Demo Checklist

## Required Environment Variables

- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_COMPLEX_MODEL` (default: `openai:gpt-5.1`)
- `OPENAI_SIMPLE_MODEL` (default: `openai:gpt-5-mini`)
- `LIVEKIT_LLM_MODEL` (default: `openai/gpt-5.1`)
- `OPENAI_EMBED_MODEL` (default: `text-embedding-3-small`)

## Startup

1. Start API server:
   - `cd bantr/backend`
   - `uv run uvicorn app.main:app --reload`
2. Start agent worker in second terminal:
   - `cd bantr/backend`
   - `uv run agent_worker.py dev`
3. Validate integration checks:
   - `GET http://localhost:8000/health/live`
   - `GET http://localhost:8000/health/ready`
   - `GET http://localhost:8000/health/integrations`

## Demo Readiness

1. Login and confirm auth cookie + CSRF token are present.
2. Create a debate.
3. Start debate and confirm token + URL returned.
4. End debate and wait for transcript completion.
5. Analyze debate and verify structured result.
6. Send chat message and verify contextual response.
7. Verify chat history endpoint returns saved messages.

## Automated Smoke Test

Run:

- `cd bantr/backend`
- `uv run python scripts/demo_smoke_test.py`

Optional variables:

- `DEMO_API_ROOT` (default: `http://localhost:8000`)
- `DEMO_USER_EMAIL`
- `DEMO_USER_USERNAME`
- `DEMO_USER_PASSWORD`
- `DEMO_AGENT_VOICE_ID`

## Local Quality Gates

Before a demo branch is considered ready, run:

- `cd bantr && uv run pytest`
- `cd bantr && uv run ruff check backend`
- `cd bantr && uv run ruff format --check backend`
- `cd bantr && uv run pyright`
- `cd bantr/frontend && npm run build`
- `cd bantr/frontend && npm run lint`
- `cd bantr/frontend && npm run test:unit`
- `cd bantr/frontend && npm run test:e2e`
- `cd bantr/frontend && npm run docs:lint`

Expected outcome: every command exits with code 0. The Playwright command uses mocked API responses for the create-debate browser smoke path and does not require LiveKit or OpenAI.
