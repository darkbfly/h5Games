import type {
  GameDefinition,
  RoomListItem,
  RpsRoundResultPayload,
  RpsStatePayload,
  UserProfile,
} from "@shared/protocol/types.js";

export type AppScene = "auth" | "loading" | "lobby" | "room" | "game";

export interface AppState {
  scene: AppScene;
  statusMessage: string;
  serverUrl: string;
  connected: boolean;
  authToken: string | null;
  currentUser: UserProfile | null;
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
const AUTH_STORAGE_KEY = "h5games_auth";

function loadStoredAuth(): { token: string; user: UserProfile } | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; user?: UserProfile };
    if (!parsed.token || !parsed.user?.id || !parsed.user?.username) return null;
    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
}

export function peekStoredAuth(): { token: string; user: UserProfile } | null {
  return loadStoredAuth();
}

export class StateStore {
  private state: AppState;

  private listeners = new Set<Listener>();

  constructor() {
    this.state = {
      scene: "auth",
      statusMessage: "请登录或注册",
      serverUrl: DEFAULT_SERVER,
      connected: false,
      authToken: null,
      currentUser: null,
      games: [],
      rooms: [],
      currentRoomId: null,
      currentGameId: null,
      mySessionId: null,
      rpsState: null,
      rpsRoundResult: null,
    };
  }

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

  setAuth(token: string, user: UserProfile): void {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }));
    this.patch({ authToken: token, currentUser: user });
  }

  clearAuth(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.patch({ authToken: null, currentUser: null, scene: "auth", statusMessage: "请登录或注册" });
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
