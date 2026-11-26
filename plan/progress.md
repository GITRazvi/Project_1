# Progress Log

## 2026-11-12

- Created the living plan structure and agent instructions.
- Defined the initial learning stack and high-level roadmap.
- Started basic full-stack setup: a Vite React client and Node.js TypeScript API
  will live in one npm workspace.
- Created `apps/web` with React, TypeScript, Vite, and a proxy for `/api` calls.
- Created `apps/api` with Fastify, TypeScript, and `GET /api/health`.
- Added root scripts to run and build both applications together.
- Verified `npm run build` succeeds and the API health endpoint returns HTTP 200.
- Verified `npm run dev` starts the API on port 3001 and Vite on port 5173.
- Started Docker Compose setup for the existing web and API services. PostgreSQL
  remains a later milestone.
- Added `Dockerfile`, `compose.yaml`, and `.dockerignore` for the web and API
  development containers.
- Verified `docker compose up --build` builds and starts both services; the API
  health check passes, the web app returns HTTP 200, and Vite proxies `/api`
  successfully to the API container.
- Started the Docker Compose environment for local use; the API is healthy and
  the web client is available on port 5173.
- Updated the repository working agreement: every request now requires a clear,
  beginner-friendly explanation of how the relevant work operates.
- Next: choose the application concept and MVP features.

## 2026-11-13

- Chose **Cloud Notes** as the project application.
- Defined the MVP, note data, first API endpoints, exclusions, and build order
  in `plan/mvp.md`.
- Completed roadmap milestone 1. Next: establish the Git workflow, then build
  the first notes API endpoints with temporary in-memory storage.

## 2026-11-16

- Began implementation of the first Cloud Notes API slice: list and create
  notes with temporary in-memory storage.
- Added `GET /api/notes` and `POST /api/notes`, backed by a temporary in-memory
  `NotesStore`.
- Added input validation: title and content are required, titles are limited to
  120 characters, and content is limited to 10,000 characters.
- Verified the workspace build; checked empty-list, create, list-after-create,
  and invalid-input responses through Fastify's internal request injection.
- Added a responsive Cloud Notes interface with a creation form, loading, empty,
  error, retry, success, and saving states.
- Connected the React form to `POST /api/notes` and the notes list to
  `GET /api/notes`.
- Verified the workspace build and confirmed in the running browser that a
  submitted note is saved and immediately rendered in the notes list.
- Next: add note editing and deletion across the API and interface.
- Began implementing note editing and deletion across the API and React app.
- Added `PATCH /api/notes/:id` and `DELETE /api/notes/:id`; both return `404`
  for a note ID that does not exist.
- Added Edit, Save Changes, Cancel, and Delete controls to the note interface.
  Delete requires confirmation before the browser sends the request.
- Verified the full API lifecycle: create (`201`), update (`200`), list with
  updated content, delete (`204`), empty list after deletion, and missing-note
  responses (`404`). The full workspace build succeeds.
- Completed the first Cloud Notes CRUD feature set. Next: establish the Git
  workflow and write automated tests before adding PostgreSQL persistence.
- Started PostgreSQL integration: replace runtime note storage with a database
  repository and add a PostgreSQL container to Docker Compose.
- Added the `pg` driver and a PostgreSQL-backed notes repository. The running
  server creates the `notes` table if it does not already exist.
- Added the `db` PostgreSQL service, database health checks, `DATABASE_URL`, and
  a persistent `postgres_data` volume to Docker Compose.
- Rebuilt the three-service stack successfully. All services are running:
  PostgreSQL, API, and web client.
- Verified persistence by creating a note through the live API, restarting only
  the API container, and retrieving the same note afterward. Removed that
  temporary verification note; the database is clean.
- Completed roadmap milestone 5. Next: establish the Git workflow and add
  automated tests before preparing a cloud deployment.
- Started CI setup: add automated API tests that run against temporary
  PostgreSQL and configure GitHub Actions to build and test every change.
- Added Vitest API tests for PostgreSQL-backed create, list, update, delete,
  invalid-input, and not-found behavior. Each test removes the note it creates.
- Added `.github/workflows/ci.yml`: GitHub Actions starts a temporary
  PostgreSQL service, runs `npm ci`, builds both applications, and runs tests on
  pull requests to `main` and pushes to `main`.
- Verified the local equivalents: `npm run build` and `npm test` both pass
  against the Docker PostgreSQL database.
- CI will activate on the configured GitHub remote after these changes are
  committed and pushed. CD remains intentionally unconfigured until a cloud
  hosting provider and deployment credentials are selected.

## 2026-11-17

- Started simple account authentication: hashed passwords, database-backed
  sessions, and note ownership.
- Added PostgreSQL `users` and `sessions` tables, bcrypt password hashing, and
  HTTP-only, same-site session cookies.
- Added account routes for sign-up, log-in, log-out, and session lookup. Notes
  now require a session and are filtered by the authenticated user ID.
- Added the React log-in/sign-up screen and a log-out control in the notes app.
- Verified `npm run build`, the expanded PostgreSQL-backed API suite, the
  running API container, and the browser login screen. Test users and notes are
  removed after each test.
- Completed roadmap milestone 6. Next: commit and push the authentication
  changes, then inspect the expanded CI run on GitHub.

## 2026-11-18

- Adopted a merge-based workflow: make future changes on the long-lived
  `feature/ci` branch, push it to GitHub, and merge it into `main` after CI
  passes.
