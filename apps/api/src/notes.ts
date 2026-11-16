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
  list(): Promise<Note[]>;
  create(input: CreateNoteInput): Promise<Note>;
  update(id: string, input: CreateNoteInput): Promise<Note | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * Temporary storage for the first learning version of Cloud Notes.
 *
 * The array exists only while the API process is running. A later PostgreSQL
 * repository will provide the same operations with permanent storage.
 */
export class NotesStore implements NotesRepository {
  private readonly notes: Note[] = [];

  async list(): Promise<Note[]> {
    return [...this.notes].sort(
      (first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt),
    );
  }

  async create(input: CreateNoteInput): Promise<Note> {
    const timestamp = new Date().toISOString();
    const note: Note = {
      id: randomUUID(),
      title: input.title,
      content: input.content,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.notes.push(note);
    return note;
  }

  async update(id: string, input: CreateNoteInput): Promise<Note | null> {
    const note = this.notes.find((candidate) => candidate.id === id);

    if (!note) return null;

    note.title = input.title;
    note.content = input.content;
    note.updatedAt = new Date().toISOString();
    return note;
  }

  async delete(id: string): Promise<boolean> {
    const noteIndex = this.notes.findIndex((candidate) => candidate.id === id);

    if (noteIndex === -1) return false;

    this.notes.splice(noteIndex, 1);
    return true;
  }
}
