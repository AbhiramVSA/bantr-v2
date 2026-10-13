<h1 align="center">
  <img src="assets/bantr-v2-mark.png" alt="Two overlapping teal and amber speech bubbles" width="200">
  Bantr v2
</h1>

<h4 align="center">A proof of concept for voice debates, transcripts, analysis, and contextual chat.</h4>

<p align="center"><strong>Python 3.12+</strong> · <strong>FastAPI</strong> · <strong>React 18</strong> · <strong>Vite</strong></p>

<p align="center"><a href="#key-features">Key Features</a> · <a href="#architecture">Architecture</a> · <a href="#how-to-use">How to Use</a></p>

<p align="center"><a href="#development">Development</a> · <a href="#scope-and-status">Scope and Status</a> · <a href="#license">License</a></p>

<p align="center"><a href="#documentation">Documentation</a></p>

The source tree has no screenshot from a local demo.

Bantr is a single-user proof of concept for voice debates. The design describes an AI debate opponent, saved transcripts, post-debate analysis, and chat that uses debate data.

## Key Features

The source tree includes:

- Routes to create, start, end, list, and review debate sessions.
- A LiveKit agent worker and frontend pages for debate rooms.
- Transcript and analysis models, services, routes, and pages.
- Chat routes and a page for responses that use debate data.
- Authentication routes and role-based permission checks.

## Architecture

- `bantr/frontend` contains the React and Vite client.
- `bantr/backend` contains the FastAPI service and LiveKit agent worker.
- PostgreSQL stores application data and uses pgvector for debate embeddings.
- The design document specifies LiveKit Cloud as the voice-room transport.

The design describes a proof of concept for one user. This README makes no production-readiness claim.

## How to Use

[SETUP.md](SETUP.md) starts with `python generate.py my-project`, but the tracked source tree has no `generate.py` file.

These commands follow the tracked setup guide, package files, and project layout. We did not run them for this README.

```bash
# Install backend dependencies from the repository root
cd bantr
uv sync
```

```bash
# Start the API from bantr/backend
cd bantr/backend
uv run uvicorn app.main:app --reload
```

```bash
# Start the LiveKit agent in a second terminal
cd bantr/backend
uv run agent_worker.py dev
```

```bash
# Install frontend dependencies from the package lock file
cd bantr/frontend
npm ci
npm run dev
```

Use [the backend environment example](bantr/.env.example) and [the frontend environment example](bantr/frontend/.env.example) to find configuration names. Do not commit local credentials.

## Development

The source manifests and setup guide list these checks. We did not run them for this README.

```bash
# From bantr
uv run pytest
uv run ruff check backend
uv run ruff format --check backend
uv run pyright
```

```bash
# From bantr/frontend
npm run build
npm run lint
npm run test:unit
npm run test:e2e
npm run docs:lint
```

Install the Playwright Chromium browser before you run the end-to-end suite on a new machine.

## Scope and Status

The setup guide lists database, authentication, voice, and model-service settings for the full demo. This README does not claim that these services are configured or that the live debate flow works.

Use synthetic accounts and debate data for local checks. Keep credentials in local environment files.

## License

The reviewed commit has no tracked `LICENSE` or `COPYING` file. This README does not assign license terms.

## Documentation

- [Setup guide](SETUP.md)
- [Debate platform checklist](docs/debate-platform-v2-checklist.md)
- [Demo checklist](docs/demo-checklist.md)
- [Engineering standards](docs/engineering-standards.md)
- [Platform design](docs/superpowers/specs/2026-04-15-bantr-debate-platform-design.md)

---

<p align="center">Bantr v2 · Single-user proof of concept</p>
