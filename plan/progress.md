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
