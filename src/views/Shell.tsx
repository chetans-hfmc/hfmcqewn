import { useMemo, useState } from "react";
import type { View, User, AlertDef } from "../types";
import { NavProvider, ROLE_LABEL, ROLE_MODULES, StoreProvider, useMe, useNav, useStore } from "../store";
import { tatFor, ESC_LEVELS } from "../calc";
import { Avatar, Btn, Ic, Pill, cx, daysUntil, fmtDate, todayISO } from "../ui";

/* ---------- alerts (derived "what needs you today") ---------- */
function deriveAlerts(state: ReturnType<typeof useStore>["state"], me: User): AlertDef[] {
  const out: AlertDef[] = [];
  const role = me.role;
  const seesAll = role === "ADMIN" || role === "HEAD";
  const team = role === "TL" ? new Set(state.users.filter((u) => u.leaderId === me.id || u.team === me.team || u.id === me.id).map((u) => u.id)) : new Set([me.id]);
  const mine = (id: string) => seesAll || team.has(id);
  const today = todayISO();
  const personName = (id: string) => state.persons.find((p) => p.id === id)?.name ?? "";

  state.tasks.forEach((t) => {
    if (t.status !== "OPEN" || !t.due || !mine(t.ownerId)) return;
    const dd = daysUntil(t.due) ?? 99;
    const ref = state.cases.find((c) => c.id === t.caseId)?.ref ?? "";
    if (dd < 0) out.push({ id: `task:${t.id}`, kind: "task", severity: 2, title: `Task overdue ${-dd}d — ${t.title}`, sub: ref, caseId: t.caseId });
    else if (dd === 0) out.push({ id: `task:${t.id}`, kind: "task", severity: 1, title: `Task due today — ${t.title}`, sub: ref, caseId: t.caseId });
  });
  state.cases.forEach((c) => {
    if (c.status !== "OPEN" || !mine(c.ownerId)) return;
    const t = tatFor(c, c.stage, state.stages, today);
    const stage = state.stages.find((s) => s.id === c.stage)?.name ?? c.stage;
    if (t.level === 3) out.push({ id: `esc3:${c.id}`, kind: "case", severity: 3, title: `L3 — ${c.ref} ${t.daysOver}d over`, sub: `${stage} · ${personName(c.personId)}`, caseId: c.id });
    else if (t.level === 2) out.push({ id: `esc2:${c.id}`, kind: "case", severity: 2, title: `L2 — ${c.ref} ${t.daysOver}d over`, sub: `${stage} · ${personName(c.personId)}`, caseId: c.id });
    if (!c.nextAction) out.push({ id: `na:${c.id}`, kind: "noaction", severity: 1, title: `No next action — ${c.ref}`, sub: stage, caseId: c.id });
  });
  const dismissed = new Set(state.dismissedAlerts ?? []);
  return out.filter((x) => !dismissed.has(x.id)).sort((a, b) => b.severity - a.severity).slice(0, 40);
}

