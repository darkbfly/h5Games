import type { GameConfigValues, GameDefinition } from "../gameCatalog.js";

export interface RoomListItem {
  roomId: string;
  roomName: string;
  gameId: string;
  gameName: string;
  clients: number;
  maxClients: number;
  minPlayers: number;
  hasPassword: boolean;
}

export interface CreateRoomOptions {
  roomName: string;
  password?: string;
  gameId: string;
  gameConfig?: Record<string, unknown>;
}

export interface JoinRoomOptions {
  password?: string;
}

export interface GameRoomMetadata {
  roomName: string;
  gameId: string;
  gameName: string;
  hasPassword: boolean;
  minPlayers: number;
  maxPlayers: number;
  gameConfig?: GameConfigValues;
}

export interface GamesListPayload {
  games: GameDefinition[];
}

export interface RoomsListPayload {
  rooms: RoomListItem[];
}

export interface RoomCreatedPayload {
  roomId: string;
  roomName: string;
  gameId: string;
}

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

export interface RpsChoosePayload {
  choice?: string;
}

export type { GameConfigValues, GameDefinition };
