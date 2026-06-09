import crypto from "node:crypto";

export interface UserProfile {
  id: string;
  username: string;
}

interface StoredUser extends UserProfile {
  passwordHash: string;
  salt: string;
}

interface Session {
  userId: string;
  username: string;
}

const MIN_USERNAME_LEN = 3;
const MIN_PASSWORD_LEN = 6;

export class AuthService {
  private readonly users = new Map<string, StoredUser>();
  private readonly tokens = new Map<string, Session>();

  register(username: string, password: string): { token: string; user: UserProfile } {
    const normalized = username.trim();
    if (normalized.length < MIN_USERNAME_LEN) {
      throw new Error("用户名至少3个字符");
    }
    if (password.length < MIN_PASSWORD_LEN) {
      throw new Error("密码至少6个字符");
    }

    const key = normalized.toLowerCase();
    if (this.users.has(key)) {
      throw new Error("USERNAME_TAKEN");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const user: StoredUser = {
      id: crypto.randomUUID(),
      username: normalized,
      salt,
      passwordHash: this.hashPassword(password, salt),
    };
    this.users.set(key, user);

    const token = this.createToken(user);
    return { token, user: { id: user.id, username: user.username } };
  }

  login(username: string, password: string): { token: string; user: UserProfile } {
    const key = username.trim().toLowerCase();
    const user = this.users.get(key);
    if (!user || this.hashPassword(password, user.salt) !== user.passwordHash) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const token = this.createToken(user);
    return { token, user: { id: user.id, username: user.username } };
  }

  verifyToken(token?: string): Session | null {
    if (!token?.trim()) {
      return null;
    }
    return this.tokens.get(token.trim()) ?? null;
  }

  private createToken(user: StoredUser): string {
    const token = crypto.randomBytes(32).toString("hex");
    this.tokens.set(token, { userId: user.id, username: user.username });
    return token;
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString("hex");
  }
}

export const authService = new AuthService();
