/** Google OAuth access tokens typically last 3600s; refresh early to avoid 401 races. */
const DEFAULT_TTL_MS = 50 * 60 * 1000;

type CachedToken = {
  token: string;
  expiresAt: number;
};

let cached: CachedToken | null = null;

export function rememberAccessToken(token: string, ttlMs: number = DEFAULT_TTL_MS): void {
  cached = {
    token,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  };
}

/** Returns a still-valid Calendar access token, or null if missing/expired. */
export function getUsableAccessToken(): string | null {
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    cached = null;
    return null;
  }
  return cached.token;
}

export function clearAccessToken(): void {
  cached = null;
}
