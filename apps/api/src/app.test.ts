import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { PostgresAuthRepository } from './postgres-auth-repository.js';
import { PostgresNotesRepository } from './postgres-notes-repository.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running API tests.');
}

const authRepository = await PostgresAuthRepository.connect(databaseUrl);
const notesRepository = await PostgresNotesRepository.connect(databaseUrl);
const app = buildApp({ authRepository, notesRepository });

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }): string {
  const header = response.headers['set-cookie'];
  const cookie = Array.isArray(header) ? header[0] : header;

  if (!cookie) throw new Error('Expected the response to set a session cookie.');

  return cookie.split(';')[0];
}

beforeAll(async () => app.ready());
afterAll(async () => {
  await app.close();
  await notesRepository.close();
  await authRepository.close();
});

describe('Cloud Notes API', () => {
  it('registers, logs in, owns notes, and logs out', async () => {
    const email = `ci-${randomUUID()}@example.test`;
    const password = 'correct-horse-battery-staple';
    let userId: string | undefined;
    let noteId: string | undefined;

    try {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, password },
      });
      const registeredUser = JSON.parse(registered.body) as { id: string; email: string };
      const firstSession = sessionCookie(registered);
      userId = registeredUser.id;

      expect(registered.statusCode).toBe(201);
      expect(registeredUser.email).toBe(email);

      const created = await app.inject({
        method: 'POST',
        url: '/api/notes',
        headers: { cookie: firstSession },
        payload: { title: 'CI note', content: 'Created during an automated test.' },
      });
      const createdNote = JSON.parse(created.body) as { id: string; title: string };
      noteId = createdNote.id;

      expect(created.statusCode).toBe(201);
      expect(createdNote.title).toBe('CI note');

      const listed = await app.inject({
        method: 'GET',
        url: '/api/notes',
        headers: { cookie: firstSession },
      });
      const listedNotes = JSON.parse(listed.body) as Array<{ id: string }>;
      expect(listedNotes.some((note) => note.id === noteId)).toBe(true);

      const updated = await app.inject({
        method: 'PATCH',
        url: `/api/notes/${noteId}`,
        headers: { cookie: firstSession },
        payload: { title: 'Updated CI note', content: 'The note was updated in PostgreSQL.' },
      });
      expect(updated.statusCode).toBe(200);

      const loggedOut = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: firstSession },
      });
      const afterLogout = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: firstSession },
      });

      expect(loggedOut.statusCode).toBe(204);
      expect(afterLogout.statusCode).toBe(401);

      const loggedIn = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });
      expect(loggedIn.statusCode).toBe(200);
      expect(sessionCookie(loggedIn)).toContain('cloud_notes_session=');
    } finally {
      if (userId && noteId) await notesRepository.delete(userId, noteId);
      if (userId) await authRepository.deleteUser(userId);
    }
  });

  it('rejects unauthenticated, invalid, and incorrect credentials', async () => {
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/notes' });
    const invalidRegistration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', password: 'short' },
    });
    const incorrectLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'missing@example.test', password: 'correct-horse-battery-staple' },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(invalidRegistration.statusCode).toBe(400);
    expect(incorrectLogin.statusCode).toBe(401);
  });
});
