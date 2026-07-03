import type { CreateRoomOptions, RoomListItem } from "@shared/protocol/types.js";
import { StateStore } from "../state/StateStore.js";
import { NetworkService } from "../network/NetworkService.js";
import { AuthScene } from "../scenes/AuthScene.js";
import { LoadingScene } from "../scenes/LoadingScene.js";
import { LobbyScene } from "../scenes/LobbyScene.js";
import { RoomScene } from "../scenes/RoomScene.js";

type ActiveGameScene = {
  start(gameId: string, room: unknown): void;
  dispose(): void;
};

export class App {
  private readonly store = new StateStore();
  private readonly network = new NetworkService(this.store);
  private readonly container: HTMLElement;
  private readonly overlay: HTMLElement;

  private authScene: AuthScene | null = null;
  private loadingScene: LoadingScene | null = null;
  private lobbyScene: LobbyScene | null = null;
  private roomScene: RoomScene | null = null;
  private gameScene: ActiveGameScene | null = null;
  private pendingCreatePassword?: string;

  constructor() {
    const container = document.querySelector("#game-container");
    const overlay = document.querySelector("#ui-overlay");
    if (!container || !overlay) {
      throw new Error("缺少 #game-container 或 #ui-overlay");
    }
    this.container = container as HTMLElement;
    this.overlay = overlay as HTMLElement;
  }

  async start(): Promise<void> {
    const state = this.store.get();
    if (state.authToken && state.currentUser) {
      await this.enterPlatform();
      return;
    }

    this.authScene = new AuthScene(
      this.store,
      this.network,
      this.overlay,
      () => void this.handleAuthenticated()
    );
    this.authScene.start();
  }

  private async handleAuthenticated(): Promise<void> {
    this.authScene?.dispose();
    this.authScene = null;
    await this.enterPlatform();
  }

  private async enterPlatform(): Promise<void> {
    this.loadingScene = new LoadingScene(
      this.store,
      this.network,
      this.overlay,
      () => this.showLobby()
    );
    await this.loadingScene.start();
  }

  private showLobby(): void {
    this.loadingScene?.dispose();
    this.loadingScene = null;

    this.network.setRoomCreatedHandler((data) => {
      void this.handleRoomCreated(data);
    });

    this.lobbyScene = new LobbyScene(
      this.store,
      this.network,
      this.overlay,
      (room, password) => void this.handleJoinRoom(room, password),
      () => this.logout(),
      (options) => this.handleCreateRoom(options)
    );
    this.lobbyScene.start();
  }

  private handleCreateRoom(options: CreateRoomOptions): void {
    this.pendingCreatePassword = options.password;
    this.network.createRoom(options);
  }

  private handleRoomCreated(data: { roomId: string; roomName: string; gameId: string }): void {
    const game = this.store.get().games.find((g) => g.id === data.gameId);
    const room: RoomListItem = {
      roomId: data.roomId,
      roomName: data.roomName,
      gameId: data.gameId,
      gameName: game?.name ?? data.gameId,
      clients: 1,
      maxClients: game?.maxPlayers ?? 2,
      minPlayers: game?.minPlayers ?? 2,
      hasPassword: !!this.pendingCreatePassword,
      ownerUsername: this.store.get().currentUser?.username,
    };
    const password = this.pendingCreatePassword;
    this.pendingCreatePassword = undefined;
    void this.handleJoinRoom(room, password);
  }

  private async handleJoinRoom(room: RoomListItem, password?: string): Promise<void> {
    if (room.hasPassword && !password) {
      this.store.patch({ statusMessage: "该房间需要密码，请使用下方 ID+密码 加入" });
      const joinId = this.overlay.querySelector("#join-room-id") as HTMLInputElement;
      if (joinId) joinId.value = room.roomId;
      return;
    }

    this.network.setRoomCreatedHandler(null);
    this.lobbyScene?.dispose();
    this.lobbyScene = null;

    this.roomScene = new RoomScene(
      this.store,
      this.overlay,
      room,
      () => void this.exitRoom(),
      () => this.network.sendRpsReady(),
      (sessionId) => this.network.sendKickPlayer(sessionId),
      () => void this.enterGame(room.gameId)
    );
    this.roomScene.start();

    this.network.setKickedHandler(() => void this.handleKicked());

    try {
      await this.network.joinRoom(room.roomId, password);
      this.roomScene.setConnected();
    } catch (err) {
      const message = err instanceof Error ? err.message : "加入失败";
      this.store.patch({ statusMessage: message });
      this.network.setKickedHandler(null);
      this.roomScene?.dispose();
      this.roomScene = null;
      this.showLobby();
    }
  }

  private async handleKicked(): Promise<void> {
    this.network.setKickedHandler(null);
    this.roomScene?.dispose();
    this.roomScene = null;
    this.gameScene?.dispose();
    this.gameScene = null;
    await this.network.leaveGameRoom();
    this.store.resetGameState();
    this.showLobby();
    this.network.requestRoomList();
  }

  private async enterGame(gameId: string): Promise<void> {
    if (this.gameScene) return;

    const gameRoom = this.network.getGameRoom();
    if (!gameRoom) return;

    this.roomScene?.dispose();
    this.roomScene = null;

    const { GameScene } = await import("../scenes/GameScene.js");
    this.gameScene = new GameScene(
      this.store,
      this.network,
      this.container,
      this.overlay,
      () => void this.exitToLobby()
    );
    this.gameScene.start(gameId, gameRoom);
  }

  private async exitRoom(): Promise<void> {
    this.network.setKickedHandler(null);
    this.roomScene?.dispose();
    this.roomScene = null;
    await this.network.leaveGameRoom();
    this.showLobby();
    this.network.requestRoomList();
  }

  private async exitToLobby(): Promise<void> {
    this.network.setKickedHandler(null);
    this.gameScene?.dispose();
    this.gameScene = null;
    await this.network.leaveGameRoom();
    this.store.resetGameState();
    this.showLobby();
    this.network.requestRoomList();
  }

  private logout(): void {
    this.network.setRoomCreatedHandler(null);
    this.pendingCreatePassword = undefined;
    this.gameScene?.dispose();
    this.gameScene = null;
    this.roomScene?.dispose();
    this.roomScene = null;
    this.lobbyScene?.dispose();
    this.lobbyScene = null;
    this.loadingScene?.dispose();
    this.loadingScene = null;

    this.network.logout();
    this.authScene = new AuthScene(
      this.store,
      this.network,
      this.overlay,
      () => void this.handleAuthenticated()
    );
    this.authScene.start();
  }
}
