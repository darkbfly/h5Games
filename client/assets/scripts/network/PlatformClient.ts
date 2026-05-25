import { Client, Room } from "colyseus.js";
import type { GameDefinition } from "../config/GameCatalog";

export interface RoomListItem {
  roomId: string;
  roomName: string;
  gameId: string;
  gameName: string;
  clients: number;
  maxClients: number;
  minPlayers: number;
  hasPassword: boolean;
}

export interface CreateRoomPayload {
  roomName: string;
  password?: string;
  gameId: string;
}

const DEFAULT_SERVER_URL = "ws://localhost:2567";

export class PlatformClient {
  private client: Client;
  private lobbyRoom: Room | null = null;
  private gameRoom: Room | null = null;

  constructor(serverUrl: string = DEFAULT_SERVER_URL) {
    this.client = new Client(serverUrl);
  }

  async connectLobby(): Promise<Room> {
    if (this.lobbyRoom) {
      return this.lobbyRoom;
    }
    try {
      this.lobbyRoom = await this.client.joinOrCreate("lobby");
      return this.lobbyRoom;
    } catch (err) {
      throw new Error(this.toUserMessage(err, "连接大厅失败"));
    }
  }

  onRoomsList(callback: (rooms: RoomListItem[]) => void): void {
    this.lobbyRoom?.onMessage("rooms_list", (data: { rooms: RoomListItem[] }) => {
      callback(data.rooms ?? []);
    });
  }

  onGamesList(callback: (games: GameDefinition[]) => void): void {
    this.lobbyRoom?.onMessage("games_list", (data: { games: GameDefinition[] }) => {
      callback(data.games ?? []);
    });
  }

  onRoomCreated(callback: (roomId: string, roomName: string) => void): void {
    this.lobbyRoom?.onMessage("room_created", (data: { roomId: string; roomName: string }) => {
      callback(data.roomId, data.roomName);
    });
  }

  onError(callback: (message: string) => void): void {
    this.lobbyRoom?.onMessage("error", (data: { message: string }) => {
      callback(data.message ?? "操作失败");
    });
  }

  onRoomListChanged(callback: () => void): void {
    this.lobbyRoom?.onMessage("room_list_changed", () => {
      callback();
    });
  }

  requestGames(): void {
    this.lobbyRoom?.send("get_games", {});
  }

  requestRoomList(keyword?: string): void {
    this.lobbyRoom?.send("list_rooms", { keyword: keyword ?? "" });
  }

  searchRooms(keyword: string): void {
    this.lobbyRoom?.send("search_rooms", { keyword });
  }

  async createRoom(payload: CreateRoomPayload): Promise<void> {
    const roomName = payload.roomName.trim();
    if (!roomName) {
      throw new Error("请输入房间名");
    }
    if (!payload.gameId) {
      throw new Error("请选择游戏");
    }
    this.lobbyRoom?.send("create_room", {
      roomName,
      password: payload.password?.trim() || undefined,
      gameId: payload.gameId,
    });
  }

  async joinRoom(roomId: string, password?: string): Promise<Room> {
    try {
      this.gameRoom = await this.client.joinById(roomId, {
        password: password?.trim() || undefined,
      });
      return this.gameRoom;
    } catch (err) {
      throw new Error(this.toUserMessage(err, "加入房间失败"));
    }
  }

  getGameRoom(): Room | null {
    return this.gameRoom;
  }

  getLobbyRoom(): Room | null {
    return this.lobbyRoom;
  }

  private toUserMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) {
      if (/password|密码|403/i.test(err.message)) {
        return "房间密码错误";
      }
      if (/locked|full|满/i.test(err.message)) {
        return "房间已满";
      }
      return err.message || fallback;
    }
    return fallback;
  }
}
