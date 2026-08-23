import type { AppState, User, View } from "../types";

/* ---------- role → module access (TO VERIFY with compliance) ---------- */
export const ROLE_MODULES: Record<string, View[]> = {
  ADMIN: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "rules", "users", "guide", "audit"],
  HEAD: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "rules", "users", "guide", "audit"],
  TL: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "guide", "audit"],
  SPO: ["dashboard", "tracker", "tat", "cases", "tasks", "documents", "queries", "calculators", "templates", "guide"],
  VRM: ["dashboard", "tracker", "tat", "people", "leads", "cases", "calculators", "templates", "guide"],
  PA: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "templates", "guide"],
  TBD: ["dashboard"],
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Super Admin", HEAD: "Head of Mortgage", TL: "Team Leader", SPO: "Sales Process Owner", VRM: "Virtual Relationship Mgr", PA: "Personal Assistant", TBD: "Role TBD",
};

/* Single-active-owner scoping: oversight roles see across; members see their own. */
export const OVERSIGHT: string[] = ["ADMIN", "HEAD"];

export function isOversight(role: string): boolean {
  return OVERSIGHT.includes(role);
}

export function teamOf(state: AppState, me: User): Set<string> {
  const ids = new Set<string>([me.id]);
  state.users.forEach((u) => { if (u.leaderId === me.id || u.team === me.team) ids.add(u.id); });
  return ids;
}
