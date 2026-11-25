# Roadmap

## Project goal

Build a small full-stack application while learning Git, GitHub, containers,
continuous integration, and cloud deployment.

## Proposed stack

- Web: React, TypeScript, and Vite
- API: Node.js, TypeScript, and Fastify or Express
- Data: PostgreSQL
- Local infrastructure: Docker and Docker Compose
- Source control and automation: Git, GitHub, and GitHub Actions
- First deployment target: a beginner-friendly managed platform; later, AWS

## Milestones

- [x] 1. Define the application concept and minimum viable feature set.
- [ ] 2. Set up Git conventions, issue/branch workflow, and repository docs.
- [x] 3. Create the TypeScript React web application.
- [x] 4. Create the Node.js TypeScript API and connect it to the web app.
- [x] 5. Add PostgreSQL and run the complete stack locally with Docker Compose.
  - [x] Containerize the web and API development services.
  - [x] Add PostgreSQL and connect the API to it.
  - [x] Add versioned database migrations for consistent schema updates.
- [x] 6. Add authentication, validation, and automated tests.
  - [x] Add PostgreSQL-backed API tests.
  - [x] Add first-party authentication and API coverage.
  - [x] Add broader UI test coverage.
  - [x] Harden database-backed cookie sessions and cover their security behavior.
- [ ] 7. Add GitHub Actions for linting, tests, and builds.
  - [x] Add the lint, build, and test GitHub Actions workflow.
  - [ ] Push the updated test suite and inspect its GitHub Actions run.
- [ ] 8. Deploy the application, configure secrets, and document operations.
  - [x] Create production API and web container images.
  - [x] Add and configure Caddy as the HTTPS reverse-proxy container for home LAN hosting.
- [ ] 9. Rebuild selected cloud components on AWS to deepen cloud knowledge.

## Current focus

Start the home production stack with a real `.env.production` file and trust its Caddy certificate on LAN client devices.
