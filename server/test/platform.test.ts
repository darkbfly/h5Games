import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "colyseus.js";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  SERVER_URL,
  registerUser,
  loginUser,
  joinLobby,
  joinGameRoom,
  readyAllPlayers,
} from "./authHelpers.js";

const SERVER_PORT = process.env.TEST_PORT ?? "2588";
const HTTP_BASE = `http://127.0.0.1:${SERVER_PORT}`;

let serverProcess: ChildProcess | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${HTTP_BASE}/health`);
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
  const auth = await registerUser(`boot_${Date.now()}`, "password123");
  const client = new Client(SERVER_URL);
  const lobby = await joinLobby(client, auth.token);
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

test("registers and logs in user", async () => {
  const username = `alice_${Date.now()}`;
  const password = "password123";

  const registered = await registerUser(username, password);
  assert.ok(registered.token);
  assert.equal(registered.user.username, username);

  const loggedIn = await loginUser(username, password);
  assert.ok(loggedIn.token);
  assert.equal(loggedIn.user.username, username);
});

test("rejects duplicate username on register", async () => {
  const username = `dup_${Date.now()}`;
  await registerUser(username, "password123");

  let rejected = false;
  try {
    await registerUser(username, "password456");
  } catch (err) {
    rejected = true;
    const message = err instanceof Error ? err.message : String(err);
    assert.match(message, /占用|USERNAME_TAKEN/i);
  }
  assert.ok(rejected);
});

test("rejects invalid credentials on login", async () => {
  const username = `bob_${Date.now()}`;
  await registerUser(username, "password123");

  const res = await fetch(`${HTTP_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "wrongpass" }),
  });
  assert.equal(res.status, 401);
});

test("rejects lobby join without token", async () => {
  const client = new Client(SERVER_URL);
  let rejected = false;
  try {
    await client.joinOrCreate("lobby");
  } catch (err) {
    rejected = true;
    const message = err instanceof Error ? err.message : String(err);
    assert.match(message, /401|未登录|登录|auth|join|error/i);
  }
  assert.ok(rejected);
});

test("lists available games", async () => {
  const auth = await registerUser(`games_${Date.now()}`, "password123");
  const client = new Client(SERVER_URL);
  const lobby = await joinLobby(client, auth.token);

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

test("creates room and lists owner username in lobby", async () => {
  const username = `host_${Date.now()}`;
  const auth = await registerUser(username, "password123");
  const client = new Client(SERVER_URL);
  const lobby = await joinLobby(client, auth.token);

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

  const rooms = await new Promise<{ roomId: string; roomName: string; ownerUsername?: string }[]>(
    (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("rooms_list timeout")), 5000);
      lobby.onMessage("rooms_list", (data: {
        rooms: { roomId: string; roomName: string; ownerUsername?: string }[];
      }) => {
        clearTimeout(timeout);
        resolve(data.rooms);
      });
      lobby.send("list_rooms", { keyword: "Alpha" });
    }
  );

  const room = rooms.find((r) => r.roomId === created.roomId);
  assert.ok(room);
  assert.equal(room?.roomName, "TestRoom_Alpha");
  assert.equal(room?.ownerUsername, username);
  await lobby.leave();
});

test("rejects wrong password and accepts correct password", async () => {
  const hostAuth = await registerUser(`host_pw_${Date.now()}`, "password123");
  const guestAuth = await registerUser(`guest_pw_${Date.now()}`, "password123");

  const hostClient = new Client(SERVER_URL);
  const hostLobby = await joinLobby(hostClient, hostAuth.token);

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
  const room = await joinGameRoom(guestClient, created.roomId, guestAuth.token, "abc123");
  assert.equal(room.id, created.roomId);

  let rejected = false;
  try {
    const badAuth = await registerUser(`bad_pw_${Date.now()}`, "password123");
    const badClient = new Client(SERVER_URL);
    const badRoom = await joinGameRoom(badClient, created.roomId, badAuth.token, "wrong");
    await badRoom.leave();
  } catch (err) {
    rejected = true;
    const message = err instanceof Error ? err.message : String(err);
    assert.match(message, /密码|403|join|error|seat|refused/i);
  }
  assert.ok(rejected, "wrong password should be rejected");

  await room.leave();
});

test("rejects game room join without token", async () => {
  const hostAuth = await registerUser(`host_no_token_${Date.now()}`, "password123");
  const hostClient = new Client(SERVER_URL);
  const hostLobby = await joinLobby(hostClient, hostAuth.token);

  const created = await new Promise<{ roomId: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("room_created timeout")), 5000);
    hostLobby.onMessage("room_created", (data: { roomId: string }) => {
      clearTimeout(timeout);
      resolve(data);
    });
    hostLobby.send("create_room", {
      roomName: "AuthRoom",
      gameId: "guess-number",
    });
  });
  await hostLobby.leave();

  const guestClient = new Client(SERVER_URL);
  let rejected = false;
  try {
    await guestClient.joinById(created.roomId);
  } catch (err) {
    rejected = true;
    const message = err instanceof Error ? err.message : String(err);
    assert.match(message, /401|未登录|登录|auth|join|error/i);
  }
  assert.ok(rejected);
});

