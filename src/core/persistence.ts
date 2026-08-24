import type { AppState } from "../types";
import { buildSeed, SEED_VERSION, SUPER_ADMIN } from "../seed";

export const STORAGE_KEY = "hfmc-mos-state";

/**
 * Load the initial state. Saved data is only trusted when the seed version
 * matches AND the payload fingerprints as the current dataset — this guards
 * against stale caches written under a colliding version number.
 */
export function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      const fresh =
        parsed.version === SEED_VERSION &&
        Array.isArray(parsed.trackerDates) &&
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.cases) &&
        Array.isArray(parsed.leads) &&
        Array.isArray(parsed.stages) &&
        Array.isArray(parsed.rules) &&
        Array.isArray(parsed.templates) &&
        parsed.users.some((u) => u.empId === "hfmm-15");
      if (fresh) {
        // Self-heal: the management-assigned Super Admin slot must always exist.
        if (!parsed.users.some((u) => u.empId === "hfmm-00" || u.id === "hfmm-00")) {
          parsed.users = [{ ...SUPER_ADMIN }, ...parsed.users];
        }
        return parsed;
      }
    }
  } catch { /* corrupted or unavailable storage — fall through to seed */ }
  return buildSeed();
}

/** Persist the whole state. Failures (quota, privacy mode) are non-fatal. */
export function persist(state: AppState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
