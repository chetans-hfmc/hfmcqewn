import { useState } from "react";
import type { View } from "./types";
import { NavProvider, ROLE_LABEL, ROLE_MODULES, StoreProvider, useMe, useNav, useStore } from "./store";
import { Avatar, Btn, Ic, Pill, cx, fmtDate, todayISO } from "./ui";
import Dashboard from "./views/Dashboard";
import { LeadsView, PeopleView } from "./views/PeopleLeads";
import { Case360, CasesView } from "./views/Cases";
import { DocumentsView, QueriesView, TasksView } from "./views/Ops";
import CalculatorsView from "./views/Calculators";
import TrackerView from "./views/Tracker";
import TatView from "./views/Tat";
import GuideView from "./views/Guide";
import TemplatesView from "./views/Templates";
import { AuditView, RuleCentre, UsersView } from "./views/Admin";

const NAV: { g: string; items: { v: View; l: string; icon: string }[] }[] = [
  { g: "Operate", items: [
    { v: "dashboard", l: "Control Tower", icon: "grid" },
    { v: "people", l: "People", icon: "users" },
    { v: "leads", l: "Leads", icon: "funnel" },
    { v: "cases", l: "Cases", icon: "briefcase" },
    { v: "tracker", l: "Daily Tracker", icon: "calendar" },
    { v: "tat", l: "TAT & Escalation", icon: "timer" },
  ]},
  { g: "Execute", items: [
    { v: "tasks", l: "Tasks", icon: "clipboard" },
    { v: "documents", l: "Documents", icon: "file" },
    { v: "queries", l: "Bank Queries", icon: "help" },
  ]},
  { g: "Decide", items: [{ v: "calculators", l: "Calculator Centre", icon: "calc" }] },
  { g: "Govern", items: [
    { v: "rules", l: "Rule Centre", icon: "sliders" },
    { v: "users", l: "Users & Roles", icon: "shield" },
    { v: "templates", l: "Desk Tools", icon: "copy" },
    { v: "guide", l: "Ops Guide Book", icon: "book" },
    { v: "audit", l: "Audit Trail", icon: "clock" },
  ]},
];

