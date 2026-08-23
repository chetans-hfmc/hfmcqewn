import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { AppState } from "./types";
import type { Action, Handler } from "./core/types";
import { loadInitial, persist } from "./core/persistence";

/* Re-export the public surface so every existing `import ... from "../store"` keeps working. */
export { ROLE_MODULES, ROLE_LABEL, OVERSIGHT, isOversight, teamOf } from "./core/permissions";
export { NavProvider, useNav } from "./core/navigation";
export type { Action } from "./core/types";

/* Domain services — each claims a disjoint slice of the command surface. */
import { handle as authSvc } from "./services/auth.service";
import { handle as adminSvc } from "./services/admin.service";
import { handle as crmSvc } from "./services/crm.service";
import { handle as caseSvc } from "./services/case.service";
import { handle as taskSvc } from "./services/task.service";
import { handle as docSvc } from "./services/document.service";
import { handle as querySvc } from "./services/query.service";
import { handle as calcSvc } from "./services/calc.service";
import { handle as trackerSvc } from "./services/tracker.service";
import { handle as templateSvc } from "./services/template.service";
import { handle as ruleSvc } from "./services/rule.service";

const SERVICES: Handler[] = [
  authSvc, adminSvc, crmSvc, caseSvc, taskSvc,
  docSvc, querySvc, calcSvc, trackerSvc, templateSvc, ruleSvc,
];

/**
 * Composed reducer: route the action to the single service that owns it.
 * One source of truth (the whole AppState) — only the handlers are split,
 * so cross-entity mutations stay atomic.
 */
function reducer(state: AppState, action: Action): AppState {
  for (const service of SERVICES) {
    const next = service(state, action);
    if (next !== null) return next;
  }
  return state;
}

const StoreCtx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);
  useEffect(() => { persist(state); }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}

export function useMe() {
  const { state } = useStore();
  return state.users.find((u) => u.id === state.session) ?? null;
}
