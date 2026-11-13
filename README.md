# Cloud Learning Project

A full-stack TypeScript starter for learning cloud development and version
control. It contains a React/Vite web app and a Fastify Node.js API.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Start locally

```powershell
npm install
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
`http://localhost:3001` and connects the Vite proxy to the API container.
Source changes are mounted into the containers, so the development servers
reload them. Stop the environment with `Ctrl+C`, then remove its containers with:

```powershell
docker compose down
```

## Useful commands

```powershell
npm run build  # Build both applications
npm run dev    # Start the API and web app together
```

## Structure

- `apps/web` — React, TypeScript, and Vite client
- `apps/api` — Fastify and TypeScript API
- `plan` — the continuously maintained roadmap, progress, and decisions
