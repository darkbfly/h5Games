/** 平台统一错误码 */
export const PlatformErrorCode = {
  ROOM_NAME_EMPTY: "ROOM_NAME_EMPTY",
  INVALID_GAME: "INVALID_GAME",
  INVALID_CONFIG: "INVALID_CONFIG",
  WRONG_PASSWORD: "WRONG_PASSWORD",
  ROOM_FULL: "ROOM_FULL",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_IN_GAME: "NOT_IN_GAME",
  INVALID_CHOICE: "INVALID_CHOICE",
  ALREADY_CHOSEN: "ALREADY_CHOSEN",
  CANNOT_CHOOSE_NOW: "CANNOT_CHOOSE_NOW",
  CANNOT_READY_NOW: "CANNOT_READY_NOW",
  ALREADY_READY: "ALREADY_READY",
  NOT_OWNER: "NOT_OWNER",
  CANNOT_KICK_SELF: "CANNOT_KICK_SELF",
  CANNOT_KICK_NOW: "CANNOT_KICK_NOW",
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  USERNAME_TAKEN: "USERNAME_TAKEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  UNKNOWN: "UNKNOWN",
} as const;

export type PlatformErrorCodeType = (typeof PlatformErrorCode)[keyof typeof PlatformErrorCode];

export interface PlatformErrorPayload {
  code: PlatformErrorCodeType;
  message: string;
}

export function platformError(
  code: PlatformErrorCodeType,
  message: string
): PlatformErrorPayload {
  return { code, message };
}
