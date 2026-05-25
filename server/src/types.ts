import type { GameConfigValues, GameDefinition } from "./gameCatalog.js";

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

export type { GameConfigValues, GameDefinition };
