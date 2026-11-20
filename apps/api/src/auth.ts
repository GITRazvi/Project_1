export type User = {
  id: string;
  email: string;
  createdAt: string;
};

export type UserWithPassword = User & {
  passwordHash: string;
};

export interface AuthRepository {
  createUser(email: string, passwordHash: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<UserWithPassword | null>;
  createSession(userId: string): Promise<string>;
  findUserBySessionToken(sessionToken: string): Promise<User | null>;
  deleteSessionByToken(sessionToken: string): Promise<void>;
}
