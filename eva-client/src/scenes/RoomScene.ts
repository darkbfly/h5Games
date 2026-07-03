import type { RoomListItem, RpsStatePayload } from "@shared/protocol/types.js";
import type { StateStore } from "../state/StateStore.js";
import { escapeHtml } from "../utils/escapeHtml.js";
/** 房间内等待界面：显示房间信息与玩家，全员准备后进入游戏 */
export class RoomScene {
  private unsubscribe: (() => void) | null = null;
  private connected = false;
  private gameEntered = false;
  private listClickBound = false;

  constructor(
    private readonly store: StateStore,
    private readonly overlay: HTMLElement,
    private readonly room: RoomListItem,
    private readonly onLeave: () => void,
    private readonly onReady: () => void,
    private readonly onKick: (sessionId: string) => void,
    private readonly onGameStart: () => void
  ) {}

  start(): void {
    this.store.setScene("room", "正在进入房间...");
    this.render();
    this.unsubscribe = this.store.subscribe((state) => {
      if (state.scene !== "room") return;
      this.updateStatus(state.statusMessage);
      if (this.connected) {
        this.updatePlayers(state.rpsState);
        this.updateReadyButton(state.rpsState);
        this.maybeStartGame(state.rpsState);
      }
    });
  }

  setConnected(): void {
    this.connected = true;
    this.store.patch({ statusMessage: "已加入房间，请点击准备" });
    const statusEl = this.overlay.querySelector("#room-status");
    if (statusEl) statusEl.textContent = "已加入房间，请点击准备";
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listClickBound = false;
    this.overlay.innerHTML = "";
  }

  private render(): void {
    const owner = escapeHtml(this.room.ownerUsername ?? "未知");
    const roomName = escapeHtml(this.room.roomName);
    const gameName = escapeHtml(this.room.gameName);
    const roomId = escapeHtml(this.room.roomId);
    this.overlay.innerHTML = `
      <div class="room-shell">
        <div class="room-card">
          <p class="eyebrow">游戏房间</p>
          <h1>${roomName}</h1>
          <div class="room-info">
            <span>${gameName}</span>
            <span>房主 ${owner}</span>
            <span>ID ${roomId}</span>
          </div>          <div class="status-bar" id="room-status">正在连接房间...</div>

          <section class="room-players-section">
            <h2>玩家 <span id="player-count">0/${this.room.maxClients}</span></h2>
            <ul class="room-player-list" id="player-list">
              <li class="room-player-item muted">连接中...</li>
            </ul>
          </section>

          <p class="room-hint" id="room-hint">人数达到 ${this.room.minPlayers} 人后，全员准备即可开始</p>
          <button id="btn-ready" class="full-width">准备</button>
          <button id="btn-leave-room" class="secondary full-width">返回大厅</button>
        </div>
      </div>
    `;

    this.overlay.querySelector("#btn-ready")?.addEventListener("click", () => {
      this.onReady();
    });
    this.overlay.querySelector("#btn-leave-room")?.addEventListener("click", () => {
      this.onLeave();
    });
  }

  private bindPlayerListActions(): void {
    if (this.listClickBound) return;
    const list = this.overlay.querySelector("#player-list");
    if (!list) return;

    list.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-kick]");
      if (!target?.dataset.kick) return;
      this.onKick(target.dataset.kick);
    });
    this.listClickBound = true;
  }

  private isRoomOwner(state: RpsStatePayload | null): boolean {
    const myId = this.store.get().mySessionId;
    if (myId && state?.ownerSessionId) {
      return state.ownerSessionId === myId;
    }
    const username = this.store.get().currentUser?.username;
    return !!username && username === this.room.ownerUsername;
  }

  private updateStatus(message: string): void {
    if (!this.connected || !message) return;
    const el = this.overlay.querySelector("#room-status");
    if (el) el.textContent = message;
  }

  private updatePlayers(state: RpsStatePayload | null): void {
    const list = this.overlay.querySelector("#player-list");
    const countEl = this.overlay.querySelector("#player-count");
    const hintEl = this.overlay.querySelector("#room-hint");
    if (!list || !countEl) return;

    const players = state?.players ?? [];
    const count = players.length;
    const myId = this.store.get().mySessionId;
    const isOwner = this.isRoomOwner(state);
    const canKick = isOwner && state?.phase === "waiting";

    countEl.textContent = `${count}/${this.room.maxClients}`;

    if (count === 0) {
      list.innerHTML = `<li class="room-player-item muted">等待玩家加入...</li>`;
    } else {
      list.innerHTML = players
        .map((p) => {
          const tag = p.sessionId === myId ? "（我）" : "";
          const readyLabel = p.isReady
            ? `<span class="ready-tag">已准备</span>`
            : `<span class="not-ready-tag">未准备</span>`;
          const kickBtn =
            canKick && p.sessionId !== myId
              ? `<button type="button" class="kick-btn" data-kick="${escapeHtml(p.sessionId)}">踢出</button>`
              : "";
          return `<li class="room-player-item"><span>${escapeHtml(p.username)}${tag}</span><div class="room-player-actions">${readyLabel}${kickBtn}</div></li>`;
        })
        .join("");
      this.bindPlayerListActions();
    }

    if (hintEl && state) {
      if (state.message) {
        hintEl.textContent = state.message;
      } else if (count < this.room.minPlayers) {
        hintEl.textContent = `还需 ${this.room.minPlayers - count} 名玩家`;
      } else {
        const readyCount = players.filter((p) => p.isReady).length;
        hintEl.textContent = `已准备 ${readyCount}/${count} 人，全员准备后开始`;
      }
    }
  }

  private updateReadyButton(state: RpsStatePayload | null): void {
    const btn = this.overlay.querySelector("#btn-ready") as HTMLButtonElement | null;
    if (!btn || !state) return;

    const myId = this.store.get().mySessionId;
    const me = state.players.find((p) => p.sessionId === myId);
    const canReady = state.phase === "waiting" && !!me && !me.isReady;

    btn.disabled = !canReady;
    btn.textContent = me?.isReady ? "已准备" : "准备";
  }

  private maybeStartGame(state: RpsStatePayload | null): void {
    if (this.gameEntered || !state) return;
    if (state.phase === "playing" || state.phase === "round_result" || state.phase === "finished") {
      this.gameEntered = true;
      this.onGameStart();
    }
  }
}