function Bell() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [open, setOpen] = useState(false);
  const alerts = deriveAlerts(state, me);
  const worst = alerts[0]?.severity ?? 0;
  const badge = worst === 3 ? "bg-ink text-paper" : worst === 2 ? "bg-rust-500 text-white" : "bg-amber-500 text-white";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} title="What needs you today"
        className="group relative p-2 rounded-md hover:bg-ink/6 text-ink-soft hover:text-ink transition-colors">
        <Ic n="bell" size={17} className="group-hover:-rotate-12 transition-transform duration-300" />
        {alerts.length > 0 && <span className={cx("absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full num text-[9.5px] font-bold flex items-center justify-center", badge, worst >= 2 && "pulse-dot")}>{alerts.length > 9 ? "9+" : alerts.length}</span>}
      </button>
      {open && (<>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[340px] bg-card border border-mist rounded-lg shadow-2xl overflow-hidden anim-pop origin-top-right">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-mist bg-paper/60">
            <p className="font-display font-bold text-[13px] tracking-tight">Needs you today <span className="num text-pine-700">{alerts.length}</span></p>
            {alerts.length > 0 && <button onClick={() => dispatch({ t: "DISMISS_ALERTS", ids: alerts.map((a) => a.id) })} className="text-[10.5px] font-display font-bold text-ink-soft hover:text-rust-600">Clear all</button>}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {alerts.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Ic n="check" size={22} className="mx-auto text-pine-600" />
                <p className="text-[12.5px] font-semibold mt-2">All clear</p>
                <p className="text-[11px] text-ink-soft mt-0.5">Nothing overdue, due, or escalated for you.</p>
              </div>
            )}
            {alerts.map((a, i) => (
              <div key={a.id} className="group flex items-start gap-2.5 px-4 py-2.5 border-b border-mist/60 last:border-0 hover:bg-pine-50/50 transition-colors anim-tick" style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}>
                <button onClick={() => { if (a.caseId) nav.go("cases", { caseId: a.caseId }); setOpen(false); }} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", a.severity === 3 ? "bg-ink" : a.severity === 2 ? "bg-rust-500" : "bg-amber-500", a.severity >= 2 && "pulse-dot")} />
                    <p className="text-[12px] font-semibold leading-tight truncate">{a.title}</p>
                  </div>
                  <p className="text-[10.5px] text-ink-soft truncate mt-0.5 ml-3">{a.sub}</p>
                </button>
                <button onClick={() => dispatch({ t: "DISMISS_ALERTS", ids: [a.id] })} className="p-1 rounded text-ink-soft/50 hover:text-rust-600 opacity-0 group-hover:opacity-100 transition-all"><Ic n="x" size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </>)}
    </div>
  );
}

