import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "colyseus.js";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SERVER_URL = "ws://localhost:2568";
const SERVER_PORT = "2568";

let serverProcess: ChildProcess | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const client = new Client(SERVER_URL);
      const lobby = await client.joinOrCreate("lobby");
      await lobby.leave();
      return;
    } catch {
      await delay(300);
    }
  }
  throw new Error("Server did not start in time");
}

before(async () => {
  const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");
  serverProcess = spawn(process.execPath, [tsxCli, "src/index.ts"], {
    cwd: serverDir,
    env: { ...process.env, PORT: SERVER_PORT, NODE_ENV: "test" },
    stdio: "pipe",
  });

  await waitForServer();
});

after(async () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  await delay(200);
});

test("lists available games", async () => {
  const client = new Client(SERVER_URL);
  const lobby = await client.joinOrCreate("lobby");

  const games = await new Promise<{ id: string; name: string }[]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("games_list timeout")), 5000);
    lobby.onMessage("games_list", (data: { games: { id: string; name: string }[] }) => {
      clearTimeout(timeout);
      resolve(data.games);
    });
    lobby.send("get_games", {});
  });

  assert.ok(games.length >= 3);
  assert.ok(games.some((g) => g.id === "guess-number"));
  await lobby.leave();
});

test("creates room and lists it in lobby", async () => {
  const client = new Client(SERVER_URL);
  const lobby = await client.joinOrCreate("lobby");

  const created = await new Promise<{ roomId: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("room_created timeout")), 5000);
    lobby.onMessage("room_created", (data: { roomId: string }) => {
      clearTimeout(timeout);
      resolve(data);
    });
    lobby.send("create_room", {
      roomName: "TestRoom_Alpha",
      gameId: "guess-number",
    });
  });

  assert.ok(created.roomId);

  await delay(300);

  const rooms = await new Promise<{ roomId: string; roomName: string }[]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("rooms_list timeout")), 5000);
    lobby.onMessage("rooms_list", (data: { rooms: { roomId: string; roomName: string }[] }) => {
      clearTimeout(timeout);
      resolve(data.rooms);
    });
    lobby.send("list_rooms", { keyword: "Alpha" });
  });

  assert.ok(rooms.some((r) => r.roomId === created.roomId && r.roomName === "TestRoom_Alpha"));
  await lobby.leave();
});

test("rejects wrong password and accepts correct password", async () => {
  const hostClient = new Client(SERVER_URL);
  const hostLobby = await hostClient.joinOrCreate("lobby");

  const created = await new Promise<{ roomId: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("room_created timeout")), 5000);
    hostLobby.onMessage("room_created", (data: { roomId: string }) => {
      clearTimeout(timeout);
      resolve(data);
    });
    hostLobby.send("create_room", {
      roomName: "SecretRoom",
      password: "abc123",
      gameId: "quick-card",
    });
  });

  await hostLobby.leave();

  const guestClient = new Client(SERVER_URL);
  const room = await guestClient.joinById(created.roomId, { password: "abc123" });
  assert.equal(room.id, created.roomId);

  let rejected = false;
  try {
    const badClient = new Client(SERVER_URL);
    const badRoom = await badClient.joinById(created.roomId, { password: "wrong" });
    await badRoom.leave();
  } catch (err) {
    rejected = true;
    const message = err instanceof Error ? err.message : String(err);
    assert.match(message, /密码|403|join|error|seat|refused/i);
  }
  assert.ok(rejected, "wrong password should be rejected");

  await room.leave();
});

test("rejects unknown game id on create", async () => {
  const client = new Client(SERVER_URL);
  const lobby = await client.joinOrCreate("lobby");

  const errorMessage = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("error timeout")), 5000);
    lobby.onMessage("error", (data: { message: string }) => {
      clearTimeout(timeout);
      resolve(data.message);
    });
    lobby.send("create_room", {
      roomName: "BadGameRoom",
      gameId: "non-existent-game",
    });
  });

  assert.match(errorMessage, /游戏|无效/i);
  await lobby.leave();
});
