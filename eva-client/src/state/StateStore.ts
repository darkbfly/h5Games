import type {
  GameDefinition,
  RoomListItem,
  RpsRoundResultPayload,
  RpsStatePayload,
} from "@shared/protocol/types.js";

export type AppScene = "loading" | "lobby" | "room" | "game";

export interface AppState {
  scene: AppScene;
  statusMessage: string;
  serverUrl: string;
  connected: boolean;
  games: GameDefinition[];
  rooms: RoomListItem[];
  currentRoomId: string | null;
  currentGameId: string | null;
  mySessionId: string | null;
  rpsState: RpsStatePayload | null;
  rpsRoundResult: RpsRoundResultPayload | null;
}

type Listener = (state: AppState) => void;

const DEFAULT_SERVER = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";

export class StateStore {
  private state: AppState = {
    scene: "loading",
    statusMessage: "正在连接...",
    serverUrl: DEFAULT_SERVER,
    connected: false,
    games: [],
    rooms: [],
    currentRoomId: null,
    currentGameId: null,
    mySessionId: null,
    rpsState: null,
    rpsRoundResult: null,
  };

  private listeners = new Set<Listener>();

  get(): Readonly<AppState> {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  patch(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  setScene(scene: AppScene, message?: string): void {
    this.patch({
      scene,
      ...(message !== undefined ? { statusMessage: message } : {}),
    });
  }

  resetGameState(): void {
    this.patch({
      rpsState: null,
      rpsRoundResult: null,
      currentRoomId: null,
      currentGameId: null,
      mySessionId: null,
    });
  }
}
