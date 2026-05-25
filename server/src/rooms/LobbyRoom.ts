import { Client, Room, matchMaker } from "@colyseus/core";
import { GAME_CATALOG, getGameById, isValidGameId, validateGameConfig } from "../gameCatalog.js";
import type { CreateRoomOptions, RoomListItem } from "../types.js";
import type { GameRoomMetadata } from "../types.js";

export class LobbyRoom extends Room {
  onCreate() {
    this.setPatchRate(0);

    this.onMessage("list_rooms", async (client, payload: { keyword?: string }) => {
      const rooms = await this.queryGameRooms(payload?.keyword);
      client.send("rooms_list", { rooms });
    });

    this.onMessage("search_rooms", async (client, payload: { keyword?: string }) => {
      const keyword = (payload?.keyword ?? "").trim().toLowerCase();
      const rooms = await this.queryGameRooms(keyword);
      client.send("rooms_list", { rooms });
    });

    this.onMessage("get_games", (client) => {
      client.send("games_list", { games: GAME_CATALOG });
    });

    this.onMessage("create_room", async (client, options: CreateRoomOptions) => {
      try {
        const room = await this.createGameRoom(options);
        client.send("room_created", {
          roomId: room.roomId,
          roomName: options.roomName.trim(),
          gameId: options.gameId,
        });
        this.broadcast("room_list_changed", {});
      } catch (err) {
        const message = err instanceof Error ? err.message : "创建房间失败";
        client.send("error", { message });
      }
    });
  }

  onJoin(client: Client) {
    console.log(`[LobbyRoom] ${client.sessionId} joined lobby`);
    void this.sendRoomList(client);
  }

  private async sendRoomList(client: Client, keyword?: string) {
    const rooms = await this.queryGameRooms(keyword);
    client.send("rooms_list", { rooms });
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
