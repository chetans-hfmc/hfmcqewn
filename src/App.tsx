import { useState } from "react";
import type { View } from "./types";
import { NavProvider, ROLE_LABEL, ROLE_MODULES, StoreProvider, useMe, useNav, useStore } from "./store";
import { Avatar, Ic, cx, fmtDate, todayISO } from "./ui";
import { Home, Login } from "./views/Shell";
import { CasesView, Case360 } from "./views/Cases";
import { PeopleView, LeadsView } from "./views/Crm";
import { TasksView, DocumentsView, QueriesView, TrackerView, TatView } from "./views/Boards";
import CalculatorsView from "./views/Calc";
import { RuleCentre, UsersView, AuditView } from "./views/Govern";
import BankRulesView from "./views/BankRules";

const NAV: { g: string; items: { v: View; l: string; icon: string }[] }[] = [
  { g: "Operate", items: [
    { v: "dashboard", l: "Home", icon: "home" },
    { v: "tracker", l: "Morning Board", icon: "calendar" },
    { v: "tat", l: "TAT & Escalation", icon: "timer" },
  ]},
  { g: "Pipeline", items: [
    { v: "people", l: "People", icon: "users" },
    { v: "leads", l: "Leads", icon: "funnel" },
    { v: "cases", l: "Cases", icon: "briefcase" },
  ]},
  { g: "Execute", items: [
    { v: "tasks", l: "Tasks", icon: "check" },
    { v: "documents", l: "Documents & QC", icon: "file" },
    { v: "queries", l: "Bank Queries", icon: "help" },
  ]},
  { g: "Decide", items: [
    { v: "calculators", l: "Calculators", icon: "calc" },
  ]},
  { g: "Govern", items: [
    { v: "rules", l: "Rule Centre", icon: "sliders" },
    { v: "bankrules", l: "Bank Rule Engine", icon: "layers" },
    { v: "users", l: "Users & Roles", icon: "shield" },
    { v: "audit", l: "Audit Trail", icon: "clock" },
  ]},
];

