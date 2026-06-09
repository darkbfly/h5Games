import type { RoomListItem } from "@shared/protocol/types.js";
import type { StateStore } from "../state/StateStore.js";

/** 过渡场景：加入房间后等待进入游戏 */
export class RoomScene {
  constructor(
    private readonly store: StateStore,
    private readonly overlay: HTMLElement,
    private readonly room: RoomListItem
  ) {}

  start(): void {
    this.store.setScene("room", `正在进入「${this.room.roomName}」...`);
    this.overlay.innerHTML = `
      <div class="panel">
        <h1>进入房间</h1>
        <div class="status-bar">${this.room.gameName} - ${this.room.roomName}</div>
        <p style="margin-top:12px;font-size:13px;color:#aaa">正在连接游戏房间...</p>
      </div>
    `;
  }

  dispose(): void {
    this.overlay.innerHTML = "";
  }
}
