import { runMigrations } from './migrations.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running migrations.');
}

const appliedMigrations = await runMigrations(databaseUrl);
console.info(
  appliedMigrations.length === 0
    ? 'Database schema is already up to date.'
    : `Applied migrations: ${appliedMigrations.join(', ')}`,
);