function Shell() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const allowed = ROLE_MODULES[me.role] ?? ["dashboard"];
  const view = allowed.includes(nav.view) ? nav.view : "dashboard";

  const titles: Record<View, string> = {
    dashboard: "Home", tracker: "Morning Board", tat: "TAT & Escalation", people: "People", leads: "Leads",
    cases: nav.caseId ? "Case 360" : "Cases", tasks: "Task Engine", documents: "Documents & QC", queries: "Bank Queries",
    calculators: "Calculator Centre", templates: "Desk Tools", rules: "Rule Centre", bankrules: "Bank Rule Engine",
    users: "Users & Roles", audit: "Audit Trail", guide: "Guide Book",
  };

  return (
    <div className="min-h-screen ambient">
      {/* sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[218px] bg-pine-950 text-paper sidebar-texture z-30">
        <div className="flex items-center gap-2.5 px-5 h-[58px] border-b border-paper/10 shrink-0">
          <span className="w-9 h-9 rounded-lg bg-pine-600 flex items-center justify-center font-display font-bold">HF</span>
          <div>
            <p className="font-display font-bold text-[14px] tracking-tight leading-none">HFMC</p>
            <p className="text-[9px] text-pine-300 mt-0.5 tracking-[0.1em] uppercase">Mortgage OS</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {NAV.map((grp) => {
            const items = grp.items.filter((i) => allowed.includes(i.v));
            if (!items.length) return null;
            return (
              <div key={grp.g}>
                <p className="text-[9.5px] font-display font-bold uppercase tracking-[0.14em] text-pine-300/60 px-2 mb-1.5">{grp.g}</p>
                {items.map((i) => (
                  <button key={i.v} onClick={() => nav.go(i.v)}
                    className={cx("w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium transition-all mb-0.5",
                      view === i.v ? "bg-pine-700 text-paper shadow-sm" : "text-pine-200/80 hover:bg-paper/6 hover:text-paper")}>
                    <Ic n={i.icon} size={15} className={view === i.v ? "text-pine-300" : "text-pine-300/60"} />
                    <span className="font-display font-semibold tracking-tight">{i.l}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-paper/10 shrink-0">
          <p className="text-[9.5px] text-pine-300/50 flex items-center gap-1.5"><Ic n="lock" size={10} /> Permission matrix TO VERIFY</p>
        </div>
      </aside>

      {/* main */}
      <div className="lg:pl-[218px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-paper/85 backdrop-blur border-b border-mist">
          <div className="flex items-center gap-3 px-4 lg:px-6 py-2.5">
            <span className="lg:hidden w-8 h-8 rounded-md bg-pine-700 text-paper flex items-center justify-center font-display font-bold text-xs">HF</span>
            <div className="min-w-0">
              <p className="font-display font-bold text-[15px] tracking-tight leading-none">{titles[view]}</p>
              <p className="text-[10px] text-ink-soft num mt-0.5 hidden sm:block">{fmtDate(todayISO())} · {ROLE_LABEL[me.role]} · PRD V1.0</p>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <div className="flex items-center gap-2 bg-card border border-mist rounded-full pl-1 pr-3 py-1">
                <Avatar name={me.name} size={26} />
                <span className="hidden md:block">
                  <span className="block text-[11.5px] font-semibold leading-none">{me.name}</span>
                  <span className="block text-[9.5px] text-ink-soft mt-0.5">{ROLE_LABEL[me.role]}</span>
                </span>
              </div>
              <button onClick={() => dispatch({ t: "LOGOUT" })} title="Sign out" className="p-2 rounded-md hover:bg-ink/6 text-ink-soft hover:text-ink transition-colors"><Ic n="logout" size={16} /></button>
            </div>
          </div>
          {/* context bar (back + breadcrumbs) */}
          {nav.crumbs.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 px-6 pb-2">
              <button onClick={nav.back} title="Back one layer (Alt+←)"
                className="flex items-center gap-1 text-[10.5px] font-display font-bold text-ink-soft border border-mist bg-card rounded-md px-2 py-[5px] hover:border-pine-600 hover:text-pine-700 transition-all">
                <Ic n="chevL" size={11} /> Back
              </button>
              {nav.crumbs.map((cr, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <Ic n="chevR" size={9} className="text-ink-soft/40" />
                  <button onClick={() => nav.go(cr.view, { caseId: cr.caseId, params: cr.params })} className="text-[11px] font-medium text-ink-soft hover:text-pine-700">{cr.label}</button>
                </span>
              ))}
              <Ic n="chevR" size={9} className="text-ink-soft/40" />
              <span className="text-[11px] font-display font-bold text-ink">{titles[view]}</span>
            </div>
          )}
          {/* mobile nav */}
          <div className="lg:hidden flex gap-1 px-4 pb-2 overflow-x-auto">
            {NAV.flatMap((g) => g.items).filter((i) => allowed.includes(i.v)).map((i) => (
              <button key={i.v} onClick={() => nav.go(i.v)}
                className={cx("shrink-0 px-3 py-1.5 rounded-full border text-[11px] font-display font-bold transition-all", view === i.v ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft")}>{i.l}</button>
            ))}
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-6 py-5">
          {view === "dashboard" && <Home />}
          {view === "tracker" && <TrackerView />}
          {view === "tat" && <TatView />}
          {view === "people" && <PeopleView />}
          {view === "leads" && <LeadsView />}
          {view === "cases" && (nav.caseId ? <Case360 id={nav.caseId} /> : <CasesView />)}
          {view === "tasks" && <TasksView />}
          {view === "documents" && <DocumentsView />}
          {view === "queries" && <QueriesView />}
          {view === "calculators" && <CalculatorsView />}
          {view === "rules" && <RuleCentre />}
          {view === "bankrules" && <BankRulesView />}
          {view === "users" && <UsersView />}
          {view === "audit" && <AuditView />}
        </main>

        <footer className="px-4 lg:px-6 py-3 border-t border-mist text-[10.5px] text-ink-soft flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span className="num">HFMC Mortgage Operating System · PRD Blueprint V1.0</span>
          <span>EMI · DBR · LTV · Age rules are demo values — verify before production</span>
        </footer>
      </div>
    </div>
  );
}

function Gate() {
  const { state } = useStore();
  return state.session ? <Shell /> : <Login />;
}

export default function App() {
  return (
    <StoreProvider>
      <NavProvider>
        <Gate />
      </NavProvider>
    </StoreProvider>
  );
}
