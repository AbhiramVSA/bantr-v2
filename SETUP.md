# Setup Guide

This guide walks you through generating the backend, configuring all services, and running the app locally.

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- A PostgreSQL database (local or hosted — this guide covers [Neon](https://neon.tech))
- A Google Cloud account (for OAuth)

## 1. Generate the Project

```bash
python generate.py my-project
```

This creates the full project structure under `my-project/`.

## 2. Install Dependencies

```bash
cd my-project
uv sync
cd frontend
npm install
npx playwright install chromium
```

`uv sync` installs backend runtime and development tools, including pytest, Ruff, and Pyright. `npm install` installs the React app plus ESLint, Vitest, Playwright, and markdownlint. The Playwright browser install is required before running `npm run test:e2e` on a fresh machine.

## 3. Configure the Database

### Option A: Neon (Serverless Postgres)

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. On the dashboard, find your connection string. It looks like:
   ```
   postgresql://neondb_owner:npg_XXXXX@ep-cool-name-a1b2c3d4-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Extract the parts:
   - **User**: `neondb_owner`
   - **Password**: `npg_XXXXX`
   - **Host**: `ep-cool-name-a1b2c3d4-pooler.us-east-1.aws.neon.tech`
   - **Database**: `neondb`

### Option B: Local PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE myapp;"
```

Default values (`localhost`, `postgres`, port `5432`) work out of the box.

## 4. Create the `.env` File

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
MODE=development
SECRET_KEY=INSECURE-change-me

# Database — fill in from Step 3
DATABASE_USER=neondb_owner
DATABASE_PASSWORD=your_neon_password
DATABASE_HOST=ep-cool-name-pooler.us-east-1.aws.neon.tech
DATABASE_PORT=5432
DATABASE_NAME=neondb

# Google OAuth — fill in from Step 5
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback

# Admin bootstrap — your Google account email
BOOTSTRAP_ADMIN_EMAILS=you@gmail.com

# Logfire (optional — leave empty to skip)
LOGFIRE_TOKEN=
LOGFIRE_ENVIRONMENT=development

# Frontend
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Field reference

| Field | Required | Description |
|---|---|---|
| `MODE` | Yes | `development`, `production`, or `testing` |
| `SECRET_KEY` | Yes | Any string in dev. In production: 32+ chars, not the default |
| `DATABASE_USER` | Yes | Postgres username |
| `DATABASE_PASSWORD` | Yes | Postgres password (required in production) |
| `DATABASE_HOST` | Yes | `localhost` for local, Neon hostname for cloud |
| `DATABASE_PORT` | Yes | Usually `5432` |
| `DATABASE_NAME` | Yes | Database name |
| `GOOGLE_CLIENT_ID` | For OAuth | From GCP Console (see Step 5) |
| `GOOGLE_CLIENT_SECRET` | For OAuth | From GCP Console (see Step 5) |
| `GOOGLE_REDIRECT_URI` | For OAuth | Must match GCP exactly. Default: `http://localhost:8000/api/v1/auth/google/callback` |
| `BOOTSTRAP_ADMIN_EMAILS` | No | Comma-separated emails to auto-promote to admin role on startup |
| `LOGFIRE_TOKEN` | No | Pydantic Logfire token for observability. Leave empty to skip |
| `FRONTEND_URL` | Yes | Where OAuth redirects after login |
| `ALLOWED_ORIGINS` | Yes | Comma-separated CORS origins. Must not contain `*` |

## 5. Set Up Google OAuth (GCP)

### 5.1 Create or select a GCP project

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Click the project dropdown at the top and either select an existing project or click **New Project**.
3. Give it a name (e.g. "My App") and click **Create**.
4. Make sure the new project is selected in the dropdown.

### 5.2 Configure the OAuth consent screen

1. In the left sidebar, navigate to **APIs & Services > OAuth consent screen** (or search "OAuth consent screen" in the top search bar).
   - In newer GCP UI this may be under **Google Auth Platform > Branding**.
2. Select **External** as User type, click **Create**.
3. Fill in the required fields:
   - **App name**: Your app name
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue**.

### 5.3 Configure scopes

1. Go to **Google Auth Platform > Data Access** (or **OAuth consent screen > Scopes**).
2. Click **Add or remove scopes**.
3. Find and check these three scopes:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
4. Click **Update**, then **Save**.

### 5.4 Configure audience / publishing

1. Go to **Google Auth Platform > Audience** (or **OAuth consent screen > Publishing status**).
2. For development/testing:
   - **Testing** mode: Only emails you add as test users can log in. Add your own email.
   - **In production** mode: Any Google account can log in (no verification needed for non-sensitive scopes).
3. Choose whichever suits your stage. You can switch later.

### 5.5 Create OAuth client credentials

1. Go to **Google Auth Platform > Clients** (or **APIs & Services > Credentials**).
2. Click **+ Create Client** (or **+ Create Credentials > OAuth client ID**).
3. Select **Web application** as the application type.
4. Give it a name (e.g. "Web client").
5. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:8000
   http://localhost:5173
   ```
6. Under **Authorized redirect URIs**, add exactly:
   ```
   http://localhost:8000/api/v1/auth/google/callback
   ```
7. Click **Create**.
8. Copy the **Client ID** and **Client Secret** from the confirmation dialog.

### 5.6 Add credentials to `.env`

```env
GOOGLE_CLIENT_ID=316846858853-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
```

> **Important**: The redirect URI in `.env` must exactly match what you entered in GCP, including the protocol, port, and path.

## 6. Run Database Migrations

```bash
cd backend
uv run alembic revision --autogenerate -m "initial"
uv run alembic upgrade head
```

This creates all tables: `users`, `roles`, `permissions`, `oauth_accounts`, `refresh_tokens`, `auth_audit_logs`, and the `role_permissions` join table.

## 7. Start the Server

```bash
cd backend
uv run uvicorn app.main:app --reload
```

On startup, the app will:
- Warm the database connection pool
- Create default roles (`admin`, `user`) and permissions
- Promote any `BOOTSTRAP_ADMIN_EMAILS` to the admin role

The server runs at `http://localhost:8000`.

## 8. Verify Everything Works

### Health checks

```bash
curl http://localhost:8000/health/live
# {"status":"alive"}

curl http://localhost:8000/health/ready
# {"status":"ready","checks":{"database":"ok"}}
```

### Interactive API docs

Open `http://localhost:8000/docs` in your browser for the Swagger UI.

### Quality gates

Run these from a clean checkout after dependency installation:

```bash
cd bantr
uv run ruff format --check backend
uv run ruff check backend
uv run pyright
uv run pytest
```

```bash
cd bantr/frontend
npm run build
npm run lint
npm run test:unit
npm run test:e2e
npm run docs:lint
npm audit --audit-level=moderate
```

Expected outcome: all commands exit with code 0. `npm run build` may print a Vite chunk-size warning for the current app bundle; that warning does not fail the build.

### Register a user (email/password)

```bash
curl -c cookies.txt -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'
```

### Login

```bash
curl -c cookies.txt -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Get current user profile

```bash
curl -b cookies.txt http://localhost:8000/api/v1/auth/me
```

### Google OAuth login

Open in your browser (not curl — it's a redirect flow):

```
http://localhost:8000/api/v1/auth/google/login
```

After Google sign-in, you'll be redirected to `FRONTEND_URL` with auth cookies set. If you don't have a frontend running, you'll get a connection refused on `localhost:5173` — that's fine, the cookies are set on `localhost:8000`. Verify by visiting:

```
http://localhost:8000/api/v1/auth/me
```

## API Endpoints Reference

### Public (no auth required)

| Method | Path | Description |
|---|---|---|
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe (checks DB) |
| POST | `/api/v1/auth/register` | Register with email/password |
| POST | `/api/v1/auth/login` | Login with email/password |
| GET | `/api/v1/auth/google/login` | Start Google OAuth flow |
| GET | `/api/v1/auth/google/callback` | OAuth callback (Google redirects here) |

### Authenticated (requires access_token cookie)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/auth/me` | Get current user profile |
| POST | `/api/v1/auth/refresh` | Refresh tokens (requires CSRF header) |
| POST | `/api/v1/auth/logout` | Logout (requires CSRF header) |

### Authenticated + CSRF + Permissions

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/v1/users` | `users:read` | List users |
| GET | `/api/v1/users/{id}` | `users:read` | Get user by ID |
| DELETE | `/api/v1/users/{id}` | `users:delete` | Delete user |

### CSRF-protected endpoints

For `POST`/`PUT`/`PATCH`/`DELETE` requests on `/auth/refresh`, `/auth/logout`, and all `/users` endpoints, include the CSRF header:

```
X-CSRF-Token: <value from csrf_token cookie>
```

The `csrf_token` cookie is non-httponly so JavaScript can read it.

## Troubleshooting

### `error parsing value for field "BOOTSTRAP_ADMIN_EMAILS"`

Empty env vars for list-like fields cause pydantic-settings to attempt JSON parsing. The app uses `str` fields with property parsers to avoid this. Make sure you're using the latest `generate.py`.

### `can't subtract offset-naive and offset-aware datetimes`

The datetime columns need `DateTime(timezone=True)`. Re-run the generator or apply the migration to alter columns to `TIMESTAMP WITH TIME ZONE`.

### `InvalidCachedStatementError: cached statement plan is invalid`

Common with Neon's connection pooler (PgBouncer). The generated code disables prepared statement caching for remote hosts automatically. If you still see this after a schema migration, just restart the server.

### OAuth redirects to `?error=oauth_failed`

- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`.
- Make sure the redirect URI in GCP **exactly** matches `GOOGLE_REDIRECT_URI` in `.env`.
- Start the OAuth flow from `http://localhost:8000`, not `http://127.0.0.1:8000`. The session cookie is domain-specific — a mismatch between the login origin and callback origin breaks the OAuth state.
- Check server logs for the full exception (the app logs with `logger.exception`).

### `InsecureKeyLengthWarning` from PyJWT

The default `SECRET_KEY` is short. This warning is harmless in development. For production, set a 32+ character key.

### Production mode fails to start

`MODE=production` enforces: `SECRET_KEY` >= 32 chars and not the default, `DATABASE_PASSWORD` set, `GOOGLE_CLIENT_ID` set. Fix the values in `.env`.