/* ---------- Home: role-aware "my day" ---------- */
export function Home() {
  const { state } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const role = me.role;
  const today = todayISO();
  const isMgr = role === "ADMIN" || role === "HEAD" || role === "TL";

  const myCases = state.cases.filter((c) => c.status === "OPEN" && (isMgr || c.ownerId === me.id));
  const bucket = (c: (typeof myCases)[number]) => {
    const t = tatFor(c, c.stage, state.stages, today);
    if (t.level >= 2) return "esc";
    if (c.waitingFor) return "wait";
    if (!c.nextAction) return "noact";
    return "on";
  };
  const counts = useMemo(() => ({
    esc: myCases.filter((c) => bucket(c) === "esc").length,
    wait: myCases.filter((c) => bucket(c) === "wait").length,
    noact: myCases.filter((c) => bucket(c) === "noact").length,
    on: myCases.filter((c) => bucket(c) === "on").length,
  }), [myCases]);

  const myTasks = state.tasks.filter((t) => t.status === "OPEN" && (isMgr || t.ownerId === me.id));
  const dueTasks = myTasks.filter((t) => (daysUntil(t.due) ?? 99) <= 0);
  const myLeads = state.leads.filter((l) => (isMgr || l.owner === me.id) && l.status !== "CONVERTED" && l.status !== "LOST");

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const roleFocus: Record<string, { title: string; sub: string }> = {
    VRM: { title: "Clients & Leads", sub: "Bring clients in, qualify fast, hand off clean files." },
    SPO: { title: "My Files", sub: "Push files through stages — unblock, advance, hand over." },
    TL: { title: "My Team", sub: "Unblock the team, reassign load, catch escalations early." },
    HEAD: { title: "Control Tower", sub: "Decisions, holds, and the health of the whole book." },
    ADMIN: { title: "Control Tower", sub: "Full visibility across every team and module." },
    PA: { title: "Coordination Desk", sub: "Valuations on the clock and coordination that keeps files moving." },
    TBD: { title: "Welcome", sub: "Your role is being configured — ask your Team Leader for access." },
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* greeting */}
      <div className="anim-up">
        <p className="text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-pine-700">{fmtDate(today)} · {ROLE_LABEL[role]}</p>
        <h1 className="font-display font-bold text-[28px] tracking-tight mt-1">{greet}, {me.name.split(" ")[0]}</h1>
        <p className="text-[13px] text-ink-soft mt-0.5">{roleFocus[role]?.title} — {roleFocus[role]?.sub}</p>
      </div>

      {/* stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        {[
          { l: "Open files", v: myCases.length, icon: "briefcase", tone: "text-pine-700" },
          { l: "Escalated (L2/L3)", v: counts.esc, icon: "alert", tone: counts.esc ? "text-rust-600" : "text-ink-soft" },
          { l: "Tasks due / overdue", v: dueTasks.length, icon: "timer", tone: dueTasks.length ? "text-amber-700" : "text-ink-soft" },
          { l: role === "VRM" ? "Active leads" : "No next action", v: role === "VRM" ? myLeads.length : counts.noact, icon: role === "VRM" ? "funnel" : "help", tone: "text-steel-600" },
        ].map((s, i) => (
          <div key={s.l} className="anim-up bg-card border border-mist rounded-lg px-4 py-3.5 hover:shadow-sm hover:-translate-y-px transition-all" style={{ animationDelay: `${i * 55}ms` }}>
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-display font-bold uppercase tracking-[0.08em] text-ink-soft">{s.l}</p>
              <Ic n={s.icon} size={15} className="text-ink-soft/50" />
            </div>
            <p className={cx("num text-[26px] font-semibold leading-tight mt-1", s.tone)}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mt-4">
        {/* today's worklist */}
        <div className="lg:col-span-3 anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-bold text-[14px] tracking-tight">Today's worklist</p>
            <button onClick={() => nav.go("tasks")} className="text-[11.5px] font-display font-bold text-pine-700 hover:underline">All tasks →</button>
          </div>
          <div className="space-y-2">
            {dueTasks.slice(0, 6).map((t) => {
              const ref = state.cases.find((c) => c.id === t.caseId)?.ref ?? "";
              const dd = daysUntil(t.due) ?? 0;
              return (
                <button key={t.id} onClick={() => nav.go("cases", { caseId: t.caseId })}
                  className="w-full flex items-center gap-3 border border-mist rounded-md px-3 py-2.5 hover:border-pine-500 hover:shadow-sm transition-all text-left">
                  <Pill tone={dd < 0 ? "rust" : "amber"}>{dd < 0 ? `${-dd}d over` : "today"}</Pill>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold truncate">{t.title}</span>
                    <span className="block num text-[10.5px] text-ink-soft">{ref} · {state.stages.find((s) => s.id === t.stageId)?.name}</span>
                  </span>
                  <Ic n="chevR" size={14} className="text-ink-soft/40" />
                </button>
              );
            })}
            {dueTasks.length === 0 && <p className="text-[12px] text-ink-soft italic py-3">Nothing due today — a clear desk.</p>}
          </div>
        </div>

        {/* quick status */}
        <div className="lg:col-span-2 anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "160ms" }}>
          <p className="font-display font-bold text-[14px] tracking-tight mb-3">{role === "VRM" ? "My leads" : "File status"}</p>
          {role === "VRM" ? (
            <div className="space-y-1.5">
              {myLeads.slice(0, 5).map((l) => (
                <button key={l.id} onClick={() => nav.go("leads")} className="w-full flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-paper/70 transition-colors text-left">
                  <Avatar name={state.persons.find((p) => p.id === l.personId)?.name ?? "?"} size={24} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-semibold truncate">{state.persons.find((p) => p.id === l.personId)?.name}</span>
                    <span className="block text-[10.5px] text-ink-soft">{l.status} · {l.nextAction ?? "—"}</span>
                  </span>
                  <Pill tone="steel">{l.ref}</Pill>
                </button>
              ))}
              <button onClick={() => nav.go("leads", { params: { create: true } })}
                className="w-full mt-2 flex items-center justify-center gap-1.5 border border-dashed border-pine-400 text-pine-700 rounded-md py-2 text-[12px] font-display font-bold hover:bg-pine-50 transition-all">
                <Ic n="plus" size={13} /> New lead
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {([
                { l: "On track", v: counts.on, dot: "bg-pine-500", view: "cases" as View },
                { l: "Waiting on someone", v: counts.wait, dot: "bg-amber-500", view: "cases" as View },
                { l: "Escalated", v: counts.esc, dot: "bg-rust-500", view: "tat" as View },
                { l: "Stalled — no next action", v: counts.noact, dot: "bg-ink", view: "cases" as View },
              ]).map((r) => (
                <button key={r.l} onClick={() => nav.go(r.view)} className="w-full flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-paper/70 transition-colors">
                  <span className={cx("w-2.5 h-2.5 rounded-full", r.dot)} />
                  <span className="flex-1 text-left text-[12.5px] font-medium">{r.l}</span>
                  <span className="num text-[15px] font-semibold">{r.v}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Login ---------- */
export function Login() {
  const { state, dispatch } = useStore();
  const groups: Record<string, User[]> = {};
  state.users.filter((u) => u.active).forEach((u) => { (groups[u.role] = groups[u.role] ?? []).push(u); });
  return (
    <div className="min-h-screen ambient flex">
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-pine-950 text-paper p-10 sidebar-texture">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-lg bg-pine-600 flex items-center justify-center font-display font-bold text-lg">HF</span>
            <div>
              <p className="font-display font-bold text-[17px] tracking-tight leading-none">HFMC</p>
              <p className="text-[10.5px] text-pine-300 mt-1 tracking-[0.08em] uppercase">Mortgage Operating System</p>
            </div>
          </div>
          <p className="mt-10 font-display font-bold text-[26px] leading-snug tracking-tight">One golden record.<br />Every stage, one owner.</p>
          <p className="mt-3 text-[13px] text-pine-200/80 leading-relaxed">CRM, case engine, calculators and the bank rule engine — connected, so every file answers: what's pending, why, and who owns it next.</p>
        </div>
        <p className="num text-[10.5px] text-pine-300/60">PRD Blueprint V1.0 · {state.cases.filter((c) => c.status === "OPEN").length} open files · {state.persons.length} clients</p>
      </div>
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 max-h-screen overflow-y-auto py-10">
        <p className="text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-pine-700 anim-up">Demo environment · select your identity</p>
        <h2 className="font-display font-bold text-[26px] tracking-tight mt-2 anim-up" style={{ animationDelay: "50ms" }}>Who's signing in?</h2>
        <p className="text-[13px] text-ink-soft mt-1 mb-6 anim-up" style={{ animationDelay: "90ms" }}>Navigation and data follow your role — User → Role → Permission.</p>
        <div className="space-y-5 max-w-xl">
          {groups["ADMIN"]?.map((u) => (
            <button key={u.id} onClick={() => dispatch({ t: "LOGIN", userId: u.id })}
              className="anim-up w-full flex items-center gap-3.5 bg-ink text-paper rounded-lg px-4 py-3.5 text-left hover:bg-pine-950 hover:shadow-lg transition-all group">
              <Avatar name={u.name} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block font-display font-bold text-[14.5px] tracking-tight">{u.name}</span>
                <span className="block text-[11px] text-paper/60">{ROLE_LABEL[u.role]} · management-assigned seat</span>
              </span>
              <Ic n="arrowR" size={16} className="text-paper/40 group-hover:text-pine-400 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
          {(["HEAD", "TL", "SPO", "VRM", "PA"] as const).map((r) => groups[r] && (
            <div key={r} className="anim-up">
              <p className="text-[10.5px] font-display font-bold uppercase tracking-[0.1em] text-ink-soft mb-2">{ROLE_LABEL[r]} · {groups[r].length}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {groups[r].map((u) => (
                  <button key={u.id} onClick={() => dispatch({ t: "LOGIN", userId: u.id })}
                    className="flex items-center gap-3 bg-card border border-mist rounded-lg px-3.5 py-3 text-left hover:border-pine-500 hover:shadow-md hover:-translate-y-px transition-all group">
                    <Avatar name={u.name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-semibold text-[13.5px] tracking-tight group-hover:text-pine-700 truncate">{u.name}</span>
                      <span className="block text-[10.5px] text-ink-soft truncate">{u.team} · {u.empId}</span>
                    </span>
                    <Ic n="arrowR" size={14} className="text-ink-soft/40 group-hover:text-pine-600 transition-colors" />
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

export { ROLE_MODULES };
