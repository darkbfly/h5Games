import { Client, Room, ServerError } from "@colyseus/core";
import { getGameById, validateGameConfig, type GameConfigValues } from "../gameCatalog.js";
import { RockPaperScissorsController } from "../games/RockPaperScissorsController.js";
import type { CreateRoomOptions, GameRoomMetadata, JoinRoomOptions } from "../types.js";
import { authenticateToken } from "../auth/resolveAuth.js";
import { CommonMessages } from "../../../shared/protocol/messages.js";
import { PlatformErrorCode, platformError } from "../../../shared/protocol/errors.js";
import { recordError, recordMessage } from "../utils/metrics.js";
import type { KickPlayerPayload } from "../types.js";
import { RateLimiter } from "../utils/rateLimiter.js";

const RECONNECT_SECONDS = 10;
const KICK_CLOSE_CODE = 4000;

interface GameRoomCreateOptions extends CreateRoomOptions {
  ownerUsername?: string;
}

export class GameRoom extends Room {
  autoDispose = false;
  private roomPassword = "";
  private gameId = "";
  private gameConfig: GameConfigValues | undefined;
  private rps: RockPaperScissorsController | null = null;
  private ownerUsername = "";
  private ownerSessionId: string | null = null;
  private readonly messageLimiter = new RateLimiter(30, 10_000);

  async onCreate(options: GameRoomCreateOptions) {
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
    this.ownerUsername = (options.ownerUsername ?? "").trim();

    if (gameId === "rock-paper-scissors") {
      if (!this.gameConfig) {
        throw new ServerError(400, "锤子剪刀布需要房间配置");
      }
      this.rps = new RockPaperScissorsController(this, this.gameConfig, {
        minPlayers: game.minPlayers,
        getOwnerSessionId: () => this.ownerSessionId,
      });
    }

    const metadata: GameRoomMetadata = {
      roomName,
      gameId: game.id,
      gameName: game.name,
      hasPassword: this.roomPassword.length > 0,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      ownerUsername: options.ownerUsername,
      gameConfig: this.gameConfig,
    };

    this.setMetadata(metadata);

    this.onMessage(CommonMessages.KICK_PLAYER, (client, data: KickPlayerPayload) => {
      recordMessage();
      void this.handleKick(client, data);
    });
  }

  async onAuth(_client: Client, options: JoinRoomOptions) {
    const auth = authenticateToken(options?.token);

    if (this.roomPassword) {
      const password = (options?.password ?? "").trim();
      if (password !== this.roomPassword) {
        throw new ServerError(403, "房间密码错误");
      }
    }

    return auth;
  }

  onJoin(client: Client) {
    this.resolveOwnerSession(client);
    const auth = client.auth as { username?: string } | undefined;
    console.log(`[GameRoom] ${auth?.username ?? client.sessionId} joined ${this.roomId} (${this.gameId})`);
    this.rps?.onJoin(client);
    this.rps?.sendStateTo(client);
  }

  async onLeave(client: Client, consented: boolean) {
    const auth = client.auth as { username?: string } | undefined;
    console.log(`[GameRoom] ${auth?.username ?? client.sessionId} left ${this.roomId} (consented=${consented})`);

    if (!consented) {
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        console.log(`[GameRoom] ${auth?.username ?? client.sessionId} reconnected`);
        return;
      } catch {
        console.log(`[GameRoom] ${auth?.username ?? client.sessionId} reconnection expired`);
      }
    }

    this.rps?.onLeave(client);
    if (client.sessionId === this.ownerSessionId) {
      this.ownerSessionId = null;
    }
  }

  onDispose() {
    this.rps?.dispose();
  }

  private resolveOwnerSession(client: Client): void {
    if (this.ownerSessionId || !this.ownerUsername) {
      return;
    }
    const auth = client.auth as { username?: string } | undefined;
    if (auth?.username === this.ownerUsername) {
      this.ownerSessionId = client.sessionId;
    }
  }

  private async handleKick(client: Client, data: KickPlayerPayload): Promise<void> {
    if (!this.checkMessageRate(client)) return;

    if (!this.ownerSessionId || client.sessionId !== this.ownerSessionId) {
      recordError();
      client.send(CommonMessages.ERROR, platformError(PlatformErrorCode.NOT_OWNER, "只有房主可以踢人"));
      return;
    }

    const targetId = (data?.sessionId ?? "").trim();
    if (!targetId) {
      recordError();
      client.send(CommonMessages.ERROR, platformError(PlatformErrorCode.PLAYER_NOT_FOUND, "请选择要踢出的玩家"));
      return;
    }

    if (targetId === client.sessionId) {
      recordError();
      client.send(CommonMessages.ERROR, platformError(PlatformErrorCode.CANNOT_KICK_SELF, "不能踢出自己"));
      return;
    }

    if (this.rps && !this.rps.canKick()) {
      recordError();
      client.send(CommonMessages.ERROR, platformError(PlatformErrorCode.CANNOT_KICK_NOW, "仅等待阶段可以踢人"));
      return;
    }

    const target = this.clients.find((c) => c.sessionId === targetId);
    if (!target) {
      recordError();
      client.send(CommonMessages.ERROR, platformError(PlatformErrorCode.PLAYER_NOT_FOUND, "玩家不在房间内"));
      return;
    }

    target.send(CommonMessages.KICKED, { message: "你已被房主移出房间" });
    await target.leave(KICK_CLOSE_CODE);
  }

  private checkMessageRate(client: Client): boolean {
    if (this.messageLimiter.tryConsume(client.sessionId)) {
      return true;
    }
    recordError();
    client.send(CommonMessages.ERROR, platformError(
      PlatformErrorCode.RATE_LIMITED,
      "操作过于频繁，请稍后再试"
    ));
    return false;
  }
}
