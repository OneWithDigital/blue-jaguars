/**
 * The team code from a join link (/join?code=...), held in the browser until
 * the family has signed in so the code box fills itself. Survives the Google
 * sign-in round trip. Every storage call is guarded: private windows and
 * blocked storage just fall back to typing the code.
 */
const KEY = "bj-join-code";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function cleanCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
}

export function rememberJoinCode(code: string): void {
  const clean = cleanCode(code);
  if (!clean) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() }));
  } catch {
    // storage unavailable
  }
}

export function readJoinCode(): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { code?: string; at?: number };
    if (!parsed.code || !parsed.at || Date.now() - parsed.at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return "";
    }
    return cleanCode(parsed.code);
  } catch {
    return "";
  }
}

export function forgetJoinCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable
  }
}
