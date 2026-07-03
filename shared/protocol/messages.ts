/** 大厅房间消息 */
export const LobbyMessages = {
  GET_GAMES: "get_games",
  LIST_ROOMS: "list_rooms",
  SEARCH_ROOMS: "search_rooms",
  CREATE_ROOM: "create_room",
  GAMES_LIST: "games_list",
  ROOMS_LIST: "rooms_list",
  ROOM_CREATED: "room_created",
  ROOM_LIST_CHANGED: "room_list_changed",
  ERROR: "error",
} as const;

/** 通用错误消息 */
export const CommonMessages = {
  ERROR: "error",
  KICK_PLAYER: "kick_player",
  KICKED: "kicked",
} as const;

/** 锤子剪刀布消息 */
export const RpsMessages = {
  CHOOSE: "rps_choose",
  READY: "rps_ready",
  STATE: "rps_state",
  ROUND_RESULT: "rps_round_result",
} as const;

export type LobbyMessage = (typeof LobbyMessages)[keyof typeof LobbyMessages];
export type RpsMessage = (typeof RpsMessages)[keyof typeof RpsMessages];
