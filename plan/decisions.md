# Decisions

## 2026-11-12 — Start with a managed deployment platform

Use a beginner-friendly managed platform for the first deployment, then repeat
selected parts on AWS. This keeps the early focus on building and shipping while
leaving room to learn core cloud services in a second phase.

## 2026-11-12 — Use TypeScript across web and API

TypeScript supports the learning goal of working with Node.js and React while
providing a consistent type system across the full stack.

## 2026-11-12 — Use an npm workspace monorepo

Keep the web client and API in `apps/` under one repository. This makes it easy
to run, test, version, and deploy the two parts together while still keeping
their dependencies and responsibilities separate.

## 2026-11-12 — Containerize the development environment first

Use Docker Compose to run the Vite web app and Fastify API as separate
development containers with source mounts and a named dependency volume. This
provides a simple first container workflow before adding PostgreSQL and a
production deployment configuration.

## 2026-11-13 — Build Cloud Notes as the learning application

Cloud Notes has a deliberately small CRUD feature set but naturally exercises
the complete path from React through an API to PostgreSQL and a cloud deployment.
The first version uses temporary in-memory storage so the API and UI can be
learned before database complexity is introduced.

## 2026-11-16 — Use PostgreSQL in Docker Compose for persistent development data

Run PostgreSQL as a separate Compose service with a named volume. The Node.js
API connects to it through the private Compose network, which mirrors the
application-to-database boundary used in cloud deployments. The API will create
the initial `notes` table on startup; later, this can evolve into versioned
database migrations.

## 2026-11-16 — Test the API with PostgreSQL in CI

Use Vitest with Fastify's in-process request injection for API tests, while
connecting the repository to a temporary PostgreSQL service in GitHub Actions.
This checks the real SQL-backed CRUD behavior without exposing a network port
for the API during tests.

## 2026-11-17 — Use database sessions with HTTP-only cookies for first-party login

The API will hash passwords with bcrypt, store opaque session IDs in PostgreSQL,
and send the ID only in an HTTP-only, same-site cookie. This is a simple
first-party session model that keeps password hashes and session identifiers out
of React state and browser JavaScript. Email verification, password reset, and
external identity providers remain future work.

## 2026-11-18 — Use one long-lived CI branch for the current learning workflow

Future work will be committed to `feature/ci` and merged into `main` after the
GitHub Actions workflow passes. This keeps `main` as the reviewed baseline
while avoiding extra branch-management complexity during the learning project.

## 2026-11-18 — Test React behavior with mocked API responses

Use Vitest, React Testing Library, and JSDOM for fast interface tests. These
tests mock HTTP responses and verify what a user sees and can do, while the API
suite remains responsible for exercising the real PostgreSQL-backed behavior.

## 2026-11-19 — Use one shared ESLint configuration

Use a root ESLint flat configuration so the API and web application are checked
with one `npm run lint` command. Apply Node globals to the API and browser plus
React Hooks rules to the web app, then run lint before build and test in CI.

## 2026-11-20 — Store hashes of opaque session secrets

Replace UUID-only session cookies with a UUID session ID plus a 256-bit random
secret. Store only a SHA-256 hash of the secret in PostgreSQL and require both
parts to authenticate. This keeps sessions revocable in the database while
preventing a database session row from being replayed as a browser cookie.

## 2026-11-23 — Use numbered SQL migrations with a lightweight runner

Keep schema changes as numbered SQL files in the API repository instead of
creating tables when the server starts. A small Node runner tracks applied files
in PostgreSQL and uses an advisory lock so concurrent API instances cannot apply
the same migration at once. This avoids adding a migration framework while
making the deployment process explicit and repeatable.

## 2026-11-24 — Build separate production API and web images

Use a multi-stage Node build to compile both applications, then publish a small
Node API image and an Nginx web image. Nginx serves the static React build and
proxies API requests over the private Compose network, giving the browser one
application origin. Keep production Compose separate from the source-mounted
development services and require HTTPS for production session cookies.

## 2026-11-24 — Use Caddy for home LAN HTTPS

Use Caddy as the home-server reverse proxy in front of the production web
container. It will provide the HTTPS endpoint required by secure session cookies
while forwarding traffic to containers on the local machine. Internet exposure,
router port forwarding, and public DNS remain intentionally out of scope.

## 2026-11-24 — Run Caddy inside the production Compose stack

Run the official Caddy container as the only service that publishes ports 80
and 443. Persist Caddy's `/data` volume because it contains the internal CA and
certificates, and use an internal CA for the reserved home-LAN IP address. The
Windows Caddy installation remains available for local inspection, but the
containerized configuration is the deployed path.

## 2026-11-25 — Support HTTPS clients connecting by LAN IP

Set Caddy's default TLS server name to the configured LAN address so clients
that omit SNI for IP addresses can still receive the correct certificate.

## 2026-11-26 — Limit login requests by direct connection address

Use an in-memory limit of 10 login requests per 15 minutes, including successful
requests. The API does not trust client-supplied forwarded IP headers. Behind the
current proxy, users share the limit; counters reset on restart and are not
shared across API instances. A multi-instance deployment will need a shared
store and explicitly configured trusted proxies.

## 2026-11-26 — Separate liveness from service status

Keep `/api/health` independent of PostgreSQL for container liveness. Add an
on-demand `/api/status` check for database connectivity and report failures
without exposing database errors. Use the existing JSON logger with sensitive
header redaction and structured status-check warnings.

## 2026-11-26 — Publish immutable-version image pairs after CI

After the main-branch build-and-test job passes, publish API and web images to
GHCR with the full tested commit SHA. Keep deployment manual using a Compose
override so the home server owner chooses the version and timing; do not assume
rolling back containers reverses database migrations.

## 2026-11-27 — Restrict proxy trust and restore only into new databases

Use separate Docker networks with fixed adjacent-proxy addresses. Caddy replaces
incoming forwarding headers, Nginx trusts only Caddy, and Fastify trusts only
Nginx. Client address preservation through Docker Desktop must be verified on
the host. Backups use PostgreSQL custom archives; the restore helper creates a
new database and does not overwrite or automatically switch the live app.

Store simple per-note tags as a bounded text array and filter the user's loaded
notes in the browser. This keeps the initial search implementation small and
retains existing API behavior for callers that omit tags.

## 2026-11-27 — Schedule local backups in the production stack

Run a PostgreSQL client container that creates an archive on service startup
and every 40 days thereafter, retrying failures hourly. Keep archives in the
local ignored `backups/` folder without automatic deletion, per the user's
preference. The database and its local backup still share the PC's failure risk.
