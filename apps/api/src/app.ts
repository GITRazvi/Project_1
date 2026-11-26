import { compare, hash } from 'bcryptjs';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { AuthRepository, User } from './auth.js';
import type { CreateNoteInput, NotesRepository } from './notes.js';

const sessionCookieName = 'cloud_notes_session';
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

type CredentialsBody = {
  email?: unknown;
  password?: unknown;
};

type CreateNoteBody = {
  title?: unknown;
  content?: unknown;
};

type NoteParams = {
  id: string;
};

type BuildAppOptions = {
  notesRepository: NotesRepository;
  authRepository: AuthRepository;
  checkDatabase: () => Promise<void>;
};

function validateCredentials(body: CredentialsBody): { email: string; password: string } | null {
  if (typeof body.email !== 'string' || typeof body.password !== 'string') return null;

  const email = body.email.trim().toLowerCase();
  const password = body.password;
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailIsValid || password.length < 8 || password.length > 72) return null;

  return { email, password };
}

function validateCreateNote(body: CreateNoteBody): CreateNoteInput | null {
  if (typeof body.title !== 'string' || typeof body.content !== 'string') return null;

  const title = body.title.trim();
  const content = body.content.trim();

  if (!title || !content || title.length > 120 || content.length > 10_000) return null;

  return { title, content };
}

export function buildApp({ notesRepository, authRepository, checkDatabase }: BuildAppOptions) {
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] } });

  app.register(cookie);
  app.register(cors, { origin: true });
  app.register(rateLimit, { global: false });

  function setSessionCookie(reply: FastifyReply, sessionToken: string) {
    reply.setCookie(sessionCookieName, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: sessionLifetimeSeconds,
      priority: 'high',
    });
  }

  async function currentUser(request: FastifyRequest): Promise<User | null> {
    const sessionId = request.cookies[sessionCookieName];
    return sessionId ? authRepository.findUserBySessionToken(sessionId) : null;
  }

  async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<User | null> {
    const user = await currentUser(request);

    if (!user) reply.code(401).send({ message: 'You must be logged in to use notes.' });

    return user;
  }

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/status', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      await checkDatabase();
      return { api: 'available', database: 'available' };
    } catch {
      request.log.warn({ event: 'database_status_check_failed', service: 'database' }, 'Database status check failed');
      return reply.code(503).send({ api: 'available', database: 'unavailable' });
    }
  });

  app.post<{ Body: CredentialsBody }>('/api/auth/register', async (request, reply) => {
    const credentials = validateCredentials(request.body ?? {});

    if (!credentials) {
      return reply.code(400).send({
        message: 'Enter a valid email and a password between 8 and 72 characters.',
      });
    }

    const user = await authRepository.createUser(
      credentials.email,
      await hash(credentials.password, 10),
    );

    if (!user) return reply.code(409).send({ message: 'An account with that email already exists.' });

    setSessionCookie(reply, await authRepository.createSession(user.id));
    return reply.code(201).send(user);
  });

  app.after(() => app.post<{ Body: CredentialsBody }>('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const credentials = validateCredentials(request.body ?? {});

    if (!credentials) return reply.code(401).send({ message: 'Email or password is incorrect.' });

    const user = await authRepository.findUserByEmail(credentials.email);
    const passwordMatches = user ? await compare(credentials.password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      return reply.code(401).send({ message: 'Email or password is incorrect.' });
    }

    setSessionCookie(reply, await authRepository.createSession(user.id));
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }));

  app.post('/api/auth/logout', async (request, reply) => {
    const sessionId = request.cookies[sessionCookieName];

    if (sessionId) await authRepository.deleteSessionByToken(sessionId);

    reply.clearCookie(sessionCookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      priority: 'high',
    });
    return reply.code(204).send();
  });

  app.get('/api/auth/me', async (request, reply) => {
    const user = await currentUser(request);
    return user ?? reply.code(401).send({ message: 'You are not logged in.' });
  });

  app.get('/api/notes', async (request, reply) => {
    const user = await requireUser(request, reply);
    return user ? notesRepository.list(user.id) : undefined;
  });

  app.post<{ Body: CreateNoteBody }>('/api/notes', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const input = validateCreateNote(request.body ?? {});

    if (!input) {
      return reply.code(400).send({
        message: 'A title and content are required. Titles can be up to 120 characters.',
      });
    }

    return reply.code(201).send(await notesRepository.create(user.id, input));
  });

  app.patch<{ Params: NoteParams; Body: CreateNoteBody }>('/api/notes/:id', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const input = validateCreateNote(request.body ?? {});

    if (!input) {
      return reply.code(400).send({
        message: 'A title and content are required. Titles can be up to 120 characters.',
      });
    }

    const updatedNote = await notesRepository.update(user.id, request.params.id, input);

    if (!updatedNote) return reply.code(404).send({ message: 'Note not found.' });

    return updatedNote;
  });

  app.delete<{ Params: NoteParams }>('/api/notes/:id', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    if (!(await notesRepository.delete(user.id, request.params.id))) {
      return reply.code(404).send({ message: 'Note not found.' });
    }

    return reply.code(204).send();
  });

  return app;
}
