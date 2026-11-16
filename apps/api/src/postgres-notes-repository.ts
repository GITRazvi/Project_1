import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { CreateNoteInput, Note, NotesRepository } from './notes.js';

type NoteRow = {
  id: string;
  title: string;
  content: string;
  created_at: Date;
  updated_at: Date;
};

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** PostgreSQL-backed notes storage used by the running API. */
export class PostgresNotesRepository implements NotesRepository {
  private constructor(private readonly pool: Pool) {}

  static async connect(connectionString: string): Promise<PostgresNotesRepository> {
    const repository = new PostgresNotesRepository(new Pool({ connectionString }));
    await repository.initialize();
    return repository;
  }

  async list(): Promise<Note[]> {
    const result = await this.pool.query<NoteRow>(`
      SELECT id, title, content, created_at, updated_at
      FROM notes
      ORDER BY created_at DESC, id DESC
    `);

    return result.rows.map(mapNote);
  }

  async create(input: CreateNoteInput): Promise<Note> {
    const result = await this.pool.query<NoteRow>(`
      INSERT INTO notes (id, title, content)
      VALUES ($1, $2, $3)
      RETURNING id, title, content, created_at, updated_at
    `, [randomUUID(), input.title, input.content]);

    return mapNote(result.rows[0]);
  }

  async update(id: string, input: CreateNoteInput): Promise<Note | null> {
    const result = await this.pool.query<NoteRow>(`
      UPDATE notes
      SET title = $2, content = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, content, created_at, updated_at
    `, [id, input.title, input.content]);

    return result.rows[0] ? mapNote(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM notes WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  close(): Promise<void> {
    return this.pool.end();
  }

  private async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
}
