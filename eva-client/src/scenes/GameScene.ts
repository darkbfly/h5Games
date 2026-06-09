import { Game } from "@eva/eva.js";
import { RendererSystem } from "@eva/plugin-renderer";
import { GraphicsSystem } from "@eva/plugin-renderer-graphics";
import type { Room } from "colyseus.js";
import type { NetworkService } from "../network/NetworkService.js";
import type { StateStore } from "../state/StateStore.js";
import type { GameModule } from "../games/GameModule.js";
import { RpsGameModule } from "../games/rps/RpsGameModule.js";

const GAME_MODULES: Record<string, () => GameModule> = {
  "rock-paper-scissors": () => new RpsGameModule(),
};

export class GameScene {
  private evaGame: Game | null = null;
  private module: GameModule | null = null;

  constructor(
    private readonly store: StateStore,
    private readonly network: NetworkService,
    private readonly container: HTMLElement,
    private readonly overlay: HTMLElement,
    private readonly onExit: () => void
  ) {}

  start(gameId: string, room: Room): void {
    this.store.setScene("game");
    this.store.patch({ currentGameId: gameId, mySessionId: room.sessionId });

    const canvas = document.createElement("canvas");
    this.container.innerHTML = "";
    this.container.appendChild(canvas);

    this.evaGame = new Game({
      frameRate: 60,
      autoStart: true,
      systems: [
        new RendererSystem({
          canvas,
          width: 750,
          height: 1000,
          backgroundColor: 0x1a1a2e,
        }),
        new GraphicsSystem(),
      ],
    });

    const createModule = GAME_MODULES[gameId];
    if (!createModule) {
      this.overlay.innerHTML = `<div class="panel"><h1>暂不支持该游戏</h1></div>`;
      return;
    }

    this.module = createModule();
    this.module.init({
      game: this.evaGame,
      room,
      store: this.store,
      network: this.network,
      overlay: this.overlay,
      onExit: () => this.onExit(),
    });
    this.module.start();
  }

  dispose(): void {
    this.module?.dispose();
    this.module = null;
    this.evaGame?.destroy();
    this.evaGame = null;
    this.container.innerHTML = "";
    this.overlay.innerHTML = "";
  }
}
