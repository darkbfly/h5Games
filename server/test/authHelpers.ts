import { Client } from "colyseus.js";

const PORT = process.env.TEST_PORT ?? process.env.LOAD_TEST_PORT ?? "2588";
const HTTP_BASE = `http://127.0.0.1:${PORT}`;
export const SERVER_URL = `ws://localhost:${PORT}`;

export interface AuthSession {
  token: string;
  user: { id: string; username: string };
}

export async function registerUser(
  username: string,
  password: string
): Promise<AuthSession> {
  const res = await fetch(`${HTTP_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? "register failed");
  }
  return data as AuthSession;
}

export async function loginUser(
  username: string,
  password: string
): Promise<AuthSession> {
  const res = await fetch(`${HTTP_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? "login failed");
  }
  return data as AuthSession;
}

export async function joinLobby(client: Client, token: string) {
  return client.joinOrCreate("lobby", { token });
}

export async function joinGameRoom(
  client: Client,
  roomId: string,
  token: string,
  password?: string
) {
  return client.joinById(roomId, { token, password });
}

export function sendRpsReady(room: { send: (type: string, data: object) => void }): void {
  room.send("rps_ready", {});
}

export async function readyAllPlayers(
  rooms: Array<{ send: (type: string, data: object) => void }>
): Promise<void> {
  for (const room of rooms) {
    sendRpsReady(room);
  }
}
