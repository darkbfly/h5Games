import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "colyseus.js";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SERVER_PORT = process.env.LOAD_TEST_PORT ?? "2599";
const SERVER_URL = `ws://localhost:${SERVER_PORT}`;

let serverProcess: ChildProcess | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/health`);
      if (response.ok) return;
    } catch {
      // still booting
    }
    await delay(250);
  }
  throw new Error("Server health check failed");
}

before(async () => {
  const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");
  serverProcess = spawn(process.execPath, [tsxCli, "src/index.ts"], {
    cwd: serverDir,
    env: { ...process.env, PORT: SERVER_PORT, NODE_ENV: "test" },
    stdio: "pipe",
  });
  await delay(400);
  await waitForHealth();
});

after(async () => {
  serverProcess?.kill();
  await delay(200);
});

test("health endpoint returns metrics", async () => {
  const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.metrics);
  assert.ok(typeof data.metrics.uptimeSeconds === "number");
  assert.ok(typeof data.metrics.gameRooms === "number");
});

test("concurrent lobby connections", async () => {
  const count = 10;
  const clients: Client[] = [];
  const lobbies = [];

  for (let i = 0; i < count; i++) {
    const c = new Client(SERVER_URL);
    clients.push(c);
    lobbies.push(c.joinOrCreate("lobby"));
  }

  const rooms = await Promise.all(lobbies);
  assert.equal(rooms.length, count);

  for (const room of rooms) {
    await room.leave();
  }
});

test("rate limit rejects excessive create_room", async () => {
  const client = new Client(SERVER_URL);
  const lobby = await client.joinOrCreate("lobby");

  let rateLimited = false;
  lobby.onMessage("error", (data: { message: string }) => {
    if (data.message?.includes("频繁")) {
      rateLimited = true;
    }
  });

  for (let i = 0; i < 8; i++) {
    lobby.send("create_room", {
      roomName: `RateTest_${i}_${Date.now()}`,
      gameId: "guess-number",
    });
    await delay(80);
  }

  await delay(500);
  assert.ok(rateLimited, "should hit rate limit after many create_room calls");
  await lobby.leave();
});
