import { GameObject } from "@eva/eva.js";
import { Graphics } from "@eva/plugin-renderer-graphics";
import type { RpsChoice } from "@shared/protocol/types.js";
import type { GameModule, GameModuleContext } from "../GameModule.js";

const RPS_LABELS: Record<RpsChoice, string> = {
  rock: "锤子",
  paper: "布",
  scissors: "剪刀",
};

export class RpsGameModule implements GameModule {
  readonly gameId = "rock-paper-scissors";

  private ctx: GameModuleContext | null = null;
  private hudEl: HTMLElement | null = null;
  private actionsEl: HTMLElement | null = null;
  private bgObject: GameObject | null = null;
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;

  init(ctx: GameModuleContext): void {
    this.ctx = ctx;
    this.buildCanvasBackground();
    this.buildHud();
    this.unsubscribe = ctx.store.subscribe(() => this.applyServerState());
  }

  start(): void {
    this.applyServerState();
  }

  applyServerState(): void {
    if (!this.ctx || !this.hudEl) return;

    const state = this.ctx.store.get().rpsState;
    const result = this.ctx.store.get().rpsRoundResult;
    const myId = this.ctx.store.get().mySessionId;

    if (!state) {
      this.hudEl.innerHTML = "<div>等待游戏状态...</div>";
      return;
    }

    const statusEl = this.hudEl.querySelector(".status") as HTMLElement;
    const scoreEl = this.hudEl.querySelector(".score") as HTMLElement;
    const timerEl = this.hudEl.querySelector(".timer") as HTMLElement;
    const resultEl = this.hudEl.querySelector(".result") as HTMLElement;

    statusEl.textContent = state.message || this.phaseText(state.phase);
    scoreEl.textContent = state.players
      .map((p) => {
        const tag = p.sessionId === myId ? "我" : "对手";
        return `${tag}: ${p.score}分 (${p.hasChosen ? "已选" : "未选"})`;
      })
      .join("  |  ");

    if (state.deadlineMs > 0 && state.phase === "playing") {
      const remain = Math.max(0, Math.ceil((state.deadlineMs - Date.now()) / 1000));
      timerEl.textContent = `${remain}s`;
      this.startTimer(state.deadlineMs);
    } else {
      timerEl.textContent = "";
      this.clearTimer();
    }

    if (result && resultEl) {
      const myChoice = myId ? result.choices[myId] : null;
      const oppId = Object.keys(result.choices).find((id) => id !== myId);
      const oppChoice = oppId ? result.choices[oppId] : null;
      const myText = myChoice ? RPS_LABELS[myChoice] : "未出";
      const oppText = oppChoice ? RPS_LABELS[oppChoice] : "未出";
      resultEl.textContent = `${result.message} | 我:${myText} 对手:${oppText}`;
    }

    if (state.phase === "finished" && state.winnerSessionId) {
      const won = state.winnerSessionId === myId;
      resultEl.textContent = won ? "你赢了！" : "你输了";
      this.setChoicesEnabled(false);
      return;
    }

    const me = state.players.find((p) => p.sessionId === myId);
    const canChoose = state.phase === "playing" && !!me && !me.hasChosen;
    this.setChoicesEnabled(canChoose);
  }

  handleInput(action: string): void {
    if (!this.ctx) return;
    this.ctx.network.sendRpsChoice(action);
    this.setChoicesEnabled(false);
  }

  dispose(): void {
    this.clearTimer();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.hudEl?.remove();
    this.actionsEl?.remove();
    this.hudEl = null;
    this.actionsEl = null;
    if (this.bgObject && this.ctx) {
      this.ctx.game.scene.removeChild(this.bgObject);
    }
    this.bgObject = null;
    this.ctx = null;
  }

  private buildCanvasBackground(): void {
    if (!this.ctx) return;

    const bg = new GameObject("rps-bg", {
      size: { width: 750, height: 1000 },
      position: { x: 375, y: 500 },
    });

    bg.addComponent(
      new Graphics({
        graphics: {
          fill: { color: 0x16213e, alpha: 1 },
          shape: {
            width: 750,
            height: 1000,
            radius: 0,
          },
        },
      })
    );

    this.ctx.game.scene.addChild(bg);
    this.bgObject = bg;
  }

  private buildHud(): void {
    if (!this.ctx) return;

    const overlay = this.ctx.overlay;

    this.hudEl = document.createElement("div");
    this.hudEl.className = "game-hud";
    this.hudEl.innerHTML = `
      <div class="status">等待中</div>
      <div class="score"></div>
      <div class="timer"></div>
      <div class="result" style="font-size:13px;margin-top:8px;color:#a8dadc"></div>
    `;
    overlay.appendChild(this.hudEl);

    this.actionsEl = document.createElement("div");
    this.actionsEl.className = "game-actions";

    for (const [choice, label] of Object.entries(RPS_LABELS)) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.dataset.choice = choice;
      btn.addEventListener("click", () => this.handleInput(choice));
      this.actionsEl.appendChild(btn);
    }

    const backBtn = document.createElement("button");
    backBtn.textContent = "返回大厅";
    backBtn.className = "secondary";
    backBtn.style.position = "absolute";
    backBtn.style.bottom = "20px";
    backBtn.style.right = "20px";
    backBtn.addEventListener("click", () => this.ctx?.onExit());
    overlay.appendChild(backBtn);

    overlay.appendChild(this.actionsEl);
  }

  private setChoicesEnabled(enabled: boolean): void {
    if (!this.actionsEl) return;
    for (const btn of this.actionsEl.querySelectorAll("button[data-choice]")) {
      (btn as HTMLButtonElement).disabled = !enabled;
    }
  }

  private phaseText(phase: string): string {
    switch (phase) {
      case "waiting": return "等待玩家";
      case "playing": return "请选择";
      case "round_result": return "回合结算中";
      case "finished": return "游戏结束";
      default: return "";
    }
  }

  private startTimer(deadlineMs: number): void {
    this.clearTimer();
    this.timerHandle = setInterval(() => {
      if (!this.hudEl) return;
      const timerEl = this.hudEl.querySelector(".timer") as HTMLElement;
      const remain = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      timerEl.textContent = remain > 0 ? `${remain}s` : "";
    }, 200);
  }

  private clearTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
