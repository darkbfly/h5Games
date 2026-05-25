import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { LobbyRoom } from "./rooms/LobbyRoom.js";
import { GameRoom } from "./rooms/GameRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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
