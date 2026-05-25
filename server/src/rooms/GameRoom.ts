import { Client, Room, ServerError } from "@colyseus/core";
import { getGameById } from "../gameCatalog.js";
import type { CreateRoomOptions, GameRoomMetadata, JoinRoomOptions } from "../types.js";

export class GameRoom extends Room {
  autoDispose = false;
  private roomPassword = "";

  async onCreate(options: CreateRoomOptions) {
    const roomName = (options.roomName ?? "").trim();
    const gameId = options.gameId ?? "";

    if (!roomName) {
      throw new ServerError(400, "房间名不能为空");
    }

    const game = getGameById(gameId);
    if (!game) {
      throw new ServerError(400, "无效的游戏类型");
    }

    this.roomPassword = (options.password ?? "").trim();
    this.maxClients = game.maxPlayers;

    const metadata: GameRoomMetadata = {
      roomName,
      gameId: game.id,
      gameName: game.name,
      hasPassword: this.roomPassword.length > 0,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
    };

    this.setMetadata(metadata);
  }

  async onAuth(client: Client, options: JoinRoomOptions) {
    if (!this.roomPassword) {
      return true;
    }

    const password = (options?.password ?? "").trim();
    if (password !== this.roomPassword) {
      throw new ServerError(403, "房间密码错误");
    }

    return true;
  }

  onJoin(client: Client) {
    console.log(`[GameRoom] ${client.sessionId} joined ${this.roomId}`);
  }

  onLeave(client: Client) {
    console.log(`[GameRoom] ${client.sessionId} left ${this.roomId}`);
  }
}
