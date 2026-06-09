import type { Client } from "@colyseus/core";
import { ServerError } from "@colyseus/core";
import { authService } from "./AuthService.js";

export interface ClientAuth {
  userId: string;
  username: string;
}

export function resolveClientAuth(client: Client): ClientAuth {
  const auth = client.auth as ClientAuth | undefined;
  if (!auth?.userId || !auth?.username) {
    throw new ServerError(401, "未登录或登录已失效");
  }
  return auth;
}

export function authenticateToken(token?: string): ClientAuth {
  const session = authService.verifyToken(token);
  if (!session) {
    throw new ServerError(401, "未登录或登录已失效");
  }
  return { userId: session.userId, username: session.username };
}
