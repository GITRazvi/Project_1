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
