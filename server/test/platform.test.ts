import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "colyseus.js";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SERVER_PORT = process.env.TEST_PORT ?? "2588";
const SERVER_URL = `ws://localhost:${SERVER_PORT}`;

let serverProcess: ChildProcess | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // server still booting
    }
    await delay(250);
  }
  throw new Error("Server health check failed");
}

async function waitForServer() {
  await waitForHealth();

  const client = new Client(SERVER_URL);
  const lobby = await client.joinOrCreate("lobby");
  const games = await new Promise<{ id: string }[]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("games_list timeout")), 5000);
    lobby.onMessage("games_list", (data: { games: { id: string }[] }) => {
      clearTimeout(timeout);
      resolve(data.games);
    });
    lobby.send("get_games", {});
  });
  await lobby.leave();

  if (!games.some((g) => g.id === "rock-paper-scissors")) {
    throw new Error("Server did not start with latest game catalog");
  }
}

async function createRpsRoom(
  lobby: Awaited<ReturnType<Client["joinOrCreate"]>>,
  config: { choiceTimeSeconds: number; winningScore: number }
) {
  return new Promise<{ roomId: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("room_created timeout")), 5000);
    lobby.onMessage("room_created", (data: { roomId: string }) => {
      clearTimeout(timeout);
      resolve(data);
    });
    lobby.onMessage("error", (data: { message: string }) => {
      clearTimeout(timeout);
      reject(new Error(data.message));
    });
    lobby.send("create_room", {
      roomName: `RPS_${Date.now()}`,
      gameId: "rock-paper-scissors",
      gameConfig: config,
    });
  });
}

before(async () => {
  const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");
  serverProcess = spawn(process.execPath, [tsxCli, "src/index.ts"], {
    cwd: serverDir,
    env: { ...process.env, PORT: SERVER_PORT, NODE_ENV: "test" },
    stdio: "pipe",
  });

  serverProcess.stderr?.on("data", (chunk) => {
    console.error(String(chunk));
  });

  await delay(400);
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

  assert.ok(games.length >= 4);
  assert.ok(games.some((g) => g.id === "guess-number"));
  assert.ok(games.some((g) => g.id === "rock-paper-scissors"));
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

test("rejects invalid rock-paper-scissors config", async () => {
  const client = new Client(SERVER_URL);
  const lobby = await client.joinOrCreate("lobby");

  const errorMessage = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("error timeout")), 5000);
    lobby.onMessage("error", (data: { message: string }) => {
      clearTimeout(timeout);
      resolve(data.message);
    });
    lobby.send("create_room", {
      roomName: "BadRps",
      gameId: "rock-paper-scissors",
      gameConfig: { choiceTimeSeconds: 0, winningScore: 0 },
    });
  });

  assert.match(errorMessage, /选择时间|获胜分数|之间/i);
  await lobby.leave();
});

test("plays rock-paper-scissors round and finishes at winning score", async () => {
  const lobbyClient = new Client(SERVER_URL);
  const lobby = await lobbyClient.joinOrCreate("lobby");
  const created = await createRpsRoom(lobby, { choiceTimeSeconds: 3, winningScore: 1 });
  await lobby.leave();

  const p1 = new Client(SERVER_URL);
  const p2 = new Client(SERVER_URL);
  const room1 = await p1.joinById(created.roomId);
  const room2 = await p2.joinById(created.roomId);

  const waitPlaying = (room: typeof room1) =>
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("rps_state timeout")), 8000);
      room.onMessage("rps_state", (data: { phase: string }) => {
        if (data.phase === "playing") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

  await Promise.all([waitPlaying(room1), waitPlaying(room2)]);

  room1.send("rps_choose", { choice: "rock" });
  room2.send("rps_choose", { choice: "scissors" });

  const finished = await new Promise<{ phase: string; winnerSessionId: string | null }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("finished timeout")), 8000);
    room1.onMessage("rps_state", (data: { phase: string; winnerSessionId: string | null }) => {
      if (data.phase === "finished") {
        clearTimeout(timeout);
        resolve(data);
      }
    });
  });

  assert.equal(finished.phase, "finished");
  assert.ok(finished.winnerSessionId);

  await room1.leave();
  await room2.leave();
});

test("timeout causes missing player to lose the round", async () => {
  const lobbyClient = new Client(SERVER_URL);
  const lobby = await lobbyClient.joinOrCreate("lobby");
  const created = await createRpsRoom(lobby, { choiceTimeSeconds: 3, winningScore: 5 });
  await lobby.leave();

  const p1 = new Client(SERVER_URL);
  const p2 = new Client(SERVER_URL);
  const room1 = await p1.joinById(created.roomId);
  const room2 = await p2.joinById(created.roomId);

  await delay(500);

  room1.send("rps_choose", { choice: "paper" });
  // opponent does not choose; round should end after 3 seconds

  const roundResult = await new Promise<{
    roundWinnerSessionId: string | null;
    choices: Record<string, string | null>;
  }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("round_result timeout")), 6000);
    room1.onMessage("rps_round_result", (data: {
      roundWinnerSessionId: string | null;
      choices: Record<string, string | null>;
    }) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  assert.equal(roundResult.roundWinnerSessionId, room1.sessionId);
  const opponentId = Object.keys(roundResult.choices).find((id) => id !== room1.sessionId);
  assert.ok(opponentId);
  assert.equal(roundResult.choices[opponentId!], null);

  await room1.leave();
  await room2.leave();
});
