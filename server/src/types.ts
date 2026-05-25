import type { GameDefinition } from "./gameCatalog.js";

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
}

export type { GameDefinition };
