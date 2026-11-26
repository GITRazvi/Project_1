# Cloud Learning Project

A full-stack TypeScript starter for learning cloud development and version
control. It contains a React/Vite web app and a Fastify Node.js API.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Start locally

The API now requires PostgreSQL. Docker Compose is the easiest way to start the
complete local environment. If you run the API directly, first set
`DATABASE_URL` to a running PostgreSQL database:

```powershell
npm install
$env:DATABASE_URL = "postgresql://cloud_notes:cloud_notes@localhost:5432/cloud_notes"
npm run migrate
npm run dev
```

Open `http://localhost:5173`. The page calls the API through Vite's local proxy;
the health status confirms both services are running.

## Run with Docker

With Docker Desktop running, start both development containers:

```powershell
docker compose up --build
```

Open `http://localhost:5173`. Docker Compose exposes the API at
`http://localhost:3001`, PostgreSQL at `localhost:5432`, and connects the Vite
proxy to the API container. The database stores its data in the named
`postgres_data` volume, so notes survive API and database-container restarts.
Docker Compose applies database migrations before the API starts. Source changes
are mounted into the containers, so the development servers reload them. Stop
the environment with `Ctrl+C`, then remove its containers with:

```powershell
docker compose down
```

For a completely fresh local database, run `docker compose down --volumes`.
This deletes the local PostgreSQL volume and all saved notes.

## Run the production containers locally

The production setup builds the React app once, serves it with Nginx, and runs
the compiled API without source mounts or file watchers. A Caddy container is
the only public-facing service: it provides HTTPS and proxies traffic to Nginx.
The production stack uses a separate Compose project and database volume from
development.

```powershell
Copy-Item .env.production.example .env.production
# Edit .env.production and replace POSTGRES_PASSWORD.
npm run prod
```

Open `https://` followed by the `CADDY_HOST` value from `.env.production`, such
as `https://192.168.68.52`. Caddy uses an internal HTTPS certificate for LAN
hosting, so devices must trust Caddy's root certificate before browsers accept
the connection and secure login cookies work.

After the stack has started, export the certificate on this Windows PC:

