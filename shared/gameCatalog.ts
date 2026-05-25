export interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

export const GAME_CATALOG: GameDefinition[] = [
  { id: "guess-number", name: "猜数字", minPlayers: 2, maxPlayers: 4 },
  { id: "quick-card", name: "快速卡牌", minPlayers: 2, maxPlayers: 6 },
  { id: "party-dice", name: "派对骰子", minPlayers: 2, maxPlayers: 8 },
];

export function getGameById(gameId: string): GameDefinition | undefined {
  return GAME_CATALOG.find((g) => g.id === gameId);
}

export function isValidGameId(gameId: string): boolean {
  return GAME_CATALOG.some((g) => g.id === gameId);
}
