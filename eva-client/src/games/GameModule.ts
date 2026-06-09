import type { Game } from "@eva/eva.js";
import type { Room } from "colyseus.js";
import type { StateStore } from "../state/StateStore.js";
import type { NetworkService } from "../network/NetworkService.js";

export interface GameModuleContext {
  game: Game;
  room: Room;
  store: StateStore;
  network: NetworkService;
  overlay: HTMLElement;
  onExit: () => void;
}

export interface GameModule {
  readonly gameId: string;
  init(ctx: GameModuleContext): void;
  start(): void;
  applyServerState(): void;
  handleInput?(action: string): void;
  dispose(): void;
}
