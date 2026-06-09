import { getDefaultGameConfig } from "@shared/gameCatalog.js";
import type { GameDefinition, RoomListItem } from "@shared/protocol/types.js";
import type { NetworkService } from "../network/NetworkService.js";
import type { StateStore } from "../state/StateStore.js";

export class LobbyScene {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly store: StateStore,
    private readonly network: NetworkService,
    private readonly overlay: HTMLElement,
    private readonly onJoinGame: (room: RoomListItem, password?: string) => void,
    private readonly onLogout: () => void
  ) {}

  start(): void {
    this.render();
    this.unsubscribe = this.store.subscribe((state) => {
      if (state.scene !== "lobby") return;
      this.updateStatus(state.statusMessage);
      this.updateCurrentUser(state.currentUser?.username ?? "");
      this.updateRoomList(state.rooms);
      this.updateGameSelect(state.games);
    });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.overlay.innerHTML = "";
  }

  private render(): void {
    const state = this.store.get();
    this.overlay.innerHTML = `
      <div class="lobby-shell">
        <aside class="lobby-sidebar">
          <div>
            <p class="eyebrow">H5 Games</p>
            <h1>游戏大厅</h1>
            <div class="user-badge" id="current-user">欢迎，${state.currentUser?.username ?? "玩家"}</div>
            <div class="status-bar" id="lobby-status">${state.statusMessage}</div>
          </div>

          <button id="btn-toggle-create" class="create-game-button">创建游戏</button>

          <div id="create-room-form" class="side-form hidden">
            <h2>创建房间</h2>
            <div class="form-row">
              <label>房间名</label>
              <input id="room-name" placeholder="输入房间名" />
            </div>
            <div class="form-row">
              <label>密码（可选）</label>
              <input id="room-password" type="password" placeholder="留空为公开房间" />
            </div>
            <div class="form-row">
              <label>游戏</label>
              <select id="game-select"></select>
            </div>
            <div class="form-row" id="config-fields"></div>
            <button id="btn-create" class="full-width">确认创建</button>
          </div>

          <button id="btn-refresh" class="secondary full-width">刷新房间</button>
          <button id="btn-logout" class="ghost full-width">退出用户</button>
        </aside>

        <main class="lobby-main">
          <header class="lobby-header">
            <div>
              <p class="eyebrow">Rooms</p>
              <h2>在线房间</h2>
            </div>
            <div class="toolbar">
              <input id="search-keyword" placeholder="搜索房间名或房主" />
              <button id="btn-search" class="secondary">搜索</button>
            </div>
          </header>

          <section class="quick-join">
            <input id="join-room-id" placeholder="房间 ID" />
            <input id="join-password" type="password" placeholder="密码（如有）" />
            <button id="btn-join-id" class="secondary">ID 加入</button>
          </section>

          <ul class="room-list" id="room-list"></ul>
        </main>
        </div>
      </div>
    `;

    this.overlay.querySelector("#btn-toggle-create")?.addEventListener("click", () => {
      this.overlay.querySelector("#create-room-form")?.classList.toggle("hidden");
    });
    this.overlay.querySelector("#btn-create")?.addEventListener("click", () => this.handleCreate());
    this.overlay.querySelector("#btn-refresh")?.addEventListener("click", () => this.network.requestRoomList());
    this.overlay.querySelector("#btn-logout")?.addEventListener("click", () => this.onLogout());
    this.overlay.querySelector("#btn-search")?.addEventListener("click", () => {
      const keyword = (this.overlay.querySelector("#search-keyword") as HTMLInputElement).value;
      this.network.searchRooms(keyword);
    });
    this.overlay.querySelector("#btn-join-id")?.addEventListener("click", () => this.handleJoinById());
    this.overlay.querySelector("#game-select")?.addEventListener("change", () => this.renderConfigFields());

    this.updateGameSelect(state.games);
    this.updateRoomList(state.rooms);
  }

  private updateStatus(message: string): void {
    const el = this.overlay.querySelector("#lobby-status");
    if (el) el.textContent = message;
  }

  private updateCurrentUser(username: string): void {
    const el = this.overlay.querySelector("#current-user");
    if (el && username) {
      el.textContent = `欢迎，${username}`;
    }
  }

  private updateGameSelect(games: GameDefinition[]): void {
    const select = this.overlay.querySelector("#game-select") as HTMLSelectElement;
    if (!select) return;

    const current = select.value;
    select.innerHTML = games
      .map((g) => `<option value="${g.id}">${g.name} (${g.minPlayers}-${g.maxPlayers}人)</option>`)
      .join("");

    if (current && games.some((g) => g.id === current)) {
      select.value = current;
    } else if (games.some((g) => g.id === "rock-paper-scissors")) {
      select.value = "rock-paper-scissors";
    }

    this.renderConfigFields();
  }

  private renderConfigFields(): void {
    const container = this.overlay.querySelector("#config-fields");
    const select = this.overlay.querySelector("#game-select") as HTMLSelectElement;
    if (!container || !select) return;

    const game = this.store.get().games.find((g) => g.id === select.value);
    if (!game?.configSchema?.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = game.configSchema
      .map(
        (field) => `
        <label>${field.label} (${field.min}-${field.max})</label>
        <input type="number" data-config-key="${field.key}"
          min="${field.min}" max="${field.max}" value="${field.default}" />
      `
      )
      .join("");
  }

  private updateRoomList(rooms: RoomListItem[]): void {
    const list = this.overlay.querySelector("#room-list");
    if (!list) return;

    if (rooms.length === 0) {
      list.innerHTML = `<li class="room-item"><span>暂无房间</span></li>`;
      return;
    }

    list.innerHTML = rooms
      .map(
        (r) => `
        <li class="room-item" data-room-id="${r.roomId}">
          <div>
            <strong>${r.roomName}</strong>
            <div class="room-meta">${r.gameName} | 房主 ${r.ownerUsername ?? "未知"} | ${r.clients}/${r.maxClients}人 ${r.hasPassword ? "🔒" : ""}</div>
          </div>
          <button class="secondary" data-join="${r.roomId}">加入</button>
        </li>
      `
      )
      .join("");

    list.querySelectorAll("[data-join]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const roomId = (btn as HTMLElement).dataset.join!;
        const room = rooms.find((r) => r.roomId === roomId);
        if (room) this.onJoinGame(room);
      });
    });
  }

  private handleCreate(): void {
    const roomName = (this.overlay.querySelector("#room-name") as HTMLInputElement).value;
    const password = (this.overlay.querySelector("#room-password") as HTMLInputElement).value;
    const gameId = (this.overlay.querySelector("#game-select") as HTMLSelectElement).value;

    const gameConfig: Record<string, number> = {};
    this.overlay.querySelectorAll("[data-config-key]").forEach((input) => {
      const el = input as HTMLInputElement;
      gameConfig[el.dataset.configKey!] = Number(el.value);
    });

    try {
      this.network.createRoom({
        roomName,
        password: password || undefined,
        gameId,
        gameConfig: Object.keys(gameConfig).length > 0 ? gameConfig : getDefaultGameConfig(gameId),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建失败";
      this.store.patch({ statusMessage: message });
    }
  }

  private async handleJoinById(): Promise<void> {
    const roomId = (this.overlay.querySelector("#join-room-id") as HTMLInputElement).value.trim();
    const password = (this.overlay.querySelector("#join-password") as HTMLInputElement).value;
    if (!roomId) {
      this.store.patch({ statusMessage: "请输入房间 ID" });
      return;
    }

    const room = this.store.get().rooms.find((r) => r.roomId === roomId);
    const fakeRoom: RoomListItem = room ?? {
      roomId,
      roomName: roomId,
      gameId: "rock-paper-scissors",
      gameName: "锤子剪刀布",
      clients: 0,
      maxClients: 2,
      minPlayers: 2,
      hasPassword: !!password,
    };
    this.onJoinGame(fakeRoom, password || undefined);
  }
}
