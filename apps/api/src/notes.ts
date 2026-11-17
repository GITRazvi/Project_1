import { randomUUID } from 'node:crypto';

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  title: string;
  content: string;
};

export interface NotesRepository {
  list(userId: string): Promise<Note[]>;
  create(userId: string, input: CreateNoteInput): Promise<Note>;
  update(userId: string, id: string, input: CreateNoteInput): Promise<Note | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

/**
 * Temporary storage used only by fast in-process tests.
 */
export class NotesStore implements NotesRepository {
  private readonly notes: Array<Note & { userId: string }> = [];

  async list(userId: string): Promise<Note[]> {
    return this.notes.filter((note) => note.userId === userId).sort(
      (first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt),
    ).map(({ userId: _userId, ...note }) => note);
  }

  async create(userId: string, input: CreateNoteInput): Promise<Note> {
    const timestamp = new Date().toISOString();
    const note: Note = {
      id: randomUUID(),
      title: input.title,
      content: input.content,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.notes.push({ ...note, userId });
    return note;
  }

  async update(userId: string, id: string, input: CreateNoteInput): Promise<Note | null> {
    const note = this.notes.find((candidate) => candidate.id === id && candidate.userId === userId);

    if (!note) return null;

    note.title = input.title;
    note.content = input.content;
    note.updatedAt = new Date().toISOString();
    const { userId: _userId, ...publicNote } = note;
    return publicNote;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const noteIndex = this.notes.findIndex(
      (candidate) => candidate.id === id && candidate.userId === userId,
    );

    if (noteIndex === -1) return false;

    this.notes.splice(noteIndex, 1);
    return true;
  }
}