test("rejects unknown game id on create", async () => {
  const auth = await registerUser(`bad_game_${Date.now()}`, "password123");
  const client = new Client(SERVER_URL);
  const lobby = await joinLobby(client, auth.token);

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
  const auth = await registerUser(`bad_rps_${Date.now()}`, "password123");
  const client = new Client(SERVER_URL);
  const lobby = await joinLobby(client, auth.token);

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

test("room owner can kick player while waiting", async () => {
  const ownerAuth = await registerUser(`kick_owner_${Date.now()}`, "password123");
  const guestAuth = await registerUser(`kick_guest_${Date.now()}`, "password123");

  const ownerLobbyClient = new Client(SERVER_URL);
  const ownerLobby = await joinLobby(ownerLobbyClient, ownerAuth.token);
  const created = await createRpsRoom(ownerLobby, { choiceTimeSeconds: 3, winningScore: 1 });
  await ownerLobby.leave();

  const ownerClient = new Client(SERVER_URL);
  const guestClient = new Client(SERVER_URL);
  const ownerRoom = await joinGameRoom(ownerClient, created.roomId, ownerAuth.token);
  const guestRoom = await joinGameRoom(guestClient, created.roomId, guestAuth.token);

  const kickedPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("kicked timeout")), 5000);
    guestRoom.onMessage("kicked", (data: { message: string }) => {
      clearTimeout(timeout);
      resolve(data.message);
    });
  });

  ownerRoom.send("kick_player", { sessionId: guestRoom.sessionId });

  const kickMessage = await kickedPromise;
  assert.match(kickMessage, /移出房间/);

  const ownerState = await new Promise<{
    players: { username: string }[];
    phase: string;
  }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("owner state timeout")), 5000);
    ownerRoom.onMessage("rps_state", (data: {
      players: { username: string }[];
      phase: string;
    }) => {
      if (data.players.length === 1) {
        clearTimeout(timeout);
        resolve(data);
      }
    });
  });

  assert.equal(ownerState.players.length, 1);
  assert.equal(ownerState.phase, "waiting");
  assert.equal(ownerState.players[0]?.username, ownerAuth.user.username);

  await ownerRoom.leave();
});

test("non-owner cannot kick player", async () => {
  const ownerAuth = await registerUser(`kick_owner2_${Date.now()}`, "password123");
  const guestAuth = await registerUser(`kick_guest2_${Date.now()}`, "password123");

  const ownerLobbyClient = new Client(SERVER_URL);
  const ownerLobby = await joinLobby(ownerLobbyClient, ownerAuth.token);
  const created = await createRpsRoom(ownerLobby, { choiceTimeSeconds: 3, winningScore: 1 });
  await ownerLobby.leave();

  const ownerClient = new Client(SERVER_URL);
  const guestClient = new Client(SERVER_URL);
  const ownerRoom = await joinGameRoom(ownerClient, created.roomId, ownerAuth.token);
  const guestRoom = await joinGameRoom(guestClient, created.roomId, guestAuth.token);

  const errorMessage = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("kick error timeout")), 5000);
    guestRoom.onMessage("error", (data: { message: string }) => {
      clearTimeout(timeout);
      resolve(data.message);
    });
    guestRoom.send("kick_player", { sessionId: ownerRoom.sessionId });
  });

  assert.match(errorMessage, /房主/);

  await ownerRoom.leave();
  await guestRoom.leave();
});

test("plays rock-paper-scissors round and includes usernames", async () => {
  const p1Auth = await registerUser(`rps_p1_${Date.now()}`, "password123");
  const p2Auth = await registerUser(`rps_p2_${Date.now()}`, "password123");

  const lobbyClient = new Client(SERVER_URL);
  const lobby = await joinLobby(lobbyClient, p1Auth.token);
  const created = await createRpsRoom(lobby, { choiceTimeSeconds: 3, winningScore: 1 });
  await lobby.leave();

  const p1 = new Client(SERVER_URL);
  const p2 = new Client(SERVER_URL);
  const room1 = await joinGameRoom(p1, created.roomId, p1Auth.token);
  const room2 = await joinGameRoom(p2, created.roomId, p2Auth.token);

  await readyAllPlayers([room1, room2]);

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

  const finished = await new Promise<{
    phase: string;
    winnerSessionId: string | null;
    players: { username: string }[];
  }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("finished timeout")), 8000);
    room1.onMessage("rps_state", (data: {
      phase: string;
      winnerSessionId: string | null;
      players: { username: string }[];
    }) => {
      if (data.phase === "finished") {
        clearTimeout(timeout);
        resolve(data);
      }
    });
  });

  assert.equal(finished.phase, "finished");
  assert.ok(finished.winnerSessionId);
  assert.equal(finished.players.length, 2);
  assert.ok(finished.players.some((p) => p.username === p1Auth.user.username));
  assert.ok(finished.players.some((p) => p.username === p2Auth.user.username));

  await room1.leave();
  await room2.leave();
});

test("timeout causes missing player to lose the round", async () => {
  const p1Auth = await registerUser(`timeout_p1_${Date.now()}`, "password123");
  const p2Auth = await registerUser(`timeout_p2_${Date.now()}`, "password123");

  const lobbyClient = new Client(SERVER_URL);
  const lobby = await joinLobby(lobbyClient, p1Auth.token);
  const created = await createRpsRoom(lobby, { choiceTimeSeconds: 3, winningScore: 5 });
  await lobby.leave();

  const p1 = new Client(SERVER_URL);
  const p2 = new Client(SERVER_URL);
  const room1 = await joinGameRoom(p1, created.roomId, p1Auth.token);
  const room2 = await joinGameRoom(p2, created.roomId, p2Auth.token);

  await readyAllPlayers([room1, room2]);
  await delay(500);

  room1.send("rps_choose", { choice: "paper" });

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
