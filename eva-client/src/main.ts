import { App } from "./app/App.js";

const AUTH_KEY = "h5games_auth";

function readStoredAuth(): { token: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; user?: { id?: string; username?: string } };
    if (!parsed.token || !parsed.user?.id || !parsed.user?.username) return null;
    return { token: parsed.token };
  } catch {
    return null;
  }
}

async function purgeStaleAuth(): Promise<void> {
  const stored = readStoredAuth();
  if (!stored) return;
  try {
    const res = await fetch(`${window.location.origin}/auth/verify`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    });
    if (!res.ok) localStorage.removeItem(AUTH_KEY);
  } catch {
    localStorage.removeItem(AUTH_KEY);
  }
}

async function boot(): Promise<void> {
  await purgeStaleAuth();
  const app = new App();
  await app.start();
}

void boot();
