import type { AppState, AuditEntry } from "../types";
import { nowISO, uid } from "../ui";

/**
 * The single WHO / WHAT / WHEN writer.
 * Every service routes its audit entries through here so the trail
 * stays ordered and uniformly attributed to the active session.
 */
export function auditLog(state: AppState, entry: Omit<AuditEntry, "id" | "at" | "by">): AppState {
  return {
    ...state,
    audit: [{ id: "a" + uid(), at: nowISO(), by: state.session ?? "system", ...entry }, ...state.audit],
  };
}
