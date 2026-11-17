import { compare, hash } from 'bcryptjs';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
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

export function buildApp({ notesRepository, authRepository }: BuildAppOptions) {
  const app = Fastify({ logger: true });

  app.register(cookie);
  app.register(cors, { origin: true });

  function setSessionCookie(reply: FastifyReply, sessionId: string) {
    reply.setCookie(sessionCookieName, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: sessionLifetimeSeconds,
    });
  }

  async function currentUser(request: FastifyRequest): Promise<User | null> {
    const sessionId = request.cookies[sessionCookieName];
    return sessionId ? authRepository.findUserBySessionId(sessionId) : null;
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

  app.post<{ Body: CredentialsBody }>('/api/auth/login', async (request, reply) => {
    const credentials = validateCredentials(request.body ?? {});

    if (!credentials) return reply.code(401).send({ message: 'Email or password is incorrect.' });

    const user = await authRepository.findUserByEmail(credentials.email);
    const passwordMatches = user ? await compare(credentials.password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      return reply.code(401).send({ message: 'Email or password is incorrect.' });
    }

    setSessionCookie(reply, await authRepository.createSession(user.id));
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const sessionId = request.cookies[sessionCookieName];

    if (sessionId) await authRepository.deleteSession(sessionId);

    reply.clearCookie(sessionCookieName, { path: '/' });
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
