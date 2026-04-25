# Agent Engineering Rules

These rules apply to the whole repository. Follow them before local conventions unless a more specific `AGENTS.md` exists in a subdirectory.

## Product And Stack

- Product: Bantr, a voice debate app with authenticated users, LiveKit rooms, an AI debate worker, transcript analysis, embeddings, and chat memory.
- Backend: Python 3.12, FastAPI, SQLAlchemy 2 async, asyncpg, Alembic, Pydantic v2, pytest, pytest-asyncio, LiveKit, OpenAI, pgvector.
- Frontend: React 18, TypeScript strict mode, Vite, React Router, Tailwind, LiveKit React components.
- Package managers: `uv` for backend from `bantr/`; `npm` for frontend from `bantr/frontend/`.

## Required Workflow

1. Inspect the existing pattern before editing. Prefer the repo's current structure, naming, error model, and test style over introducing a new convention.
2. Identify edge cases before or while implementing. Add them to the change notes, a nearby test name, or relevant docs when they affect behavior.
3. Keep changes scoped. Do not rewrite unrelated files, generated outputs, lockfiles, or local environment files unless the task requires it.
4. Preserve user work in the dirty tree. Never revert unrelated changes.
5. Update tests or document why a behavior is manually verified only.
6. Run the smallest reliable quality gates that cover the change and report failures exactly.

## Architecture Boundaries

Backend code belongs in the existing layers:

- `backend/app/api/v1/routers`: HTTP concerns only, dependency injection, auth/CSRF checks, request/response schemas, status codes.
- `backend/app/schemas`: Pydantic request/response validation and serialization. Do not trust frontend validation.
- `backend/app/services`: business workflows, external API calls, transaction-sensitive orchestration, retries/timeouts, state transitions.
- `backend/app/crud`: focused database reads/writes. Keep business rules in services unless they are pure persistence invariants.
- `backend/app/models`: SQLAlchemy models and database relationships. Schema changes require Alembic migrations.
- `backend/app/core`: configuration, security, logging, shared error handling.
- `backend/agent_worker.py`: LiveKit worker process. It does not run inside FastAPI dependency injection and must manage DB sessions explicitly.

Frontend code belongs in the existing layers:

- `frontend/src/pages`: route-level composition and page state.
- `frontend/src/components`: reusable UI and domain components.
- `frontend/src/features`: feature-specific providers or state containers.
- `frontend/src/hooks`: reusable React hooks.
- `frontend/src/services`: API clients and browser/service integrations.
- `frontend/src/types`: shared TypeScript types matching backend contracts.
- `frontend/src/utils`: small pure helpers.

Avoid abstractions until at least two real call sites need the same behavior or the abstraction isolates a meaningful risk, such as auth, CSRF, LiveKit lifecycle, transcript parsing, or API error handling.

## Code Quality

- Keep functions small enough to test directly; split only on meaningful boundaries.
- Prefer explicit types at API, service, and shared utility boundaries.
- Avoid `any`, broad `dict`, and unvalidated JSON shapes unless the external API truly requires it. Narrow at the boundary.
- Use Pydantic and TypeScript types for contracts instead of ad hoc parsing.
- Use structured app errors from `backend/app/core/errors.py` for expected backend failures.
- Do not swallow exceptions. Log operational failures with enough context, but never log secrets, tokens, passwords, raw cookies, or API keys.
- For async workflows, handle cancellation/failure paths and ensure external clients/sessions are closed.
- For timestamps, use timezone-aware datetimes and preserve existing UTC behavior.

## Security Rules

- Enforce authorization server-side on every user-owned object. For object access, prefer 404 when revealing existence would leak another user's data.
- Preserve CSRF protections for cookie-authenticated state-changing endpoints.
- Validate all untrusted input on the backend, including values also validated in the UI.
- Never expose sensitive model fields through response schemas by default.
- Keep secrets in environment variables and examples only as placeholders.
- Add or update tests for auth bypasses, permission boundaries, token/session behavior, and unsafe state transitions.

## Edge Cases And Tests

Every behavior change must consider these edge-case categories:

- User input: blank, too long, invalid shape, unsupported enum, malformed UUID.
- UI/data states: empty, loading, error, retry, stale data, partially missing data.
- Auth/session: logged out, expired access token, refresh failure, CSRF missing/invalid, wrong user, missing permission.
- Network/external services: timeout, 4xx/5xx, malformed provider response, partial failure, retry exhaustion.
- Data integrity: duplicates, missing related rows, delete cascades, stale embeddings, migration compatibility.
- Race/concurrency: repeated clicks, duplicate submissions, simultaneous start/end/analyze, idempotency.
- Time: timezone-aware values, ordering, expiry, clock-sensitive logic.
- Responsive/accessibility: keyboard flow, focus, semantic labels, overflow on mobile and desktop.
- Security/abuse: object-level authorization, property-level authorization, rate-sensitive flows, prompt or content abuse.
- Backward compatibility: existing data, old cookies/tokens, legacy hashes, migrations.

Map each meaningful edge case to at least one verification type:

- Unit test for pure validation, helpers, state machines, prompt builders, parsers, and service branches.
- Integration test for router, auth/CSRF, database, transaction, and schema behavior.
- E2E or smoke test for multi-step user workflows across backend/frontend/external boundaries.
- Manual verification for visual, LiveKit, OAuth, provider-account, or environment-dependent cases that cannot run deterministically.
- Regression test for every fixed bug that can be reproduced automatically.

Backend tests live under `bantr/backend/tests`. Follow existing pytest naming and async patterns. Frontend test tooling is not currently installed; if adding frontend behavior that cannot be covered by `npm run build`, add an appropriate test tool or document the manual verification.

## Documentation

- Update `SETUP.md`, `docs/demo-checklist.md`, feature specs, or runbooks when commands, environment variables, migrations, startup, smoke tests, or operational behavior changes.
- Update this file and `docs/engineering-standards.md` when agent rules or quality gates change.
- Documentation should name exact commands, files, environment variables, and expected behavior.

## Quality Gates

Run from the indicated directories when the touched area is relevant:

- Backend tests: `cd bantr && uv run pytest`
- Frontend typecheck/build: `cd bantr/frontend && npm run build`
- Backend migrations: `cd bantr/backend && uv run alembic upgrade head` when migrations change.
- Demo smoke test: `cd bantr/backend && uv run python scripts/demo_smoke_test.py` when API, auth, debate lifecycle, LiveKit, analysis, or chat flows change and the required services are available.

There is currently no backend lint, backend typecheck, frontend lint, unit frontend test, or Playwright command configured. Do not claim these passed. If you add tooling, add package scripts and document the command here.

## Definition Of Done

A change is done only when:

- The implementation follows the existing backend/frontend layer boundaries.
- Edge cases are listed or encoded in test names.
- Relevant tests or manual checks cover the edge cases.
- Required docs are updated.
- Quality gates were run, or blockers are explained with exact commands and errors.
- The final response states files changed, commands run, results, and remaining risks.
