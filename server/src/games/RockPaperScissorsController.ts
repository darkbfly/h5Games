import type { Client, Room } from "@colyseus/core";
import type { GameConfigValues } from "../gameCatalog.js";

export type RpsChoice = "rock" | "paper" | "scissors";
export type RpsPhase = "waiting" | "playing" | "round_result" | "finished";

const CHOICE_SET = new Set<RpsChoice>(["rock", "paper", "scissors"]);
const ROUND_RESULT_DELAY_MS = 1500;

export interface RpsPlayerState {
  sessionId: string;
  score: number;
  hasChosen: boolean;
}

export interface RpsStatePayload {
  gameId: "rock-paper-scissors";
  phase: RpsPhase;
  round: number;
  choiceTimeSeconds: number;
  winningScore: number;
  deadlineMs: number;
  players: RpsPlayerState[];
  winnerSessionId: string | null;
  message: string;
}

export interface RpsRoundResultPayload {
  round: number;
  choices: Record<string, RpsChoice | null>;
  roundWinnerSessionId: string | null;
  scores: Record<string, number>;
  isDraw: boolean;
  message: string;
}

export class RockPaperScissorsController {
  private readonly choiceTimeSeconds: number;
  private readonly winningScore: number;
  private phase: RpsPhase = "waiting";
  private round = 0;
  private deadlineMs = 0;
  private winnerSessionId: string | null = null;
  private readonly playerOrder: string[] = [];
  private readonly scores = new Map<string, number>();
  private readonly choices = new Map<string, RpsChoice>();
  private roundTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRoundTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly room: Room,
    config: GameConfigValues
  ) {
    this.choiceTimeSeconds = config.choiceTimeSeconds;
    this.winningScore = config.winningScore;
    this.room.onMessage("rps_choose", (client, data: { choice?: string }) => {
      this.handleChoose(client, data?.choice);
    });
  }

  onJoin(client: Client) {
    if (this.playerOrder.includes(client.sessionId)) {
      return;
    }
    if (this.playerOrder.length >= 2) {
      client.send("error", { message: "房间已满" });
      return;
    }

    this.playerOrder.push(client.sessionId);
    this.scores.set(client.sessionId, 0);

    if (this.playerOrder.length === 2) {
      this.startRound();
    } else {
      this.phase = "waiting";
      this.broadcastState("等待另一位玩家加入");
    }
  }

  onLeave(client: Client) {
    this.clearTimers();
    const index = this.playerOrder.indexOf(client.sessionId);
    if (index >= 0) {
      this.playerOrder.splice(index, 1);
    }
    this.scores.delete(client.sessionId);
    this.choices.delete(client.sessionId);

    if (this.phase !== "finished") {
      this.phase = "waiting";
      this.winnerSessionId = null;
      this.broadcastState("对手已离开，等待新玩家");
    }
  }

  sendStateTo(client: Client) {
    client.send("rps_state", this.buildStatePayload());
  }

  dispose() {
    this.clearTimers();
  }

  private handleChoose(client: Client, rawChoice?: string) {
    if (this.phase !== "playing") {
      client.send("error", { message: "当前不可选择" });
      return;
    }

    if (!this.playerOrder.includes(client.sessionId)) {
      client.send("error", { message: "你不是本局玩家" });
      return;
    }

    if (this.choices.has(client.sessionId)) {
      client.send("error", { message: "本回合已选择" });
      return;
    }

    const choice = rawChoice as RpsChoice;
    if (!CHOICE_SET.has(choice)) {
      client.send("error", { message: "无效的选择" });
      return;
    }

    this.choices.set(client.sessionId, choice);
    this.broadcastState("已收到选择");

    if (this.choices.size === 2) {
      this.clearRoundTimer();
      this.settleRound();
    }
  }

  private startRound() {
    this.clearTimers();
    this.round += 1;
    this.phase = "playing";
    this.choices.clear();
    this.deadlineMs = Date.now() + this.choiceTimeSeconds * 1000;
    this.broadcastState(`第 ${this.round} 回合开始`);

    this.roundTimer = setTimeout(() => {
      if (this.phase === "playing") {
        this.settleRound();
      }
    }, this.choiceTimeSeconds * 1000);
  }

  private settleRound() {
    if (this.phase !== "playing") {
      return;
    }

    this.clearRoundTimer();
    this.phase = "round_result";

    const [p1, p2] = this.playerOrder;
    const c1 = this.choices.get(p1) ?? null;
    const c2 = this.choices.get(p2) ?? null;

    let roundWinner: string | null = null;
    let isDraw = false;
    let message = "";

    if (!c1 && !c2) {
      isDraw = true;
      message = "双方都未选择，本回合平局";
    } else if (c1 && !c2) {
      roundWinner = p1;
      message = "对手超时未选择，你获胜";
    } else if (!c1 && c2) {
      roundWinner = p2;
      message = "对手超时未选择，你获胜";
    } else if (c1 && c2) {
      roundWinner = this.compareChoices(c1, c2, p1, p2);
      if (roundWinner) {
        message = "本回合分出胜负";
      } else {
        isDraw = true;
        message = "本回合平局";
      }
    }

    if (roundWinner) {
      this.scores.set(roundWinner, (this.scores.get(roundWinner) ?? 0) + 1);
    }

    const scoresObj: Record<string, number> = {};
    for (const id of this.playerOrder) {
      scoresObj[id] = this.scores.get(id) ?? 0;
    }

    this.room.broadcast("rps_round_result", {
      round: this.round,
      choices: { [p1]: c1, [p2]: c2 },
      roundWinnerSessionId: roundWinner,
      scores: scoresObj,
      isDraw,
      message,
    } satisfies RpsRoundResultPayload);

    const leader = this.getLeader();
    if (leader && (this.scores.get(leader) ?? 0) >= this.winningScore) {
      this.phase = "finished";
      this.winnerSessionId = leader;
      this.broadcastState(`游戏结束，玩家 ${leader.slice(0, 6)} 获胜`);
      return;
    }

    this.broadcastState(message);
    this.nextRoundTimer = setTimeout(() => {
      if (this.playerOrder.length === 2) {
        this.startRound();
      }
    }, ROUND_RESULT_DELAY_MS);
  }

  private compareChoices(
    c1: RpsChoice,
    c2: RpsChoice,
    p1: string,
    p2: string
  ): string | null {
    if (c1 === c2) {
      return null;
    }
    const wins: Record<RpsChoice, RpsChoice> = {
      rock: "scissors",
      scissors: "paper",
      paper: "rock",
    };
    return wins[c1] === c2 ? p1 : p2;
  }

  private getLeader(): string | null {
    const [p1, p2] = this.playerOrder;
    const s1 = this.scores.get(p1) ?? 0;
    const s2 = this.scores.get(p2) ?? 0;
    if (s1 > s2) {
      return p1;
    }
    if (s2 > s1) {
      return p2;
    }
    return null;
  }

  private buildStatePayload(): RpsStatePayload {
    return {
      gameId: "rock-paper-scissors",
      phase: this.phase,
      round: this.round,
      choiceTimeSeconds: this.choiceTimeSeconds,
      winningScore: this.winningScore,
      deadlineMs: this.deadlineMs,
      players: this.playerOrder.map((sessionId) => ({
        sessionId,
        score: this.scores.get(sessionId) ?? 0,
        hasChosen: this.choices.has(sessionId),
      })),
      winnerSessionId: this.winnerSessionId,
      message: "",
    };
  }

  private broadcastState(message: string) {
    const payload = this.buildStatePayload();
    payload.message = message;
    this.room.broadcast("rps_state", payload);
  }

  private clearRoundTimer() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  private clearTimers() {
    this.clearRoundTimer();
    if (this.nextRoundTimer) {
      clearTimeout(this.nextRoundTimer);
      this.nextRoundTimer = null;
    }
  }
}
