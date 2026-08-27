import { useEffect } from "react";
import type { View } from "./types";
import { NavProvider, ROLE_LABEL, ROLE_MODULES, StoreProvider, useMe, useNav, useStore } from "./store";
import { Avatar, Ic, cx, fmtDate, todayISO } from "./ui";
import { Bell, Home, Login } from "./views/Shell";
import { CasesView, Case360 } from "./views/Cases";
import { PeopleView, LeadsView } from "./views/Crm";
import { TasksView, DocumentsView, QueriesView, TrackerView, TatView } from "./views/Boards";
import CalculatorsView from "./views/Calc";
import { RuleCentre, UsersView, AuditView, GuideView } from "./views/Govern";
import BankRulesView from "./views/BankRules";
import DecisionView from "./views/Decision";
import ProposalsView from "./views/Proposals";

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
    { v: "decision", l: "Decision Engine", icon: "spark" },
    { v: "proposals", l: "Proposal Desk", icon: "file" },
    { v: "calculators", l: "Calculators", icon: "calc" },
  ]},
  { g: "Govern", items: [
    { v: "rules", l: "Rule Centre", icon: "sliders" },
    { v: "bankrules", l: "Bank Rule Engine", icon: "layers" },
    { v: "users", l: "Users & Roles", icon: "shield" },
    { v: "guide", l: "Guide Book", icon: "book" },
    { v: "audit", l: "Audit Trail", icon: "clock" },
  ]},
];

function Shell() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const allowed = ROLE_MODULES[me.role] ?? ["dashboard"];
  const view = allowed.includes(nav.view) ? nav.view : "dashboard";

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); nav.back(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titles: Record<View, string> = {
    dashboard: "Home", tracker: "Morning Board", tat: "TAT & Escalation", people: "People", leads: "Leads",
    cases: nav.caseId ? "Case 360" : "Cases", tasks: "Task Engine", documents: "Documents & QC", queries: "Bank Queries",
    decision: "Decision Engine", proposals: "Proposal Desk", calculators: "Calculator Centre", templates: "Desk Tools", rules: "Rule Centre",
    bankrules: "Bank Rule Engine", users: "Users & Roles", guide: "Guide Book", audit: "Audit Trail",
  };

  return (
    <div className="min-h-full ambient flex">
      {/* sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 bg-pine-950 text-paper sidebar-texture sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-paper/10">
          <span className="w-9 h-9 rounded-lg bg-pine-700 flex items-center justify-center"><Ic n="layers" size={18} /></span>
          <div>
            <p className="font-display font-bold text-[16px] leading-none tracking-tight">HFMC</p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-pine-300 mt-1">Mortgage OS</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => {
            const items = group.items.filter((i) => allowed.includes(i.v));
            if (!items.length) return null;
            return (
              <div key={group.g} className="mb-4">
                <p className="px-2.5 text-[9.5px] font-display font-bold uppercase tracking-[0.16em] text-pine-400/70 mb-1.5">{group.g}</p>
                {items.map((i) => (
                  <button key={i.v} onClick={() => nav.go(i.v)}
                    className={cx("focusable w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12.5px] font-medium transition-all duration-150 mb-0.5",
                      view === i.v ? "bg-pine-700 text-paper shadow-sm" : "text-pine-200/80 hover:bg-paper/8 hover:text-paper")}>
                    <Ic n={i.icon} size={15} /> {i.l}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-paper/10">
          <div className="flex items-center gap-2.5">
            <Avatar name={me.name} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold truncate">{me.name}</p>
              <p className="text-[10px] text-pine-300 truncate">{ROLE_LABEL[me.role]}</p>
            </div>
            <button onClick={() => dispatch({ t: "LOGOUT" })} title="Sign out" className="focusable p-1.5 rounded-md text-pine-300 hover:text-paper hover:bg-paper/10 transition-colors"><Ic n="logout" size={15} /></button>
          </div>
          <button onClick={() => { if (window.confirm("Reset all demo data to the seed?")) dispatch({ t: "RESET" }); }}
            className="focusable mt-3 w-full flex items-center justify-center gap-1.5 rounded-md border border-paper/15 px-2 py-1.5 text-[10.5px] font-display font-semibold text-pine-200 hover:bg-paper/6 transition-colors">
            <Ic n="refresh" size={11} /> Reset demo data
          </button>
        </div>
      </aside>

      {/* main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur-sm border-b border-mist">
          <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display font-bold text-[17px] tracking-tight truncate">{titles[view]}</h2>
              <p className="text-[10.5px] text-ink-soft num">{fmtDate(todayISO())} · {state.cases.filter((c) => c.status === "OPEN").length} open cases</p>
            </div>
            <div className="flex items-center gap-2">
              {/* breadcrumb + back */}
              {nav.crumbs.length > 0 && (
                <div className="hidden md:flex items-center gap-1.5 mr-1">
                  <button onClick={nav.back} title="Back (Alt+←)" className="focusable flex items-center gap-1 rounded-md border border-mist bg-card px-2 py-1 text-[11px] font-display font-bold text-ink-soft hover:border-pine-600 hover:text-pine-700 transition-colors">
                    <Ic n="chevL" size={12} /> Back
                  </button>
                  {nav.crumbs.map((c, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                      <Ic n="chevR" size={10} className="text-ink-soft/40" />
                      <button onClick={() => nav.go(c.view, { caseId: c.caseId, params: c.params })} className="focusable hover:text-pine-700 transition-colors">{c.label}</button>
                    </span>
                  ))}
                </div>
              )}
              <Bell />
              <span className="lg:hidden"><Avatar name={me.name} size={30} /></span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-6 py-5 max-w-[1400px] w-full mx-auto">
          {view === "dashboard" && <Home />}
          {view === "tracker" && <TrackerView />}
          {view === "tat" && <TatView />}
          {view === "people" && <PeopleView />}
          {view === "leads" && <LeadsView />}
          {view === "cases" && (nav.caseId ? <Case360 id={nav.caseId} /> : <CasesView />)}
          {view === "tasks" && <TasksView />}
          {view === "documents" && <DocumentsView />}
          {view === "queries" && <QueriesView />}
          {view === "decision" && <DecisionView />}
          {view === "proposals" && <ProposalsView />}
          {view === "calculators" && <CalculatorsView />}
          {view === "rules" && <RuleCentre />}
          {view === "bankrules" && <BankRulesView />}
          {view === "users" && <UsersView />}
          {view === "guide" && <GuideView />}
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
