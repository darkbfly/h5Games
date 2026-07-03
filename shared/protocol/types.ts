import type { GameConfigValues, GameDefinition } from "../gameCatalog.js";

export interface UserProfile {
  id: string;
  username: string;
}

export interface AuthResponsePayload {
  token: string;
  user: UserProfile;
}

export interface AuthRequestPayload {
  username: string;
  password: string;
}

export interface RoomListItem {
  roomId: string;
  roomName: string;
  gameId: string;
  gameName: string;
  clients: number;
  maxClients: number;
  minPlayers: number;
  hasPassword: boolean;
  ownerUsername?: string;
}

export interface CreateRoomOptions {
  roomName: string;
  password?: string;
  gameId: string;
  gameConfig?: Record<string, unknown>;
}

export interface JoinRoomOptions {
  password?: string;
  token?: string;
}

export interface LobbyJoinOptions {
  token?: string;
}

export interface GameRoomMetadata {
  roomName: string;
  gameId: string;
  gameName: string;
  hasPassword: boolean;
  minPlayers: number;
  maxPlayers: number;
  ownerUsername?: string;
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
  username: string;
  score: number;
  hasChosen: boolean;
  isReady: boolean;
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
  ownerSessionId: string | null;
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

export interface KickPlayerPayload {
  sessionId: string;
}

export interface KickedPayload {
  message: string;
}

export type { GameConfigValues, GameDefinition };
