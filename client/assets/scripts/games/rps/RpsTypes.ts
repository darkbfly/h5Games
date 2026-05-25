export type RpsChoice = "rock" | "paper" | "scissors";
export type RpsPhase = "waiting" | "playing" | "round_result" | "finished";

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

export const RPS_LABELS: Record<RpsChoice, string> = {
  rock: "锤子",
  paper: "布",
  scissors: "剪刀",
};
