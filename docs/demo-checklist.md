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
- `OPENAI_CHAT_MODEL` (default: `gpt-4.1-mini`)
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
