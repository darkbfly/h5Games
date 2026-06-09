export interface ServerMetrics {
  uptimeSeconds: number;
  lobbyClients: number;
  gameRooms: number;
  gameClients: number;
  messagesTotal: number;
  errorsTotal: number;
  avgRttMs: number;
}

const startedAt = Date.now();
let messagesTotal = 0;
let errorsTotal = 0;
const rttSamples: number[] = [];
const MAX_RTT_SAMPLES = 100;

export function recordMessage(): void {
  messagesTotal += 1;
}

export function recordError(): void {
  errorsTotal += 1;
}

export function recordRtt(ms: number): void {
  rttSamples.push(ms);
  if (rttSamples.length > MAX_RTT_SAMPLES) {
    rttSamples.shift();
  }
}

export function buildMetrics(
  lobbyClients: number,
  gameRooms: number,
  gameClients: number
): ServerMetrics {
  const avgRttMs =
    rttSamples.length > 0
      ? Math.round(rttSamples.reduce((a, b) => a + b, 0) / rttSamples.length)
      : 0;

  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    lobbyClients,
    gameRooms,
    gameClients,
    messagesTotal,
    errorsTotal,
    avgRttMs,
  };
}
