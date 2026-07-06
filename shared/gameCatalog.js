export const GAME_CATALOG = [
    { id: "guess-number", name: "猜数字", minPlayers: 2, maxPlayers: 4 },
    { id: "quick-card", name: "快速卡牌", minPlayers: 2, maxPlayers: 6 },
    { id: "party-dice", name: "派对骰子", minPlayers: 2, maxPlayers: 8 },
    {
        id: "rock-paper-scissors",
        name: "锤子剪刀布",
        minPlayers: 2,
        maxPlayers: 2,
        configSchema: [
            {
                key: "choiceTimeSeconds",
                label: "选择时间(秒)",
                type: "number",
                min: 3,
                max: 60,
                default: 10,
            },
            {
                key: "winningScore",
                label: "获胜分数",
                type: "number",
                min: 1,
                max: 20,
                default: 3,
            },
        ],
    },
];
export function getGameById(gameId) {
    return GAME_CATALOG.find((g) => g.id === gameId);
}
export function isValidGameId(gameId) {
    return GAME_CATALOG.some((g) => g.id === gameId);
}
export function getDefaultGameConfig(gameId) {
    const game = getGameById(gameId);
    if (!game?.configSchema?.length) {
        return undefined;
    }
    const config = {};
    for (const field of game.configSchema) {
        config[field.key] = field.default;
    }
    return config;
}
export function validateGameConfig(gameId, raw) {
    const game = getGameById(gameId);
    if (!game?.configSchema?.length) {
        if (raw && Object.keys(raw).length > 0) {
            throw new Error("该游戏不支持房间配置");
        }
        return undefined;
    }
    const config = {};
    for (const field of game.configSchema) {
        const rawValue = raw?.[field.key];
        const num = typeof rawValue === "number"
            ? rawValue
            : typeof rawValue === "string"
                ? Number(rawValue)
                : NaN;
        if (!Number.isFinite(num) || num < field.min || num > field.max) {
            throw new Error(`${field.label}必须在 ${field.min}-${field.max} 之间`);
        }
        config[field.key] = Math.floor(num);
    }
    return config;
}
