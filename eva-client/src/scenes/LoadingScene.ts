import type { NetworkService } from "../network/NetworkService.js";
import type { StateStore } from "../state/StateStore.js";

export class LoadingScene {
  constructor(
    private readonly store: StateStore,
    private readonly network: NetworkService,
    private readonly overlay: HTMLElement,
    private readonly onReady: () => void
  ) {}

  async start(): Promise<void> {
    this.overlay.innerHTML = `
      <div class="panel">
        <h1>H5 Games</h1>
        <div class="status-bar">正在连接服务器...</div>
      </div>
    `;

    try {
      await this.network.connectLobby();
      this.network.requestGames();
      this.network.requestRoomList();
      this.store.setScene("lobby", "已连接，可以创建或加入房间");
      this.onReady();
    } catch (err) {
      const message = err instanceof Error ? err.message : "连接失败";
      this.store.patch({ statusMessage: message });
      const statusBar = this.overlay.querySelector(".status-bar");
      if (statusBar) {
        statusBar.textContent = message;
      }
    }
  }

  dispose(): void {
    this.overlay.innerHTML = "";
  }
}
