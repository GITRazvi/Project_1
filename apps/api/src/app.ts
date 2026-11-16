import cors from '@fastify/cors';
import Fastify from 'fastify';
import { NotesStore, type CreateNoteInput, type NotesRepository } from './notes.js';

type CreateNoteBody = {
  title?: unknown;
  content?: unknown;
};

type NoteParams = {
  id: string;
};

type BuildAppOptions = {
  notesRepository?: NotesRepository;
};

function validateCreateNote(body: CreateNoteBody): CreateNoteInput | null {
  if (typeof body.title !== 'string' || typeof body.content !== 'string') {
    return null;
  }

  const title = body.title.trim();
  const content = body.content.trim();

  if (!title || !content || title.length > 120 || content.length > 10_000) {
    return null;
  }

  return { title, content };
}

export function buildApp({ notesRepository = new NotesStore() }: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/notes', async () => notesRepository.list());

  app.post<{ Body: CreateNoteBody }>('/api/notes', async (request, reply) => {
    const input = validateCreateNote(request.body ?? {});

    if (!input) {
      return reply.code(400).send({
        message: 'A title and content are required. Titles can be up to 120 characters.',
      });
    }

    return reply.code(201).send(await notesRepository.create(input));
  });

  app.patch<{ Params: NoteParams; Body: CreateNoteBody }>('/api/notes/:id', async (request, reply) => {
    const input = validateCreateNote(request.body ?? {});

    if (!input) {
      return reply.code(400).send({
        message: 'A title and content are required. Titles can be up to 120 characters.',
      });
    }

    const updatedNote = await notesRepository.update(request.params.id, input);

    if (!updatedNote) return reply.code(404).send({ message: 'Note not found.' });

    return updatedNote;
  });

  app.delete<{ Params: NoteParams }>('/api/notes/:id', async (request, reply) => {
    if (!(await notesRepository.delete(request.params.id))) {
      return reply.code(404).send({ message: 'Note not found.' });
    }

    return reply.code(204).send();
  });

  return app;
}
