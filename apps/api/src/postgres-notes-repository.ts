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

  async list(userId: string): Promise<Note[]> {
    const result = await this.pool.query<NoteRow>(`
      SELECT id, title, content, created_at, updated_at
      FROM notes
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
    `, [userId]);

    return result.rows.map(mapNote);
  }

  async create(userId: string, input: CreateNoteInput): Promise<Note> {
    const result = await this.pool.query<NoteRow>(`
      INSERT INTO notes (id, user_id, title, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, content, created_at, updated_at
    `, [randomUUID(), userId, input.title, input.content]);

    return mapNote(result.rows[0]);
  }

  async update(userId: string, id: string, input: CreateNoteInput): Promise<Note | null> {
    const result = await this.pool.query<NoteRow>(`
      UPDATE notes
      SET title = $3, content = $4, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, title, content, created_at, updated_at
    `, [id, userId, input.title, input.content]);

    return result.rows[0] ? mapNote(result.rows[0]) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  close(): Promise<void> {
    return this.pool.end();
  }

  private async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        title VARCHAR(120) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id UUID');
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS notes_user_id_created_at_idx ON notes (user_id, created_at DESC)',
    );
  }
}
