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
