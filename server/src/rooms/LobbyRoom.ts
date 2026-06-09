import { Client, Room, matchMaker } from "@colyseus/core";
import { GAME_CATALOG, getGameById, isValidGameId, validateGameConfig } from "../gameCatalog.js";
import type { CreateRoomOptions, RoomListItem } from "../types.js";
import type { GameRoomMetadata } from "../types.js";
import { LobbyMessages } from "../../../shared/protocol/messages.js";
import { PlatformErrorCode, platformError } from "../../../shared/protocol/errors.js";
import { RateLimiter } from "../utils/rateLimiter.js";
import { recordError, recordMessage } from "../utils/metrics.js";

const createRoomLimiter = new RateLimiter(5, 60_000);
const messageLimiter = new RateLimiter(60, 10_000);

export class LobbyRoom extends Room {
  onCreate() {
    this.setPatchRate(0);

    this.onMessage(LobbyMessages.LIST_ROOMS, async (client, payload: { keyword?: string }) => {
      if (!this.checkMessageRate(client)) return;
      recordMessage();
      const rooms = await this.queryGameRooms(payload?.keyword);
      client.send(LobbyMessages.ROOMS_LIST, { rooms });
    });

    this.onMessage(LobbyMessages.SEARCH_ROOMS, async (client, payload: { keyword?: string }) => {
      if (!this.checkMessageRate(client)) return;
      recordMessage();
      const keyword = (payload?.keyword ?? "").trim().toLowerCase();
      const rooms = await this.queryGameRooms(keyword);
      client.send(LobbyMessages.ROOMS_LIST, { rooms });
    });

    this.onMessage(LobbyMessages.GET_GAMES, (client) => {
      if (!this.checkMessageRate(client)) return;
      recordMessage();
      client.send(LobbyMessages.GAMES_LIST, { games: GAME_CATALOG });
    });

    this.onMessage(LobbyMessages.CREATE_ROOM, async (client, options: CreateRoomOptions) => {
      if (!this.checkMessageRate(client)) return;
      recordMessage();

      if (!createRoomLimiter.tryConsume(client.sessionId)) {
        recordError();
        client.send(LobbyMessages.ERROR, platformError(
          PlatformErrorCode.RATE_LIMITED,
          "创建房间过于频繁，请稍后再试"
        ));
        return;
      }

      try {
        const room = await this.createGameRoom(options);
        client.send(LobbyMessages.ROOM_CREATED, {
          roomId: room.roomId,
          roomName: options.roomName.trim(),
          gameId: options.gameId,
        });
        this.broadcast(LobbyMessages.ROOM_LIST_CHANGED, {});
      } catch (err) {
        recordError();
        const message = err instanceof Error ? err.message : "创建房间失败";
        const code =
          message.includes("游戏") ? PlatformErrorCode.INVALID_GAME :
          message.includes("之间") ? PlatformErrorCode.INVALID_CONFIG :
          message.includes("房间名") ? PlatformErrorCode.ROOM_NAME_EMPTY :
          PlatformErrorCode.UNKNOWN;
        client.send(LobbyMessages.ERROR, platformError(code, message));
      }
    });
  }

  onJoin(client: Client) {
    console.log(`[LobbyRoom] ${client.sessionId} joined lobby`);
    void this.sendRoomList(client);
  }

  private checkMessageRate(client: Client): boolean {
    if (!messageLimiter.tryConsume(client.sessionId)) {
      recordError();
      client.send(LobbyMessages.ERROR, platformError(
        PlatformErrorCode.RATE_LIMITED,
        "操作过于频繁，请稍后再试"
      ));
      return false;
    }
    return true;
  }

  private async sendRoomList(client: Client, keyword?: string) {
    const rooms = await this.queryGameRooms(keyword);
    client.send(LobbyMessages.ROOMS_LIST, { rooms });
  }

  private async queryGameRooms(keyword?: string): Promise<RoomListItem[]> {
    const entries = await matchMaker.query({ name: "game_room" });
    const normalizedKeyword = (keyword ?? "").trim().toLowerCase();

    const rooms: RoomListItem[] = [];

    for (const entry of entries) {
      const metadata = entry.metadata as GameRoomMetadata | undefined;
      if (!metadata?.roomName) {
        continue;
      }

      if (
        normalizedKeyword &&
        !metadata.roomName.toLowerCase().includes(normalizedKeyword) &&
        !entry.roomId.toLowerCase().includes(normalizedKeyword)
      ) {
        continue;
      }

      rooms.push({
        roomId: entry.roomId,
        roomName: metadata.roomName,
        gameId: metadata.gameId,
        gameName: metadata.gameName,
        clients: entry.clients,
        maxClients: entry.maxClients,
        minPlayers: metadata.minPlayers,
        hasPassword: metadata.hasPassword,
      });
    }

    return rooms.sort((a, b) => a.roomName.localeCompare(b.roomName));
  }

  private async createGameRoom(options: CreateRoomOptions) {
    const roomName = (options.roomName ?? "").trim();
    const gameId = options.gameId ?? "";
    const password = (options.password ?? "").trim();

    if (!roomName) {
      throw new Error("房间名不能为空");
    }

    if (!isValidGameId(gameId)) {
      throw new Error("请选择有效的游戏");
    }

    const game = getGameById(gameId)!;
    const gameConfig = validateGameConfig(gameId, options.gameConfig);

    return matchMaker.createRoom("game_room", {
      roomName,
      password: password || undefined,
      gameId: game.id,
      gameConfig,
    });
  }
}
