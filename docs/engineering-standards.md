# Engineering Standards

This document turns current engineering best practices into repo-specific rules for Bantr. It complements the root `AGENTS.md`; future AI agents and contributors should treat both as required guidance.

## Research Baseline

The standards are grounded in the current stack and these practice areas:

- FastAPI's official guidance for larger applications: keep routes modular with `APIRouter`, use dependencies to share cross-cutting request behavior, and let schemas validate and document API contracts.
- FastAPI SQL/database guidance: keep database access explicit, use SQLAlchemy-compatible patterns, and rely on Pydantic models for request and response validation.
- pytest's official good practices: keep tests discoverable under `tests/`, use isolated fixtures, and run tests against the local package consistently.
- React's official guidance: derive UI from state, keep state minimal, and avoid duplicating values that can be computed.
- TypeScript's compiler guidance: `noEmit` makes TypeScript a type checker when another tool, such as Vite, emits production assets.
- Vite's production guidance: `vite build` is the production build path; `vite preview` is only a local preview server.
- Playwright and Testing Library guidance for future frontend tests: verify user-visible behavior, avoid implementation details, and keep browser tests isolated.
- OWASP API Security and Secure Coding guidance: validate untrusted input server-side, deny by default for security controls, protect object and property authorization, and avoid leaking sensitive data.

## Repo Structure

The repository is intentionally split into backend, frontend, and docs:

```text
bantr/
  backend/               FastAPI app, LiveKit worker, Alembic, tests
  frontend/              React/Vite/TypeScript UI
  pyproject.toml         Backend dependencies and pytest dev dependencies
docs/                    Product plans, runbooks, checklists, engineering standards
SETUP.md                 Local setup and operational reference
AGENTS.md               AI-agent engineering rules
CLAUDE.md               Claude-specific rules that defer to AGENTS.md
```

Do not move modules across these boundaries unless the task is an explicit reorganization and all imports, tests, docs, and run commands are updated.

## Backend Standards

Use the existing layered FastAPI structure:

- Routers accept validated schemas, call services/CRUD, handle request dependencies, and return response schemas.
- Services own business rules: debate lifecycle, auth sessions, LiveKit orchestration, OpenAI calls, transcript analysis, embeddings, chat retrieval, idempotency, retries, and transaction-sensitive decisions.
- CRUD modules own narrow persistence operations and should not hide authorization or workflow rules.
- Schemas define public contracts and should prevent over-posting and accidental field exposure.
- Models define database shape only. Any schema change needs an Alembic migration and migration verification.
- Core modules own cross-cutting config, security, logging, and error behavior.

Expected backend patterns:

- Use `AsyncSession` consistently and commit/rollback at the same boundary used by nearby code.
- Use `get_user_*` queries for user-owned data to enforce object authorization.
- Return 404 for another user's resources where existence should not be disclosed.
- Use `ConflictError`, `NotFoundError`, `AuthError`, or `AppError` instead of raw `HTTPException` when matching existing error handling.
- Make external provider calls time-bound and failure-aware. Preserve state consistency when LiveKit/OpenAI calls fail.
- Keep retries bounded and avoid creating duplicate records on retry.
- Use timezone-aware datetimes and UTC-compatible behavior.

## Frontend Standards

Use the existing React/Vite structure:

- Pages compose route-level flows and own page-local orchestration.
- Services own HTTP details, CSRF header behavior, refresh retry behavior, and API error shapes.
- Components render UI and should not know backend transport details.
- Hooks encapsulate reusable stateful behavior.
- Shared types mirror backend response/request schemas and should be updated when API contracts change.

Expected frontend patterns:

- Keep TypeScript strict. Do not bypass type errors with `any`, `as unknown as`, or `@ts-ignore` unless the boundary is documented and narrowed immediately.
- Represent loading, empty, error, and success states explicitly.
- Prevent duplicate submissions for state-changing actions.
- Render API errors through user-meaningful states without exposing internal details.
- Check mobile and desktop overflow for any changed UI.
- Keep state minimal and derive computed values instead of duplicating them.

## Abstraction Rules

Prefer direct, local code until duplication or risk justifies a shared helper. A new abstraction must satisfy at least one condition:

- It has two or more real call sites now.
- It isolates a hard-to-get-right behavior such as auth, CSRF, refresh retry, transaction boundaries, LiveKit lifecycle, provider retries, transcript parsing, or vector search.
- It expresses a stable domain concept already present in the product.

Avoid abstractions that only rename a single call, hide simple data flow, or make tests depend on implementation details.

## Edge-Case Framework

Before or alongside implementation, record the meaningful edge cases in tests, docs, or final change notes. Use this checklist:

| Category | Examples | Minimum verification |
|---|---|---|
| User input | Blank strings, too-long fields, bad UUIDs, invalid enum/status | Unit or integration |
| Empty/loading/error | No debates, missing transcript, missing analysis, loading UI, failed API | Integration, UI test, or manual |
| Auth/session | Logged out, expired token, refresh failure, missing CSRF, wrong user | Integration |
| Network/provider | LiveKit failure, OpenAI timeout, malformed provider output, retry exhaustion | Unit or integration with mocks |
| Data validation | Over-posted fields, missing related rows, stale references, duplicate rows | Unit or integration |
| Race/concurrency | Double start/end/analyze, repeated clicks, token refresh fan-out | Unit, integration, or smoke |
| Time/timezone | Expiry, started/ended ordering, timezone-aware timestamps | Unit or integration |
| Responsive/a11y | Mobile overflow, focus, keyboard flow, semantic labels | Manual, component, or E2E |
| Security/abuse | Object authorization, property authorization, prompt/content abuse, sensitive logging | Unit or integration |
| Compatibility | Existing migrations, legacy hashes/tokens, old data shape | Regression or migration check |

