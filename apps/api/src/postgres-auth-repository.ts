import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { AuthRepository, User, UserWithPassword } from './auth.js';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
};

type ParsedSessionToken = {
  sessionId: string;
  secretHash: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashSessionSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function parseSessionToken(sessionToken: string): ParsedSessionToken | null {
  const [sessionId, secret, ...remainder] = sessionToken.split('.');

  if (!sessionId || !secret || remainder.length > 0 || !uuidPattern.test(sessionId)) return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;

  return { sessionId, secretHash: hashSessionSecret(secret) };
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at.toISOString(),
  };
}

/** PostgreSQL-backed users and opaque browser sessions. */
export class PostgresAuthRepository implements AuthRepository {
  private constructor(private readonly pool: Pool) {}

  static async connect(connectionString: string): Promise<PostgresAuthRepository> {
    return new PostgresAuthRepository(new Pool({ connectionString }));
  }

  async createUser(email: string, passwordHash: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(`
      INSERT INTO users (id, email, password_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, password_hash, created_at
    `, [randomUUID(), email, passwordHash]);

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await this.pool.query<UserRow>(`
      SELECT id, email, password_hash, created_at
      FROM users
      WHERE email = $1
    `, [email]);
    const user = result.rows[0];

    if (!user) return null;

    return { ...mapUser(user), passwordHash: user.password_hash };
  }

  async createSession(userId: string): Promise<string> {
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const sessionToken = `${sessionId}.${secret}`;

    await this.pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    await this.pool.query(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')
    `, [sessionId, userId, hashSessionSecret(secret)]);

    return sessionToken;
  }

  async findUserBySessionToken(sessionToken: string): Promise<User | null> {
    const parsedToken = parseSessionToken(sessionToken);
    if (!parsedToken) return null;

    const result = await this.pool.query<UserRow>(`
      SELECT users.id, users.email, users.password_hash, users.created_at
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = $1 AND sessions.token_hash = $2 AND sessions.expires_at > NOW()
    `, [parsedToken.sessionId, parsedToken.secretHash]);

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async deleteSessionByToken(sessionToken: string): Promise<void> {
    const parsedToken = parseSessionToken(sessionToken);
    if (!parsedToken) return;

    await this.pool.query(
      'DELETE FROM sessions WHERE id = $1 AND token_hash = $2',
      [parsedToken.sessionId, parsedToken.secretHash],
    );
  }

  async deleteUser(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
