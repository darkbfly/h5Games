import { Client, Room } from "colyseus.js";
import {
  LobbyMessages,
  RpsMessages,
  CommonMessages,
} from "@shared/protocol/messages.js";
import type { PlatformErrorPayload } from "@shared/protocol/errors.js";
import type {
  AuthResponsePayload,
  CreateRoomOptions,
  GameDefinition,
  RoomCreatedPayload,
  RoomsListPayload,
  RpsRoundResultPayload,
  RpsStatePayload,
  KickedPayload,
} from "@shared/protocol/types.js";
import type { StateStore } from "../state/StateStore.js";

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class NetworkService {
  private client: Client;
  private lobbyRoom: Room | null = null;
  private gameRoom: Room | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private boundLobbyHandlers = false;
  private boundGameHandlers = false;
  private roomCreatedHandler: ((data: RoomCreatedPayload) => void) | null = null;
  private kickedHandler: (() => void) | null = null;
  private handlingKick = false;

  constructor(
    private readonly store: StateStore,
    serverUrl?: string
  ) {
    const url = serverUrl ?? store.get().serverUrl;
    this.client = new Client(url);
  }

  private getHttpBaseUrl(): string {
    return this.store.get().serverUrl.replace(/^ws/, "http").replace(/\/$/, "");
  }

  private requireToken(): string {
    const token = this.store.get().authToken;
    if (!token) {
      throw new Error("请先登录");
    }
    return token;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.getHttpBaseUrl()}/health`);
      if (!res.ok) return false;
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }

  async register(username: string, password: string): Promise<AuthResponsePayload> {
    const res = await fetch(`${this.getHttpBaseUrl()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message ?? "注册失败");
    }
    this.store.setAuth(data.token, data.user);
    return data as AuthResponsePayload;
  }

  async login(username: string, password: string): Promise<AuthResponsePayload> {
    const res = await fetch(`${this.getHttpBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message ?? "登录失败");
    }
    this.store.setAuth(data.token, data.user);
    return data as AuthResponsePayload;
  }

  async connectLobby(): Promise<void> {
    if (this.lobbyRoom) {
      return;
    }

    const token = this.requireToken();
    const healthy = await this.checkHealth();
    if (!healthy) {
      throw new Error("服务器不可用，请确认服务端已启动");
    }

    try {
      this.lobbyRoom = await this.client.joinOrCreate("lobby", { token });
      this.reconnectAttempts = 0;
      this.bindLobbyHandlers();
      this.store.patch({ connected: true, statusMessage: "已连接大厅" });
    } catch (err) {
      throw new Error(this.toUserMessage(err, "连接大厅失败"));
    }
  }

  private bindLobbyHandlers(): void {
    if (!this.lobbyRoom || this.boundLobbyHandlers) return;
    this.boundLobbyHandlers = true;

    this.lobbyRoom.onMessage(LobbyMessages.ROOMS_LIST, (data: RoomsListPayload) => {
      this.store.patch({ rooms: data.rooms ?? [] });
    });

    this.lobbyRoom.onMessage(LobbyMessages.GAMES_LIST, (data: { games: GameDefinition[] }) => {
      this.store.patch({ games: data.games ?? [] });
    });

    this.lobbyRoom.onMessage(LobbyMessages.ROOM_CREATED, (data: RoomCreatedPayload) => {
      this.store.patch({
        statusMessage: `房间「${data.roomName}」创建成功`,
      });
      this.roomCreatedHandler?.(data);
    });

    this.lobbyRoom.onMessage(LobbyMessages.ROOM_LIST_CHANGED, () => {
      this.requestRoomList();
    });

    this.lobbyRoom.onMessage(LobbyMessages.ERROR, (data: PlatformErrorPayload) => {
      this.store.patch({ statusMessage: data.message ?? "操作失败" });
    });

    this.lobbyRoom.onLeave(() => {
      this.lobbyRoom = null;
      this.boundLobbyHandlers = false;
      this.store.patch({ connected: false });
      this.scheduleLobbyReconnect();
    });
  }

  private scheduleLobbyReconnect(): void {
    if (this.reconnectTimer) return;
    if (!this.store.get().authToken) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.store.patch({ statusMessage: "连接已断开，请刷新页面重试" });
      return;
    }

    this.reconnectAttempts += 1;
    this.store.patch({
      statusMessage: `连接断开，${RECONNECT_DELAY_MS / 1000}s 后重连 (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connectLobby();
        this.requestGames();
        this.requestRoomList();
      } catch {
        this.scheduleLobbyReconnect();
      }
    }, RECONNECT_DELAY_MS);
  }

  requestGames(): void {
    this.lobbyRoom?.send(LobbyMessages.GET_GAMES, {});
  }

  requestRoomList(keyword = ""): void {
    this.lobbyRoom?.send(LobbyMessages.LIST_ROOMS, { keyword });
  }

  searchRooms(keyword: string): void {
    this.lobbyRoom?.send(LobbyMessages.SEARCH_ROOMS, { keyword });
  }

  setRoomCreatedHandler(handler: ((data: RoomCreatedPayload) => void) | null): void {
    this.roomCreatedHandler = handler;
  }

  setKickedHandler(handler: (() => void) | null): void {
    this.kickedHandler = handler;
  }

  createRoom(options: CreateRoomOptions): void {
    const roomName = options.roomName.trim();
    if (!roomName) {
      throw new Error("请输入房间名");
    }
    if (!options.gameId) {
      throw new Error("请选择游戏");
    }
    this.lobbyRoom?.send(LobbyMessages.CREATE_ROOM, {
      roomName,
      password: options.password?.trim() || undefined,
      gameId: options.gameId,
      gameConfig: options.gameConfig,
    });
  }

  async joinRoom(roomId: string, password?: string): Promise<Room> {
    const token = this.requireToken();
    try {
      this.gameRoom = await this.client.joinById(roomId, {
        token,
        password: password?.trim() || undefined,
      });
      this.bindGameHandlers();
      this.store.patch({
        currentRoomId: roomId,
        mySessionId: this.gameRoom.sessionId,
      });
      return this.gameRoom;
    } catch (err) {
      throw new Error(this.toUserMessage(err, "加入房间失败"));
    }
  }

  private bindGameHandlers(): void {
    if (!this.gameRoom || this.boundGameHandlers) return;
    this.boundGameHandlers = true;

    this.gameRoom.onMessage(RpsMessages.STATE, (data: RpsStatePayload) => {
      this.store.patch({ rpsState: data });
    });

    this.gameRoom.onMessage(RpsMessages.ROUND_RESULT, (data: RpsRoundResultPayload) => {
      this.store.patch({ rpsRoundResult: data });
    });

    this.gameRoom.onMessage(CommonMessages.ERROR, (data: PlatformErrorPayload) => {
      this.store.patch({ statusMessage: data.message });
    });

    this.gameRoom.onMessage(CommonMessages.KICKED, (data: KickedPayload) => {
      if (this.handlingKick) return;
      this.handlingKick = true;
      this.store.patch({ statusMessage: data.message ?? "你已被房主移出房间" });
      this.kickedHandler?.();
    });

    this.gameRoom.onLeave(() => {
      this.gameRoom = null;
      this.boundGameHandlers = false;
      this.handlingKick = false;
    });
  }

  sendRpsChoice(choice: string): void {
    this.gameRoom?.send(RpsMessages.CHOOSE, { choice });
  }

  sendRpsReady(): void {
    this.gameRoom?.send(RpsMessages.READY, {});
  }

  sendKickPlayer(sessionId: string): void {
    this.gameRoom?.send(CommonMessages.KICK_PLAYER, { sessionId });
  }

  async leaveGameRoom(): Promise<void> {
    if (this.gameRoom) {
      await this.gameRoom.leave();
      this.gameRoom = null;
    }
    this.boundGameHandlers = false;
    this.handlingKick = false;
    this.store.resetGameState();
  }

  logout(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.roomCreatedHandler = null;
    this.kickedHandler = null;
    void this.gameRoom?.leave();
    void this.lobbyRoom?.leave();
    this.gameRoom = null;
    this.lobbyRoom = null;
    this.boundLobbyHandlers = false;
    this.reconnectAttempts = 0;
    this.store.patch({ connected: false, rooms: [], games: [] });
    this.store.resetGameState();
    this.store.clearAuth();
  }

  getGameRoom(): Room | null {
    return this.gameRoom;
  }

  private toUserMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) {
      if (/password|密码|403|WRONG_PASSWORD/i.test(err.message)) {
        return "房间密码错误";
      }
      if (/401|未登录|登录已失效|UNAUTHORIZED/i.test(err.message)) {
        return "登录已失效，请重新登录";
      }
      if (/locked|full|满|ROOM_FULL/i.test(err.message)) {
        return "房间已满";
      }
      return err.message || fallback;
    }
    return fallback;
  }

  dispose(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    void this.leaveGameRoom();
    void this.lobbyRoom?.leave();
    this.lobbyRoom = null;
    this.boundLobbyHandlers = false;
  }
}
