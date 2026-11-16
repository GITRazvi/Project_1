import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { PostgresNotesRepository } from './postgres-notes-repository.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running API tests.');
}

const notesRepository = await PostgresNotesRepository.connect(databaseUrl);
const app = buildApp({ notesRepository });

beforeAll(async () => app.ready());
afterAll(async () => {
  await app.close();
  await notesRepository.close();
});

describe('Cloud Notes API', () => {
  it('creates, lists, updates, and deletes a PostgreSQL-backed note', async () => {
    let noteId: string | undefined;

    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/notes',
        payload: { title: 'CI note', content: 'Created during an automated test.' },
      });
      const createdNote = JSON.parse(created.body) as { id: string; title: string; content: string };
      noteId = createdNote.id;

      expect(created.statusCode).toBe(201);
      expect(createdNote.title).toBe('CI note');

      const listed = await app.inject({ method: 'GET', url: '/api/notes' });
      const listedNotes = JSON.parse(listed.body) as Array<{ id: string }>;
      expect(listed.statusCode).toBe(200);
      expect(listedNotes.some((note) => note.id === noteId)).toBe(true);

      const updated = await app.inject({
        method: 'PATCH',
        url: `/api/notes/${noteId}`,
        payload: { title: 'Updated CI note', content: 'The note was updated in PostgreSQL.' },
      });
      const updatedNote = JSON.parse(updated.body) as { title: string; content: string };

      expect(updated.statusCode).toBe(200);
      expect(updatedNote).toMatchObject({
        title: 'Updated CI note',
        content: 'The note was updated in PostgreSQL.',
      });

      const deleted = await app.inject({ method: 'DELETE', url: `/api/notes/${noteId}` });
      expect(deleted.statusCode).toBe(204);
      noteId = undefined;
    } finally {
      if (noteId) await app.inject({ method: 'DELETE', url: `/api/notes/${noteId}` });
    }
  });

  it('rejects invalid and missing notes', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { title: '', content: '' },
    });
    const missingUpdate = await app.inject({
      method: 'PATCH',
      url: '/api/notes/00000000-0000-0000-0000-000000000000',
      payload: { title: 'Missing', content: 'Missing' },
    });
    const missingDelete = await app.inject({
      method: 'DELETE',
      url: '/api/notes/00000000-0000-0000-0000-000000000000',
    });

    expect(invalid.statusCode).toBe(400);
    expect(missingUpdate.statusCode).toBe(404);
    expect(missingDelete.statusCode).toBe(404);
  });
});