- Started broader UI test coverage for the React login and notes interface.
- Added Vitest and React Testing Library coverage for the initial login screen,
  switching to sign-up, rendering an authenticated user's notes, and logging
  out.
- Updated the root `npm test` command and GitHub Actions step so CI runs both
  the PostgreSQL-backed API tests and the React interface tests.
- Verified `npm run build` succeeds. Verified `npm test` passes with two API
  tests and three React tests against the local Docker PostgreSQL service.

## 2026-11-19

- Started linting setup for the TypeScript API and React client so CI can catch
  common code issues before the build and test stages.
- Added a shared ESLint flat configuration for Node API files and browser-based
  React files, including React Hooks checks. Underscore-prefixed placeholders
  are allowed for intentionally unused function parameters.
- Added `npm run lint` and inserted it ahead of build and test stages in GitHub
  Actions. Verified lint, the workspace build, and all five automated tests
  pass locally. npm audit reports zero known vulnerabilities.

## 2026-11-20

- Started hardening the first-party session implementation: session cookies
  will carry cryptographically random opaque tokens while PostgreSQL stores only
  token hashes, reducing the impact of a database disclosure.
- Replaced UUID-only cookie values with a session ID plus 256-bit random secret.
  PostgreSQL now stores only the secret's SHA-256 hash, rejects altered tokens,
  removes expired sessions during new-session creation, and indexes expiry time.
- Added a safe schema migration: any legacy session without a token hash is
  deleted, which intentionally signs out older sessions during this upgrade.
- Verified lint and the workspace build. Verified all five API and React tests,
  including cookie attributes, tampered-session rejection, and logout revocation.

## 2026-11-23

- Started replacing API startup-time table creation with numbered SQL migrations
  and a migration runner that records applied files in PostgreSQL.
- Added `001_initial_schema.sql`, a migration runner with PostgreSQL advisory
  locking, and the `schema_migrations` table. The runner applies each numbered
  file once, allowing repeated safe executions.
- Removed table-creation logic from the API repositories. Docker Compose, CI,
  and API tests now run migrations before using the database.
- Verified lint and the workspace build. Applied the migration to the local
  Docker PostgreSQL database, confirmed the second run made no changes, passed
  all five tests, and validated the Compose configuration.

## 2026-11-24

- Started production container setup: build immutable API and web images without
  source mounts or development watchers, while keeping the existing Compose file
  for local development.
- Added a multi-stage production Dockerfile: a non-root compiled Node API image
  runs migrations before startup, while an Nginx image serves the built React
  app and proxies `/api` internally to the API container.
- Added `compose.production.yaml` and `.env.production.example`. Production
  services have no source mounts, do not expose PostgreSQL publicly, and use a
  separate Compose project from development.
- Verified lint, builds, production Compose validation, and a full isolated
  production-stack run. The web app and proxied API health endpoint both
  returned HTTP 200; the temporary test containers and volume were removed.
- Installed and verified Caddy v2.11.9 through Windows Package Manager as the
  local HTTPS reverse-proxy tool for the planned home LAN deployment.
- Started moving Caddy into the production Docker Compose stack so HTTPS and
  certificate data travel with the application configuration.
- Added the official Caddy v2.11.9 Alpine container as the only production
  service publishing ports 80 and 443. The Nginx web container, API, and
  PostgreSQL now remain private to the Docker network.
- Configured Caddy with an internal certificate for the reserved LAN IP
  `192.168.68.52`; its persistent volumes retain the local CA and certificate.
- Verified the full isolated stack: HTTP redirects to HTTPS and the Caddy HTTPS
  route successfully returned the proxied API health response. Removed the
  temporary containers, network, and volumes after verification.

## 2026-11-25

- Started preparing the persistent home-LAN stack and ensuring its environment
  file cannot be committed accidentally.
- Created the ignored local production environment file with a generated database
  password and started the production Compose stack. Exported Caddy's public
  root certificate; Windows trust-store installation remains unconfirmed.
- Set Caddy's default TLS server name to the configured LAN IP for clients that
  omit SNI. Verified the API health endpoint over HTTPS with certificate checking
  against the exported root certificate. Browser login and LAN-device access
  remain to be tested after certificate trust is configured.

## 2026-11-26

- The user confirmed access from the host and another LAN device.
- Started login rate limiting and PostgreSQL-backed security tests for expired
  sessions and cross-user note access.
- Limited login to 10 requests per 15 minutes per direct connection address;
  requests through the production proxy share one limit. Added tests for HTTP
  429, expired sessions, and another user's attempted list, edit, and deletion.
- Verified all four PostgreSQL-backed API tests and all three React tests pass.
- Started adding an on-demand status view and database readiness check while
  preserving the existing API liveness endpoint.
- Added `/api/status` with a PostgreSQL query, a status panel on the login and
  notes screens, and structured database-failure warnings with sensitive header
  redaction. The existing `/api/health` remains a process-only liveness check.
- Verified lint, builds, five API tests and five web tests, including healthy,
  database-failure, and API-unreachable status behavior.
- Started CI image publishing and a manual, version-selected home deployment
  process. Existing security and operations changes remain in the worktree.
- Added a CI job that publishes API and web images to GHCR using the tested main
  commit's full SHA, plus a Compose override and manual deployment instructions.
  Both production image targets build locally; registry publishing requires the
  workflow to be pushed and run on GitHub before it can be verified.
