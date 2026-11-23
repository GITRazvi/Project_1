import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const migrationFilePattern = /^\d+_[a-z0-9_]+\.sql$/;
const migrationLockId = 7_031_014_211;

type MigrationRow = {
  name: string;
};

/** Applies each numbered SQL migration once and returns files applied during this run. */
export async function runMigrations(connectionString: string): Promise<string[]> {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const appliedMigrations: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('SELECT pg_advisory_lock($1::bigint)', [migrationLockId]);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((fileName) => migrationFilePattern.test(fileName))
      .sort((first, second) => first.localeCompare(second));

    for (const fileName of migrationFiles) {
      const alreadyApplied = await client.query<MigrationRow>(
        'SELECT name FROM schema_migrations WHERE name = $1',
        [fileName],
      );

      if (alreadyApplied.rows[0]) continue;

      const sql = await readFile(join(migrationsDirectory, fileName), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [fileName]);
        await client.query('COMMIT');
        appliedMigrations.push(fileName);
      } catch (error: unknown) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return appliedMigrations;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [migrationLockId]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}
