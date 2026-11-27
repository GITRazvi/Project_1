import { buildApp } from './app.js';
import { PostgresAuthRepository } from './postgres-auth-repository.js';
import { PostgresNotesRepository } from './postgres-notes-repository.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;

try {
  if (!databaseUrl) throw new Error('DATABASE_URL must be set to start the API.');

  const authRepository = await PostgresAuthRepository.connect(databaseUrl);
  const notesRepository = await PostgresNotesRepository.connect(databaseUrl);
  const app = buildApp({ notesRepository, authRepository, checkDatabase: () => notesRepository.checkConnection(), trustedProxy: process.env.TRUSTED_PROXY });
  app.addHook('onClose', async () => {
    await notesRepository.close();
    await authRepository.close();
  });
  await app.listen({ port, host });
} catch (error) {
  console.error(error);
  process.exit(1);
}
