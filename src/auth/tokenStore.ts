import type { ApiError } from "../api/errors";
const STORAGE_KEY = "astra.access-session.v1";

type ClearReason = string | { type: "account_inactive"; error: ApiError };
type SessionListener = (reason: ClearReason) => void;

export function createTokenStore(storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let version = 0;
  const listeners = new Set<SessionListener>();
  try {
    storage?.removeItem("astra.mock.access-session.v1");
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    if (typeof saved?.accessToken === "string" && saved.accessToken)
      accessToken = saved.accessToken;
    if (typeof saved?.refreshToken === "string")
      refreshToken = saved.refreshToken;
  } catch {
    /* Storage is optional; never substitute a role or authenticated user. */
  }

  function save(token: string, refresh: string | null) {
    accessToken = token;
    refreshToken = refresh;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify({ accessToken, refreshToken }));
    } catch {
      /* Memory-only session until reload. */
    }
  }

  return {
    getToken: () => accessToken,
    getRefreshToken: () => refreshToken,
    getVersion: () => version,
    set(token: string, refresh: string | null = null) {
      version += 1;
      save(token, refresh);
    },
    rotate(token: string, refresh: string, sessionVersion: number) {
      if (version === sessionVersion) save(token, refresh);
    },
    clear(reason: ClearReason = "logout") {
      accessToken = null;
      refreshToken = null;
      version += 1;
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        /* Already cleared in memory. */
      }
      listeners.forEach((fn) => fn(reason));
    },
    subscribe(fn: SessionListener) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}

let storage: Storage | undefined;
try {
  if (typeof window !== "undefined") storage = window.sessionStorage;
} catch {
  /* Restricted browser storage. */
}
export const tokenStore = createTokenStore(storage);