For each meaningful edge case, choose one of:

- Unit test: fastest verification for pure logic and service branches.
- Integration test: router, schema, auth, CSRF, database, and transaction behavior.
- E2E/smoke test: multi-step user flows across backend/frontend/provider boundaries.
- Manual check: environment-dependent or visual behavior that cannot run deterministically.
- Regression test: any fixed bug with a reproducible failure.

## Testing Strategy

Backend:

- Keep pytest tests under `bantr/backend/tests`.
- Name tests after behavior and edge case, not implementation detail.
- Prefer service tests for state machines and provider-failure paths.
- Prefer API integration tests for auth, CSRF, routing, schema, and transaction behavior.
- Mock LiveKit/OpenAI in deterministic tests unless the test is explicitly a smoke/demo check.
- Add regression tests for fixed bugs around auth, token refresh, debate lifecycle, transcript persistence, analysis, embedding, and chat retrieval.

Frontend:

- Current gate is `npm run build`, which runs `tsc -b` and `vite build`.
- If frontend behavior becomes complex, add React Testing Library for component/user behavior and Playwright for critical routes.
- Browser tests should verify user-visible behavior, not CSS class names or internal component state.
- Keep E2E tests isolated with their own users/data and deterministic setup.

Smoke/manual:

- Use `docs/demo-checklist.md` and `backend/scripts/demo_smoke_test.py` for debate API readiness when environment variables and external services are available.
- Manual checks must list the browser/viewport and the exact workflow checked.

## Linting, Formatting, And Static Analysis

Current configured gates:

- Backend tests: `cd bantr && uv run pytest`
- Backend lint: `cd bantr && uv run ruff check backend`
- Backend format check: `cd bantr && uv run ruff format --check backend`
- Backend typecheck: `cd bantr && uv run pyright`
- Frontend typecheck/build: `cd bantr/frontend && npm run build`
- Frontend lint: `cd bantr/frontend && npm run lint`
- Frontend unit/component tests: `cd bantr/frontend && npm run test:unit`
- Frontend E2E smoke: `cd bantr/frontend && npm run test:e2e`
- Docs lint: `cd bantr/frontend && npm run docs:lint`

Backend typechecking is intentionally scoped to production backend modules and `backend/agent_worker.py`. Pytest files use `SimpleNamespace` and monkeypatch-based doubles that are verified by pytest instead of Pyright.

Tooling standards:

- Ruff owns backend import sorting, linting, and formatting. Use `uv run ruff format backend` to apply formatting before the format check.
- Pyright runs in basic mode to catch production-code typing issues without forcing broad third-party stub churn.
- ESLint uses flat config with TypeScript and React Hooks rules.
- Vitest and React Testing Library cover component/user-visible behavior.
- Playwright covers critical browser smoke flows with isolated network mocks.
- markdownlint validates shared Markdown docs through the `docs:lint` script.

Do not claim skipped or environment-blocked gates passed.

## Documentation Standards

Update documentation when behavior, setup, operations, or product workflow changes:

- `SETUP.md`: local setup, env vars, migrations, startup, API reference.
- `docs/demo-checklist.md`: demo smoke flow and required services.
- `docs/superpowers/specs/*`: product/architecture decisions.
- `docs/superpowers/plans/*`: execution plans and completed checklist context.
- `AGENTS.md` and this file: engineering and AI-agent rules.
- `CLAUDE.md`: Claude-specific notes only; keep shared rules in `AGENTS.md`.

Docs must include exact commands and expected outcomes. Avoid generic wording that cannot be enforced.

## Review Checklist

Use this as the definition of done:

- Structure follows the established backend/frontend layers.
- New behavior validates backend input and preserves auth/CSRF rules.
- State transitions are explicit and idempotent where users can retry.
- External provider failure leaves data in a known, recoverable state.
- Edge cases are covered by tests or documented manual verification.
- Docs and runbooks reflect changed commands, env vars, migrations, or workflows.
- `cd bantr && uv run pytest` passes for backend changes, or failures are explained.
- `cd bantr && uv run ruff check backend` and `cd bantr && uv run ruff format --check backend` pass for backend Python changes.
- `cd bantr && uv run pyright` passes for backend production-code typing changes.
- `cd bantr/frontend && npm run build` passes for frontend changes, or failures are explained.
- `cd bantr/frontend && npm run lint` and `cd bantr/frontend && npm run test:unit` pass for frontend behavior changes.
- `cd bantr/frontend && npm run test:e2e` passes when browser workflow behavior changes.
- `cd bantr/frontend && npm run docs:lint` passes when documentation changes.
- Migration changes are verified with `cd bantr/backend && uv run alembic upgrade head`.
- No unrelated dirty-tree changes are reverted or reformatted.
