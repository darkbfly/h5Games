export interface ConfigFieldSchema {
  key: string;
  label: string;
  type: "number";
  min: number;
  max: number;
  default: number;
}

export interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  configSchema?: ConfigFieldSchema[];
}

export const GAME_CATALOG: GameDefinition[] = [
  { id: "guess-number", name: "猜数字", minPlayers: 2, maxPlayers: 4 },
  { id: "quick-card", name: "快速卡牌", minPlayers: 2, maxPlayers: 6 },
  { id: "party-dice", name: "派对骰子", minPlayers: 2, maxPlayers: 8 },
  {
    id: "rock-paper-scissors",
    name: "锤子剪刀布",
    minPlayers: 2,
    maxPlayers: 2,
    configSchema: [
      { key: "choiceTimeSeconds", label: "选择时间(秒)", type: "number", min: 3, max: 60, default: 10 },
      { key: "winningScore", label: "获胜分数", type: "number", min: 1, max: 20, default: 3 },
    ],
  },
];