```powershell
docker compose --env-file .env.production --file compose.production.yaml cp caddy:/data/caddy/pki/authorities/local/root.crt .\caddy-local-root.crt
Import-Certificate -FilePath .\caddy-local-root.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Import the same exported certificate into the trust store of each LAN device
that will use the app. This setup is LAN-only: do not add router port forwarding
for ports 80 or 443. Stop the production containers while preserving their
database and Caddy certificate data with:

```powershell
docker compose --env-file .env.production --file compose.production.yaml down
```

## Useful commands

```powershell
npm run lint   # Check API and web code for common mistakes
npm run migrate # Apply new database schema changes
npm run prod    # Build and start production-style containers
npm run build  # Build both applications
npm run dev    # Start the API and web app together
```

## Continuous integration

The GitHub Actions workflow in `.github/workflows/ci.yml` runs for pull
requests targeting `main` and for pushes to `main`. It starts a temporary
PostgreSQL service, installs dependencies with `npm ci`, lints the code, builds
both applications, applies database migrations, and runs the API and React
interface test suites.

To run the same tests locally while Docker Compose is running:

```powershell
$env:DATABASE_URL = "postgresql://cloud_notes:cloud_notes@localhost:5432/cloud_notes"
npm run lint
npm test
```

The API test suite creates and removes its own notes; the React tests mock API
responses to check browser behavior without needing a running API. After a push
to `main` passes these checks, a second job builds and publishes API and web
images to GitHub Container Registry (GHCR). Each is tagged with the full commit
SHA. Pull requests run checks but do not publish images; deployment to the home
server remains manual.

## Deploy a published image version at home

After merging, open GitHub Actions and wait for the **Publish production images**
job to succeed. Its job summary lists both image names and their shared full
commit SHA. On the home server, update the repository files to the matching
commit, including `compose.registry.yaml`, `compose.production.yaml`, and the
Caddy configuration. Keep the existing `.env.production` file and Docker
volumes; do not overwrite them.

If the packages are private, first authenticate Docker to GHCR as an account
with permission to read them. GitHub supports a personal access token (classic)
with `read:packages`; keep the token private and use `--password-stdin` as
described in [GitHub's registry authentication guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry).

In PowerShell, replace the example SHA with the full SHA from the successful
publishing job. The image base must be lowercase:

```powershell
$env:IMAGE_BASE = 'ghcr.io/gitrazvi/project_1'
$env:IMAGE_VERSION = '<full-published-commit-sha>'
docker compose --env-file .env.production -f compose.production.yaml -f compose.registry.yaml pull api web
docker compose --env-file .env.production -f compose.production.yaml -f compose.registry.yaml up -d --no-build --pull never
```

Pull both images successfully before running the second command. Docker replaces
the API and web containers while keeping the existing database and Caddy
volumes. The API runs pending migrations before starting. Verify the app and
status screen afterward. Record the deployed SHA: to return to an earlier
version, select its SHA and repeat these commands **only after checking database
migration compatibility**. Rolling back images does not undo migrations.

Image publishing can be disabled by repository or package permissions, and new
GHCR packages may be private. Check the Actions job and package settings if the
first publish or pull fails. The workflow does not log in to or update your home
server automatically.

## Database migrations

The API keeps versioned SQL files in `apps/api/migrations`. `npm run migrate`
creates the `schema_migrations` record table, runs each unapplied numbered file
once, and records it. It is safe to run repeatedly: a second run makes no
changes.

To change the database later, add a new file such as
`002_add_note_tags.sql`; do not edit a migration that has already been applied
to a shared environment. Migrations run before the Docker Compose API starts
and as a dedicated CI step.

## Authentication

Cloud Notes has a simple first-party account system. Create an account from the
web app with an email address and a password between 8 and 72 characters. The
API hashes the password with bcrypt before storing it in PostgreSQL. After a
successful sign-up or login, the API sends an HTTP-only, same-site session
cookie; the browser automatically includes it in later requests, but React
cannot read it. The cookie holds an opaque, random session token, while
PostgreSQL stores only a SHA-256 hash of its secret. A token expires after seven
days, and production cookies are sent only over HTTPS.

Every note query includes the authenticated user's ID, so users can view and
change only their own notes. This first version intentionally does not include
email verification, password reset, multi-factor authentication, or OAuth.

Login accepts at most 10 attempts per 15 minutes per direct connection address;
all attempts count, including successful ones. Further attempts return HTTP 429
with a retry time. In production, requests arrive through the web proxy, so LAN
users currently share the same limit. Counters are held in API process memory,
reset on restart, and are not shared across multiple API instances. This is a
basic safeguard, not complete protection against distributed attacks.

## Service status and logs

Use **Check status** on the login or notes screen to check whether the API is
reachable and whether it can run a PostgreSQL query. This is an on-demand
snapshot; a loaded web page does not guarantee that its server is still running.
The API's `/api/health` endpoint checks that the process responds, while
`/api/status` also checks database connectivity and returns HTTP 503 if that
check fails.

The API writes structured JSON request logs and a warning when a database status
check fails. View production logs with:

```powershell
docker compose --env-file .env.production --file compose.production.yaml logs --tail=100 api
```

Request bodies are not logged by default; cookie and authorization headers are
also configured for redaction. Avoid putting secrets into URLs or log messages.

## Structure

- `apps/web` — React, TypeScript, and Vite client
- `apps/api` — Fastify and TypeScript API
- `compose.yaml` — local web, API, and PostgreSQL services
- `.github/workflows/ci.yml` — GitHub Actions build and test pipeline
- `plan` — the continuously maintained roadmap, progress, and decisions
