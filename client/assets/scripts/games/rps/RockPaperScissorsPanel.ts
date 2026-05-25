import {
  _decorator,
  Component,
  Node,
  Label,
  Button,
  UITransform,
  Size,
  Color,
  Graphics,
} from "cc";
import type { Room } from "colyseus.js";
import type { RpsChoice, RpsRoundResultPayload, RpsStatePayload } from "./RpsTypes";
import { RPS_LABELS } from "./RpsTypes";

const { ccclass } = _decorator;

@ccclass("RockPaperScissorsPanel")
export class RockPaperScissorsPanel extends Component {
  private room: Room | null = null;
  private mySessionId = "";
  private statusLabel: Label | null = null;
  private scoreLabel: Label | null = null;
  private roundLabel: Label | null = null;
  private timerLabel: Label | null = null;
  private resultLabel: Label | null = null;
  private choiceButtons: Button[] = [];
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private deadlineMs = 0;
  private onBackToLobby: (() => void) | null = null;

  static create(parent: Node, room: Room, onBackToLobby: () => void): RockPaperScissorsPanel {
    const node = new Node("RockPaperScissorsPanel");
    node.parent = parent;
    const panel = node.addComponent(RockPaperScissorsPanel);
    panel.setup(room, onBackToLobby);
    return panel;
  }

  setup(room: Room, onBackToLobby: () => void) {
    this.room = room;
    this.mySessionId = room.sessionId;
    this.onBackToLobby = onBackToLobby;
    this.buildUI();
    this.bindMessages();
  }

  onDestroy() {
    this.clearTimer();
  }

  private buildUI() {
    const width = 420;
    const height = 520;
    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(new Size(width, height));

    const bg = this.node.addComponent(Graphics);
    bg.fillColor = new Color(250, 250, 250, 255);
    bg.rect(-width / 2, -height / 2, width, height);
    bg.fill();

    this.statusLabel = this.addLabel("状态", 22, 220, new Color(30, 30, 30, 255));
    this.scoreLabel = this.addLabel("比分", 18, 180, new Color(60, 60, 60, 255));
    this.roundLabel = this.addLabel("回合", 18, 150, new Color(60, 60, 60, 255));
    this.timerLabel = this.addLabel("倒计时", 18, 120, new Color(60, 60, 60, 255));
    this.resultLabel = this.addLabel("", 16, 80, new Color(180, 60, 60, 255));

    const choices: RpsChoice[] = ["rock", "paper", "scissors"];
    let x = -120;
    for (const choice of choices) {
      const btn = this.addButton(RPS_LABELS[choice], x, 10);
      btn.node.on(Button.EventType.CLICK, () => this.sendChoice(choice), this);
      this.choiceButtons.push(btn);
      x += 120;
    }

    const backBtn = this.addButton("返回大厅", 0, -200);
    backBtn.node.on(Button.EventType.CLICK, () => this.onBackToLobby?.(), this);
  }

  private bindMessages() {
    this.room?.onMessage("rps_state", (data: RpsStatePayload) => {
      this.applyState(data);
    });
    this.room?.onMessage("rps_round_result", (data: RpsRoundResultPayload) => {
      this.applyRoundResult(data);
    });
    this.room?.onMessage("error", (data: { message: string }) => {
      if (this.statusLabel) {
        this.statusLabel.string = data.message;
      }
    });
  }

  private sendChoice(choice: RpsChoice) {
    this.room?.send("rps_choose", { choice });
    this.setChoicesEnabled(false);
  }

  private applyState(state: RpsStatePayload) {
    if (this.statusLabel) {
      this.statusLabel.string = state.message || this.phaseText(state.phase);
    }
    if (this.roundLabel) {
      this.roundLabel.string = `第 ${state.round} 回合 / 目标 ${state.winningScore} 分`;
    }

    const lines = state.players.map((p) => {
      const tag = p.sessionId === this.mySessionId ? "我" : "对手";
      const chosen = p.hasChosen ? "已选" : "未选";
      return `${tag}: ${p.score}分 (${chosen})`;
    });
    if (this.scoreLabel) {
      this.scoreLabel.string = lines.join("  |  ");
    }

    this.deadlineMs = state.deadlineMs;
    this.startTimer();

    const canChoose = state.phase === "playing" && state.players.some((p) => p.sessionId === this.mySessionId);
    const alreadyChosen = state.players.find((p) => p.sessionId === this.mySessionId)?.hasChosen ?? false;
    this.setChoicesEnabled(canChoose && !alreadyChosen);

    if (state.phase === "finished" && state.winnerSessionId) {
      const won = state.winnerSessionId === this.mySessionId;
      if (this.resultLabel) {
        this.resultLabel.string = won ? "你赢了！" : "你输了";
      }
      this.setChoicesEnabled(false);
    }
  }

  private applyRoundResult(result: RpsRoundResultPayload) {
    const myChoice = result.choices[this.mySessionId];
    const opponentId = Object.keys(result.choices).find((id) => id !== this.mySessionId);
    const oppChoice = opponentId ? result.choices[opponentId] : null;

    if (this.resultLabel) {
      const myText = myChoice ? RPS_LABELS[myChoice] : "未出";
      const oppText = oppChoice ? RPS_LABELS[oppChoice] : "未出";
      this.resultLabel.string = `${result.message} | 我:${myText} 对手:${oppText}`;
    }
  }

  private phaseText(phase: RpsStatePayload["phase"]): string {
    switch (phase) {
      case "waiting":
        return "等待玩家";
      case "playing":
        return "请选择";
      case "round_result":
        return "回合结算中";
      case "finished":
        return "游戏结束";
      default:
        return "";
    }
  }

  private setChoicesEnabled(enabled: boolean) {
    for (const btn of this.choiceButtons) {
      btn.interactable = enabled;
    }
  }

  private startTimer() {
    this.clearTimer();
    this.timerHandle = setInterval(() => {
      const remain = Math.max(0, Math.ceil((this.deadlineMs - Date.now()) / 1000));
      if (this.timerLabel) {
        this.timerLabel.string = this.deadlineMs > 0 ? `剩余 ${remain} 秒` : "";
      }
    }, 200);
  }

  private clearTimer() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private addLabel(text: string, fontSize: number, y: number, color: Color): Label {
    const node = new Node("Label");
    node.parent = this.node;
    node.setPosition(0, y, 0);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.color = color;
    return label;
  }

  private addButton(text: string, x: number, y: number): Button {
    const node = new Node(`Btn_${text}`);
    node.parent = this.node;
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(new Size(100, 44));
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(52, 120, 246, 255);
    graphics.rect(-50, -22, 100, 44);
    graphics.fill();
    const labelNode = new Node("label");
    labelNode.parent = node;
    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 18;
    label.color = new Color(255, 255, 255, 255);
    return node.addComponent(Button);
  }
}
