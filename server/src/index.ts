import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { LobbyRoom } from "./rooms/LobbyRoom.js";
import { GameRoom } from "./rooms/GameRoom.js";
import { buildMetrics } from "./utils/metrics.js";
import { authService } from "./auth/AuthService.js";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  const lobbyRooms = await matchMaker.query({ name: "lobby" });
  const gameRooms = await matchMaker.query({ name: "game_room" });

  const lobbyClients = lobbyRooms.reduce((sum, r) => sum + r.clients, 0);
  const gameClients = gameRooms.reduce((sum, r) => sum + r.clients, 0);

  res.json({
    ok: true,
    metrics: buildMetrics(lobbyClients, gameRooms.length, gameClients),
  });
});

app.post("/auth/register", (req, res) => {
  const username = String(req.body?.username ?? "");
  const password = String(req.body?.password ?? "");

  try {
    const result = authService.register(username, password);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "注册失败";
    if (message === "USERNAME_TAKEN") {
      res.status(409).json({ code: "USERNAME_TAKEN", message: "用户名已被占用" });
      return;
    }
    res.status(400).json({ code: "INVALID_REQUEST", message });
  }
});

app.post("/auth/login", (req, res) => {
  const username = String(req.body?.username ?? "");
  const password = String(req.body?.password ?? "");

  try {
    const result = authService.login(username, password);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "登录失败";
    if (message === "INVALID_CREDENTIALS") {
      res.status(401).json({ code: "INVALID_CREDENTIALS", message: "用户名或密码错误" });
      return;
    }
    res.status(400).json({ code: "INVALID_REQUEST", message });
  }
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

gameServer.define("lobby", LobbyRoom);
gameServer.define("game_room", GameRoom);

if (process.env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

httpServer.listen(PORT, () => {
  console.log(`[Colyseus] listening on ws://localhost:${PORT}`);
});
