import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { runMigrations } from './migrations.js';
import { PostgresAuthRepository } from './postgres-auth-repository.js';
import { PostgresNotesRepository } from './postgres-notes-repository.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running API tests.');
}

await runMigrations(databaseUrl);

const authRepository = await PostgresAuthRepository.connect(databaseUrl);
const notesRepository = await PostgresNotesRepository.connect(databaseUrl);
const checkDatabase = () => notesRepository.checkConnection();
const app = buildApp({ authRepository, notesRepository, checkDatabase });

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }): string {
  const header = sessionCookieHeader(response);

  return header.split(';')[0];
}

function sessionCookieHeader(response: { headers: Record<string, string | string[] | undefined> }): string {
  const header = response.headers['set-cookie'];
  const cookie = Array.isArray(header) ? header[0] : header;

  if (!cookie) throw new Error('Expected the response to set a session cookie.');

  return cookie;
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
      expect(firstSession).toMatch(/^cloud_notes_session=[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
      expect(sessionCookieHeader(registered)).toContain('HttpOnly');
      expect(sessionCookieHeader(registered)).toContain('SameSite=Lax');
      expect(sessionCookieHeader(registered)).toContain('Max-Age=604800');

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

      const tamperedSession = `${firstSession.slice(0, -1)}${firstSession.endsWith('A') ? 'B' : 'A'}`;
      const tamperedSessionResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: tamperedSession },
      });
      expect(tamperedSessionResponse.statusCode).toBe(401);

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
      expect(sessionCookie(loggedIn)).toMatch(/^cloud_notes_session=[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
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

  it('limits login attempts and returns a retry delay', async () => {
    const isolatedApp = buildApp({ authRepository, notesRepository, checkDatabase });
    try {
      for (let attempt = 0; attempt < 10; attempt++) {
        const response = await isolatedApp.inject({
          method: 'POST', url: '/api/auth/login',
          payload: { email: 'missing@example.test', password: 'incorrect-password' },
        });
        expect(response.statusCode).toBe(401);
      }
      const blocked = await isolatedApp.inject({
        method: 'POST', url: '/api/auth/login',
        payload: { email: 'missing@example.test', password: 'incorrect-password' },
      });
      expect(blocked.statusCode).toBe(429);
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      const healthy = await isolatedApp.inject({ method: 'GET', url: '/api/health' });
      expect(healthy.statusCode).toBe(200);
    } finally {
      await isolatedApp.close();
    }
  });

  it('uses forwarded client addresses only from the configured trusted proxy', async () => {
    const isolatedApp = buildApp({ authRepository, notesRepository, checkDatabase, trustedProxy: '172.29.111.2' });
    const attempt = (remoteAddress: string, forwarded: string) => isolatedApp.inject({
      method: 'POST', url: '/api/auth/login', remoteAddress,
      headers: { 'x-forwarded-for': forwarded },
      payload: { email: 'missing@example.test', password: 'incorrect-password' },
    });
    try {
      for (let i = 0; i < 10; i++) expect((await attempt('172.29.111.2', '192.168.68.10')).statusCode).toBe(401);
      expect((await attempt('172.29.111.2', '192.168.68.10')).statusCode).toBe(429);
      expect((await attempt('172.29.111.2', '192.168.68.11')).statusCode).toBe(401);
      for (let i = 0; i < 10; i++) expect((await attempt('10.0.0.9', `192.168.70.${i}`)).statusCode).toBe(401);
      expect((await attempt('10.0.0.9', '192.168.70.99')).statusCode).toBe(429);
    } finally { await isolatedApp.close(); }
  });

  it('reports database availability without exposing errors', async () => {
    const healthy = await app.inject({ method: 'GET', url: '/api/status' });
    expect(healthy.statusCode).toBe(200);
    expect(healthy.json()).toEqual({ api: 'available', database: 'available' });
    const failingApp = buildApp({ authRepository, notesRepository, checkDatabase: async () => { throw new Error('secret connection details'); } });
    try {
      const failed = await failingApp.inject({ method: 'GET', url: '/api/status' });
      expect(failed.statusCode).toBe(503);
      expect(failed.json()).toEqual({ api: 'available', database: 'unavailable' });
      expect(failed.body).not.toContain('secret');
    } finally {
      await failingApp.close();
    }
  });

  it('denies expired sessions and prevents access to another user’s notes', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const users: string[] = [];
    let noteId: string | undefined;
    try {
      const register = async () => {
        const response = await app.inject({
          method: 'POST', url: '/api/auth/register',
          payload: { email: `security-${randomUUID()}@example.test`, password: 'correct-horse-battery-staple' },
        });
        expect(response.statusCode).toBe(201);
        const user = JSON.parse(response.body) as { id: string };
        users.push(user.id);
        return sessionCookie(response);
      };
      const ownerCookie = await register();
      const otherCookie = await register();
      const created = await app.inject({
        method: 'POST', url: '/api/notes', headers: { cookie: ownerCookie },
        payload: { title: 'Private', content: 'Only the owner can see this.', tags: ['Cloud', ' learning ', 'cloud'] },
      });
      expect(created.statusCode).toBe(201);
      noteId = (JSON.parse(created.body) as { id: string }).id;
      expect(created.json().tags).toEqual(['cloud', 'learning']);

      const list = await app.inject({ method: 'GET', url: '/api/notes', headers: { cookie: otherCookie } });
      expect(JSON.parse(list.body)).toEqual([]);
      const update = await app.inject({
        method: 'PATCH', url: `/api/notes/${noteId}`, headers: { cookie: otherCookie },
        payload: { title: 'Changed', content: 'Unauthorized change' },
      });
      const deletion = await app.inject({ method: 'DELETE', url: `/api/notes/${noteId}`, headers: { cookie: otherCookie } });
      expect(update.statusCode).toBe(404);
      expect(deletion.statusCode).toBe(404);
      const ownerList = await app.inject({ method: 'GET', url: '/api/notes', headers: { cookie: ownerCookie } });
      expect(JSON.parse(ownerList.body)).toEqual(expect.arrayContaining([expect.objectContaining({ id: noteId, title: 'Private' })]));

      const sessionId = ownerCookie.split('=')[1].split('.')[0];
      await pool.query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1", [sessionId]);
      const expired = await app.inject({ method: 'GET', url: '/api/notes', headers: { cookie: ownerCookie } });
      expect(expired.statusCode).toBe(401);
    } finally {
      if (noteId && users[0]) await notesRepository.delete(users[0], noteId);
      for (const userId of users) await authRepository.deleteUser(userId);
      await pool.end();
    }
  });
});
