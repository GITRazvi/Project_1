# Cloud Notes — Minimum Viable Product

## Purpose

Cloud Notes is a small personal notes application. It gives one person a place
to write and manage notes, then becomes a practical vehicle for learning how a
browser, API, database, containers, version control, and cloud deployment work
together.

## First user story

> As a user, I can create, read, edit, and delete my notes so I can keep a
> simple personal list of information.

## MVP features

- Show all notes, newest first.
- Create a note with a title and content.
- Edit a note.
- Delete a note after a confirmation prompt.
- Show useful empty, loading, and error states in the web app.

## Note data

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Unique identifier for a note. |
| `title` | string | Short label for the note. |
| `content` | string | Main note text. |
| `createdAt` | ISO date string | When the note was created. |
| `updatedAt` | ISO date string | When the note was last changed. |

## First API contract

| Method | Route | Result |
| --- | --- | --- |
| `GET` | `/api/notes` | List notes. |
| `POST` | `/api/notes` | Create a note. |
| `PATCH` | `/api/notes/:id` | Update a note. |
| `DELETE` | `/api/notes/:id` | Delete a note. |

The first version will keep notes in the API process memory. The data will
reset when the API restarts; that is intentional for the first learning step.
PostgreSQL will replace this temporary storage in the database milestone.

## Not part of the first version

- Sign-in, accounts, or shared notes.
- File attachments, search, tags, or rich-text editing.
- A cloud database or public deployment.

## Build order

1. Implement `GET /api/notes` and `POST /api/notes` with temporary in-memory
   storage.
2. Add a form and note list in React.
3. Add editing and deletion.
4. Add PostgreSQL persistence, tests, authentication, and cloud deployment in
   later milestones.
