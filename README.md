<p align="center">
  <img src="assets/bantr-v2-logo.png" alt="Two speakers facing a central microphone waveform" width="200">
</p>

<h1 align="center">Bantr</h1>

<p align="center">A debate platform with live voice sessions, transcripts, analysis, and debate-history chat.</p>

<div align="center">

[What it does](#what-it-does) · [Local setup](#local-setup) · [Configuration](#configuration) · [Checks](#checks)

</div>

## What it does

Bantr combines a React client, a FastAPI service, a PostgreSQL database, and a LiveKit agent. Users can create debates, join live voice rooms, review transcripts, request analysis, and chat with context from past debates. The service also includes Google OAuth, role-based access, and user settings.

The repository keeps the application under [`bantr/`](bantr/). The top-level `SETUP.md` describes an earlier project generator and does not match this checkout.

## Local setup

You need Python 3.12+, [uv](https://docs.astral.sh/uv/), Node.js with npm, and Docker Compose. Run commands from the paths shown.

Start the local PostgreSQL service and install backend dependencies:

```sh
cd bantr
cp .env.example .env
uv sync --frozen
docker compose up -d postgres
```

Set `DATABASE_PASSWORD` in `bantr/.env` to match the local PostgreSQL configuration in `compose.yml`. Before using Google login, live rooms, or model-backed features, configure the required provider values in that file. Do not commit local credentials.

In one terminal, prepare the schema and start the API:

```sh
cd bantr/backend
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8003
```

In another terminal, install and start the client:

```sh
cd bantr/frontend
cp .env.example .env
npm ci
npm run dev
```

Open `http://localhost:5173`. The Vite server proxies `/api` and `/health` to `http://localhost:8003` by default. FastAPI exposes interactive API docs at `http://localhost:8003/docs`.

The Compose file starts PostgreSQL only. It does not start the API, client, or LiveKit services. The API can start without provider credentials, but Google sign-in, live voice sessions, and model-backed analysis/chat need their corresponding services and credentials.

For live voice sessions, start the LiveKit worker in a third terminal after configuring its required provider values in `bantr/.env`: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, and `ELEVENLABS_API_KEY`. Run the worker with this command:

```sh
cd bantr/backend
uv run python agent_worker.py start
```

## Configuration

- Backend settings use [`bantr/.env.example`](bantr/.env.example). It lists database, Google OAuth, LiveKit, OpenAI, and application settings.
- The client uses [`bantr/frontend/.env.example`](bantr/frontend/.env.example). `VITE_BACKEND_ORIGIN` changes the development proxy target.
- The PostgreSQL container uses the local settings in [`bantr/compose.yml`](bantr/compose.yml). Do not reuse its development configuration for a hosted database.

## Checks

From `bantr/`, the repository documents these backend checks:

```sh
uv run pytest
uv run ruff check backend
uv run ruff format --check backend
uv run pyright
```

From `bantr/frontend/`, run the client checks:

```sh
npm run build
npm run lint
npm run test:unit
npm run test:e2e
```

The browser smoke test uses mocked API responses for the create-debate flow. It does not validate LiveKit or OpenAI integration. The [demo checklist](docs/demo-checklist.md) covers more integration steps, but its API URL examples do not match the current `8003` development defaults.

## Project notes

- Python dependencies are locked in `bantr/uv.lock`; client dependencies are locked in `bantr/frontend/package-lock.json`.
- The API uses Alembic migrations. Apply them before the first run.
- The repository has no root license file.
- Runtime setup and provider integrations were not run for this README update.
