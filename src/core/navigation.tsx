import React, { createContext, useContext, useMemo, useState } from "react";
import type { Case, View } from "../types";
import { useStore } from "../store";

/* ---------- navigation with a back stack (one layer up, always) ---------- */
const NAV_LABELS: Record<string, string> = {
  dashboard: "Home", tracker: "Daily Tracker", tat: "TAT Monitor", people: "People", leads: "Leads",
  cases: "Cases", tasks: "Tasks", documents: "Documents", queries: "Queries", calculators: "Calculators",
  templates: "Desk Tools", rules: "Rule Centre", users: "Users & Roles", guide: "Guide Book", audit: "Audit Trail",
};

export interface Loc { view: View; caseId: string | null; params: Record<string, unknown>; label: string }

export interface NavValue {
  view: View;
  caseId: string | null;
  params: Record<string, unknown>;
  crumbs: Loc[];
  go: (v: View, o?: { caseId?: string | null; params?: Record<string, unknown> }) => void;
  back: () => void;
}

const NavCtx = createContext<NavValue | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const [view, setView] = useState<View>("dashboard");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [stack, setStack] = useState<Loc[]>([]);

  const labelFor = (v: View, cid: string | null) => {
    if (v === "cases" && cid) return state.cases.find((x: Case) => x.id === cid)?.ref ?? "Case";
    return NAV_LABELS[v] ?? v;
  };

  const go = (v: View, o?: { caseId?: string | null; params?: Record<string, unknown> }) => {
    setStack((s) => [...s.slice(-19), { view, caseId, params, label: labelFor(view, caseId) }]);
    setView(v); setCaseId(o?.caseId ?? null); setParams(o?.params ?? {});
    window.scrollTo({ top: 0 });
  };

  const back = () => {
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    setStack(stack.slice(0, -1));
    setView(prev.view); setCaseId(prev.caseId); setParams(prev.params);
    window.scrollTo({ top: 0 });
  };

  const crumbs = stack.slice(-2);
  const value = useMemo(() => ({ view, caseId, params, crumbs, go, back }), [view, caseId, params, stack]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}

export function useNav(): NavValue {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error("useNav outside provider");
  return ctx;
}
