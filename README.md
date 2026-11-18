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
Source changes are mounted into the containers, so the development servers
reload them. Stop the environment with `Ctrl+C`, then remove its containers with:

```powershell
docker compose down
```

For a completely fresh local database, run `docker compose down --volumes`.
This deletes the local PostgreSQL volume and all saved notes.

## Useful commands

```powershell
npm run build  # Build both applications
npm run dev    # Start the API and web app together
```

## Continuous integration

The GitHub Actions workflow in `.github/workflows/ci.yml` runs for pull
requests targeting `main` and for pushes to `main`. It starts a temporary
PostgreSQL service, installs dependencies with `npm ci`, builds both
applications, and runs the API and React interface test suites.

To run the same tests locally while Docker Compose is running:

```powershell
$env:DATABASE_URL = "postgresql://cloud_notes:cloud_notes@localhost:5432/cloud_notes"
npm test
```

The API test suite creates and removes its own notes; the React tests mock API
responses to check browser behavior without needing a running API. Continuous
deployment is not configured yet because it requires a chosen cloud host and
deployment secrets.

## Authentication

Cloud Notes has a simple first-party account system. Create an account from the
web app with an email address and a password between 8 and 72 characters. The
API hashes the password with bcrypt before storing it in PostgreSQL. After a
successful sign-up or login, the API sends an HTTP-only session cookie; the
browser automatically includes it in later requests, but React cannot read it.

Every note query includes the authenticated user's ID, so users can view and
change only their own notes. This first version intentionally does not include
email verification, password reset, multi-factor authentication, or OAuth.

## Structure

- `apps/web` — React, TypeScript, and Vite client
- `apps/api` — Fastify and TypeScript API
- `compose.yaml` — local web, API, and PostgreSQL services
- `.github/workflows/ci.yml` — GitHub Actions build and test pipeline
- `plan` — the continuously maintained roadmap, progress, and decisions
