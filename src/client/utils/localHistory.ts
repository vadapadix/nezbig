const LEGACY_KEY = "nezbig_local_history";
export const GUEST_HISTORY_KEY = "nezbig_history:guest";

export function localHistoryKey(): string {
  let userId: string | undefined;
  try { userId = JSON.parse(localStorage.getItem("nezbig_auth_user") || "null")?.id; } catch { /* guest */ }
  const key = userId ? `nezbig_history:user:${userId}` : GUEST_HISTORY_KEY;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy !== null) {
    // Move existing browser history once; do not expose an account's cache after logout.
    if (localStorage.getItem(key) === null) localStorage.setItem(key, legacy);
    localStorage.removeItem(LEGACY_KEY);
  }
  return key;
}