function Login() {
  const { state, dispatch } = useStore();
  const open = state.cases.filter((c) => c.status === "OPEN").length;
  const groups: Record<string, typeof state.users> = {};
  state.users.filter((u) => u.active).forEach((u) => { (groups[u.role] ??= []).push(u); });
  return (
    <div className="min-h-screen grid lg:grid-cols-2 ambient">
      {/* brand panel */}
      <div className="sidebar-texture bg-pine-950 text-paper p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div>
          <div className="flex items-center gap-3 anim-up">
            <span className="w-11 h-11 rounded-md bg-pine-600 flex items-center justify-center font-display font-bold text-lg tracking-tight shadow-lg shadow-pine-900/50">HF</span>
            <div>
              <p className="font-display font-bold text-[17px] tracking-tight leading-none">HFMC</p>
              <p className="text-[10.5px] text-pine-300 tracking-[0.18em] uppercase mt-1">Mortgage Operating System</p>
            </div>
          </div>
          <h1 className="font-display font-bold text-[34px] lg:text-[44px] leading-[1.05] tracking-tight mt-10 anim-up" style={{ animationDelay: "80ms" }}>
            One golden record<br />from <span className="text-pine-300">lead</span> to<br /><span className="text-pine-300">title deed</span>.
          </h1>
          <p className="text-pine-200/80 text-[13.5px] mt-5 max-w-md anim-up" style={{ animationDelay: "140ms" }}>
            CRM, case engine, calculators and admin rules in one platform. At every stage the system answers:
            what is pending, why, who owns it, and can the case move.
          </p>
        </div>
        <div className="anim-up" style={{ animationDelay: "220ms" }}>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            {[
              { l: "CRM", d: "Lead · Person" }, { l: "OPERATIONS", d: "Case · Task" }, { l: "CALCULATORS", d: "Eligibility" },
            ].map((e) => (
              <div key={e.l} className="border border-pine-700/70 rounded-md px-3 py-2.5 bg-pine-900/40">
                <p className="font-display font-bold text-[11px] tracking-wide">{e.l}</p>
                <p className="text-[10px] text-pine-300 num mt-0.5">{e.d}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center my-1.5 text-pine-500"><Ic n="chevD" size={16} /></div>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <div className="border border-pine-700/70 rounded-md px-3 py-2.5 bg-pine-900/40 text-center"><p className="font-display font-bold text-[11px]">RULE ENGINE</p></div>
            <div className="border border-pine-700/70 rounded-md px-3 py-2.5 bg-pine-900/40 text-center"><p className="font-display font-bold text-[11px]">ADMIN CONTROL</p></div>
          </div>
          <div className="flex gap-5 mt-8 num text-[11.5px] text-pine-300">
            <span><span className="text-paper font-semibold text-[15px]">{open}</span> open cases</span>
            <span><span className="text-paper font-semibold text-[15px]">{state.rules.filter((r) => r.active).length}</span> live rules</span>
            <span><span className="text-paper font-semibold text-[15px]">{state.stages.length}</span> stages</span>
            <span><span className="text-paper font-semibold text-[15px]">{state.eibor.length}</span> EIBOR rows</span>
          </div>
        </div>
      </div>
      {/* identity picker */}
      <div className="p-8 lg:p-12 flex flex-col justify-center max-h-screen overflow-y-auto">
        <p className="text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-pine-700 anim-up">PRD V1.0 · demo environment</p>
        <h2 className="font-display font-bold text-[26px] tracking-tight mt-2 anim-up" style={{ animationDelay: "60ms" }}>Select your identity</h2>
        <p className="text-[13px] text-ink-soft mt-1 mb-6 anim-up" style={{ animationDelay: "100ms" }}>Navigation and permissions follow the role — User → Role → Permission.</p>
        <div className="space-y-5 max-w-lg">
          {/* pinned Super Admin identity */}
          {groups["ADMIN"]?.map((u) => (
            <button key={u.id} onClick={() => dispatch({ t: "LOGIN", userId: u.id })}
              className="anim-up w-full flex items-center gap-3.5 bg-ink text-paper border border-ink rounded-lg px-4 py-3.5 text-left hover:bg-pine-950 hover:shadow-lg hover:-translate-y-px transition-all duration-150 focusable group">
              <span className="w-10 h-10 rounded-md bg-pine-600 flex items-center justify-center shrink-0 group-hover:bg-pine-500 transition-colors"><Ic n="shield" size={19} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block font-display font-bold text-[14.5px] tracking-tight">{u.name}</span>
                  <span className="text-[8.5px] font-display font-bold uppercase tracking-[0.12em] bg-pine-600 text-paper rounded px-1.5 py-[2px]">Admin</span>
                </span>
                <span className="block text-[11px] text-paper/60 truncate">Full platform control · {u.empId} · assigned by management</span>
              </span>
              <Ic n="arrowR" size={16} className="text-pine-400 shrink-0" />
            </button>
          ))}
          {Object.entries(groups).filter(([role]) => role !== "ADMIN").map(([role, users], gi) => (
            <div key={role} className="anim-up" style={{ animationDelay: `${140 + gi * 60}ms` }}>
              <p className="text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-ink-soft mb-2">{ROLE_LABEL[role]}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {users.map((u) => (
                  <button key={u.id} onClick={() => dispatch({ t: "LOGIN", userId: u.id })}
                    className="flex items-center gap-3 bg-card border border-mist rounded-lg px-3.5 py-3 text-left hover:border-pine-500 hover:shadow-md hover:-translate-y-px transition-all duration-150 focusable group">
                    <Avatar name={u.name} size={36} />
                    <span className="min-w-0">
                      <span className="block font-display font-semibold text-[13.5px] tracking-tight group-hover:text-pine-700">{u.name}</span>
                      <span className="block text-[11px] text-ink-soft truncate">{u.team} · {u.empId}</span>
                    </span>
                    <Ic n="arrowR" size={15} className="ml-auto text-ink-soft/40 group-hover:text-pine-600 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [resetArm, setResetArm] = useState(false);
  const allowed = ROLE_MODULES[me.role] ?? ["dashboard"];
  const view: View = allowed.includes(nav.view) ? nav.view : "dashboard";
  const openTasks = state.tasks.filter((t) => t.status === "OPEN").length;
  const openQueries = state.queries.filter((q) => q.status === "OPEN").length;

  const titles: Record<View, string> = {
    dashboard: "Control Tower", tracker: "Daily Tracker", tat: "TAT & Escalation", people: "People", leads: "Leads", cases: nav.caseId ? "Case 360" : "Cases",
    tasks: "Task Engine", documents: "Documents & QC", queries: "Bank Queries", calculators: "Calculator Centre",
    templates: "Desk Tools", rules: "Rule Centre", users: "Users & Roles", guide: "Operations Guide Book", audit: "Audit Trail",
  };

  return (
    <div className="min-h-screen ambient">
      {/* sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[218px] flex-col bg-pine-950 sidebar-texture text-paper z-30">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="w-9 h-9 rounded-md bg-pine-600 flex items-center justify-center font-display font-bold text-sm shadow-md">HF</span>
          <div>
            <p className="font-display font-bold text-[14px] tracking-tight leading-none">HFMC</p>
            <p className="text-[8.5px] text-pine-300 tracking-[0.16em] uppercase mt-0.5">Mortgage OS</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
          {NAV.map((g) => {
            const items = g.items.filter((i) => allowed.includes(i.v));
            if (!items.length) return null;
            return (
              <div key={g.g} className="mt-3.5">
                <p className="px-2.5 text-[9.5px] font-display font-semibold uppercase tracking-[0.16em] text-pine-400/80 mb-1">{g.g}</p>
                {items.map((i) => {
                  const active = view === i.v;
                  const badge = i.v === "tasks" ? openTasks : i.v === "queries" ? openQueries : 0;
                  return (
                    <button key={i.v} onClick={() => nav.go(i.v)}
                      className={cx("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150 mb-0.5 focusable relative",
                        active ? "bg-paper/12 text-paper" : "text-pine-200/75 hover:text-paper hover:bg-paper/6")}>
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-pine-400" />}
                      <Ic n={i.icon} size={16} className={active ? "text-pine-300" : ""} />
                      {i.l}
                      {badge > 0 && <span className="ml-auto num text-[10px] bg-pine-700 text-pine-100 rounded-full px-1.5 py-0.5">{badge}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-paper/10">
          <div className="flex items-center gap-2 text-[10px] text-pine-300/80">
            <Ic n="lock" size={11} /> <span>Permission matrix TO VERIFY</span>
          </div>
          <button onClick={() => { if (resetArm) { dispatch({ t: "RESET" }); setResetArm(false); } else { setResetArm(true); setTimeout(() => setResetArm(false), 2500); } }}
            className={cx("mt-2 w-full flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-display font-semibold transition-all focusable",
              resetArm ? "border-rust-500 bg-rust-500 text-white" : "border-paper/15 text-pine-200 hover:bg-paper/6")}>
            <Ic n="refresh" size={12} /> {resetArm ? "Confirm reset?" : "Reset demo data"}
          </button>
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
              <Pill tone="pine" className="hidden md:inline-flex"><Ic n="pulse" size={11} /> EIBOR 3M {state.eibor[state.eibor.length - 1]?.m3.toFixed(2) ?? "—"}%</Pill>
              <div className="flex items-center gap-2 bg-card border border-mist rounded-full pl-1 pr-3 py-1">
                <Avatar name={me.name} size={26} />
                <div className="leading-tight hidden sm:block">
                  <p className="text-[11.5px] font-semibold">{me.name}</p>
                  <p className="text-[9.5px] text-ink-soft">{ROLE_LABEL[me.role]}</p>
                </div>
              </div>
              <button onClick={() => dispatch({ t: "LOGOUT" })} title="Sign out" className="p-2 rounded-md hover:bg-ink/6 text-ink-soft hover:text-ink transition-colors focusable"><Ic n="logout" size={16} /></button>
            </div>
          </div>
          {/* mobile nav */}
          <div className="lg:hidden flex gap-1 px-3 pb-2 overflow-x-auto">
            {NAV.flatMap((g) => g.items).filter((i) => allowed.includes(i.v)).map((i) => (
              <button key={i.v} onClick={() => nav.go(i.v)}
                className={cx("flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px] font-display font-semibold whitespace-nowrap border transition-all",
                  view === i.v ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft")}>
                <Ic n={i.icon} size={13} />{i.l}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-6 py-5 max-w-[1500px] w-full mx-auto">
          <div key={view + (nav.caseId ?? "")}>
            {view === "dashboard" && <Dashboard />}
            {view === "people" && <PeopleView />}
            {view === "leads" && <LeadsView />}
            {view === "cases" && (nav.caseId ? <Case360 id={nav.caseId} /> : <CasesView />)}
            {view === "tracker" && <TrackerView />}
            {view === "tat" && <TatView />}
            {view === "tasks" && <TasksView />}
            {view === "documents" && <DocumentsView />}
            {view === "queries" && <QueriesView />}
            {view === "calculators" && <CalculatorsView />}
            {view === "rules" && <RuleCentre />}
            {view === "users" && <UsersView />}
            {view === "guide" && <GuideView />}
            {view === "audit" && <AuditView />}
          </div>
        </main>

        <footer className="px-4 lg:px-6 py-3 border-t border-mist text-[10.5px] text-ink-soft flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span className="num">HFMC Mortgage Operating System · PRD Blueprint V1.0 · V1 Foundation build</span>
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
