import { Client, Room, ServerError } from "@colyseus/core";
import { getGameById, validateGameConfig, type GameConfigValues } from "../gameCatalog.js";
import { RockPaperScissorsController } from "../games/RockPaperScissorsController.js";
import type { CreateRoomOptions, GameRoomMetadata, JoinRoomOptions } from "../types.js";
const RECONNECT_SECONDS = 10;

export class GameRoom extends Room {
  autoDispose = false;
  private roomPassword = "";
  private gameId = "";
  private gameConfig: GameConfigValues | undefined;
  private rps: RockPaperScissorsController | null = null;

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

    this.gameId = game.id;
    this.gameConfig = validateGameConfig(gameId, options.gameConfig);
    this.roomPassword = (options.password ?? "").trim();
    this.maxClients = game.maxPlayers;

    if (gameId === "rock-paper-scissors") {
      if (!this.gameConfig) {
        throw new ServerError(400, "锤子剪刀布需要房间配置");
      }
      this.rps = new RockPaperScissorsController(this, this.gameConfig);
    }

    const metadata: GameRoomMetadata = {
      roomName,
      gameId: game.id,
      gameName: game.name,
      hasPassword: this.roomPassword.length > 0,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      gameConfig: this.gameConfig,
    };

    this.setMetadata(metadata);
  }

  async onAuth(_client: Client, options: JoinRoomOptions) {
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
    console.log(`[GameRoom] ${client.sessionId} joined ${this.roomId} (${this.gameId})`);
    this.rps?.onJoin(client);
    this.rps?.sendStateTo(client);
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`[GameRoom] ${client.sessionId} left ${this.roomId} (consented=${consented})`);

    if (!consented) {
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        console.log(`[GameRoom] ${client.sessionId} reconnected`);
        return;
      } catch {
        console.log(`[GameRoom] ${client.sessionId} reconnection expired`);
      }
    }

    this.rps?.onLeave(client);
  }

  onDispose() {
    this.rps?.dispose();
  }
}
