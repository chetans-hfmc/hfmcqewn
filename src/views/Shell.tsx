import { useMemo, useState } from "react";
import type { AlertDef, Case, User, View } from "../types";
import { ROLE_LABEL, isOversight, teamOf, useMe, useNav, useStore } from "../store";
import { tatFor } from "../calc";
import { Avatar, Btn, DueChip, Ic, Pill, cx, daysUntil, fmtAED, fmtDate, todayISO } from "../ui";

/* ---------- shared alert derivation (what needs YOU today) ---------- */
export function deriveAlerts(state: ReturnType<typeof useStore>["state"], me: User): AlertDef[] {
  const out: AlertDef[] = [];
  const seesAll = isOversight(me.role);
  const team = me.role === "TL" ? teamOf(state, me) : new Set<string>([me.id]);
  const mine = (ownerId: string) => seesAll || team.has(ownerId);
  const today = todayISO();
  const personName = (id: string) => state.persons.find((p) => p.id === id)?.name ?? "";

  state.tasks.forEach((t) => {
    if (t.status !== "OPEN" || !t.due || !mine(t.ownerId)) return;
    const dd = daysUntil(t.due);
    const ref = state.cases.find((c) => c.id === t.caseId)?.ref ?? "";
    if (dd != null && dd < 0) out.push({ id: `task:${t.id}`, kind: "task", severity: 2, title: `Task overdue ${-dd}d — ${t.title}`, sub: ref, caseId: t.caseId });
    else if (dd === 0) out.push({ id: `task:${t.id}`, kind: "task", severity: 1, title: `Task due today — ${t.title}`, sub: ref, caseId: t.caseId });
  });
  state.cases.forEach((c) => {
    if (c.status !== "OPEN" || !mine(c.ownerId)) return;
    const t = tatFor(c, c.stage, state.stages, today);
    const stage = state.stages.find((s) => s.id === c.stage)?.name ?? c.stage;
    if (t.level === 3) out.push({ id: `esc3:${c.id}`, kind: "case", severity: 3, title: `L3 — ${c.ref} is ${t.daysOver}d over`, sub: `${stage} · ${personName(c.personId)}`, caseId: c.id });
    else if (t.level === 2) out.push({ id: `esc2:${c.id}`, kind: "case", severity: 2, title: `L2 — ${c.ref} is ${t.daysOver}d over`, sub: `${stage} · ${personName(c.personId)}`, caseId: c.id });
    if (!c.nextAction) out.push({ id: `na:${c.id}`, kind: "noaction", severity: 1, title: `No next action — ${c.ref}`, sub: stage, caseId: c.id });
  });
  state.queries.forEach((q) => {
    if (q.status !== "OPEN" || !q.due || !mine(q.ownerId)) return;
    if ((daysUntil(q.due) ?? 9) <= 1) {
      const ref = state.cases.find((c) => c.id === q.caseId)?.ref ?? "";
      out.push({ id: `q:${q.id}`, kind: "query", severity: 2, title: `Bank query due — ${q.ref}`, sub: `${ref} · ${q.requirement.slice(0, 50)}`, caseId: q.caseId });
    }
  });
  const dismissed = new Set(state.dismissedAlerts ?? []);
  return out.filter((a) => !dismissed.has(a.id)).sort((a, b) => b.severity - a.severity).slice(0, 40);
}

function Bell() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [open, setOpen] = useState(false);
  const alerts = deriveAlerts(state, me);
  const worst = alerts[0]?.severity ?? 0;
  const badge = worst === 3 ? "bg-ink text-paper" : worst === 2 ? "bg-rust-500 text-white" : "bg-amber-500 text-white";
  const goAlert = (a: AlertDef) => {
    if (a.caseId) nav.go("cases", { caseId: a.caseId });
    else if (a.kind === "query") nav.go("queries");
    setOpen(false);
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} title="What needs you today"
        className="focusable group relative p-2 rounded-md hover:bg-ink/6 text-ink-soft hover:text-ink transition-colors">
        <Ic n="bell" size={17} className="group-hover:-rotate-12 transition-transform duration-300" />
        {alerts.length > 0 && (
          <span className={cx("absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full num text-[9.5px] font-bold flex items-center justify-center", badge, worst >= 2 && "pulse-dot")}>
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>
      {open && (<>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[340px] bg-card border border-mist rounded-lg shadow-2xl overflow-hidden anim-pop origin-top-right">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-mist bg-paper/60">
            <p className="font-display font-bold text-[13px] tracking-tight">Needs you today <span className="num text-pine-700">{alerts.length}</span></p>
            {alerts.length > 0 && (
              <button onClick={() => dispatch({ t: "DISMISS_ALERTS", ids: alerts.map((a) => a.id) })}
                className="focusable text-[10.5px] font-display font-bold text-ink-soft hover:text-rust-600 transition-colors">Clear all</button>
            )}
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
                <button onClick={() => goAlert(a)} className="flex-1 min-w-0 text-left focusable rounded">
                  <div className="flex items-center gap-1.5">
                    <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", a.severity === 3 ? "bg-ink" : a.severity === 2 ? "bg-rust-500" : "bg-amber-500", a.severity >= 2 && "pulse-dot")} />
                    <p className="text-[12px] font-semibold leading-tight truncate">{a.title}</p>
                  </div>
                  <p className="text-[10.5px] text-ink-soft truncate mt-0.5 ml-3">{a.sub}</p>
                </button>
                <button onClick={() => dispatch({ t: "DISMISS_ALERTS", ids: [a.id] })} title="Dismiss"
                  className="focusable p-1 rounded text-ink-soft/50 hover:text-rust-600 hover:bg-rust-100 opacity-0 group-hover:opacity-100 transition-all mt-0.5">
                  <Ic n="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </>)}
    </div>
  );
}
export { Bell };

/* ---------- login ---------- */
export function Login() {
  const { state, dispatch } = useStore();
  const open = state.cases.filter((c) => c.status === "OPEN").length;
  const groups: { label: string; users: User[] }[] = [
    { label: "Admin", users: state.users.filter((u) => u.role === "ADMIN") },
    { label: "Management", users: state.users.filter((u) => ["HEAD", "TL", "PA"].includes(u.role)) },
    { label: "Ops Team (SPO)", users: state.users.filter((u) => u.role === "SPO") },
    { label: "Sales Team (VRM)", users: state.users.filter((u) => u.role === "VRM" || u.role === "TBD") },
  ];
  return (
    <div className="min-h-full ambient flex">
      {/* brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[380px] shrink-0 bg-pine-950 text-paper p-9 sidebar-texture relative overflow-hidden">
        <div className="anim-up">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-lg bg-pine-700 flex items-center justify-center"><Ic n="layers" size={20} /></span>
            <div>
              <p className="font-display font-bold text-[19px] tracking-tight leading-none">HFMC</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-pine-300 mt-1">Mortgage OS</p>
            </div>
          </div>
          <h1 className="font-display font-bold text-[30px] leading-[1.15] tracking-tight mt-10">
            One case,<br />one golden record,<br /><span className="text-pine-300">one source of truth.</span>
          </h1>
          <p className="text-[13px] text-paper/60 leading-relaxed mt-4 max-w-[280px]">
            CRM, case engine, decision engine and rule governance — built on the HFMC PRD Blueprint V1.0.
          </p>
        </div>
        <div className="anim-up space-y-3" style={{ animationDelay: "120ms" }}>
          {[
            { n: fmtN0(open), l: "open cases on the tower" },
            { n: String(state.productDefs.length), l: "bank products in the rule engine" },
            { n: String(state.users.filter((u) => u.active).length), l: "team members onboard" },
          ].map((s) => (
            <div key={s.l} className="flex items-baseline gap-3 border-t border-paper/10 pt-3">
              <span className="num font-bold text-[22px] text-pine-200">{s.n}</span>
              <span className="text-[11.5px] text-paper/50">{s.l}</span>
            </div>
          ))}
          <p className="text-[10px] text-paper/35 num">PRD V1.0 · V1 Foundation build · {fmtDate(todayISO())}</p>
        </div>
      </div>

      {/* identity picker */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-[560px] anim-up">
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.16em] text-pine-700">Sign in</p>
          <h2 className="font-display font-bold text-[26px] tracking-tight mt-1">Who's working today?</h2>
          <p className="text-[12.5px] text-ink-soft mt-1 mb-6">Pick an identity — each role gets its own focused dashboard and module access.</p>
          <div className="space-y-5">
            {groups.map((g, gi) => (
              <div key={g.label} className="anim-up" style={{ animationDelay: `${gi * 70}ms` }}>
                <p className="text-[10.5px] font-display font-bold uppercase tracking-[0.12em] text-ink-soft mb-2">{g.label}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {g.users.map((u) => (
                    <button key={u.id} disabled={!u.active} onClick={() => dispatch({ t: "LOGIN", userId: u.id })}
                      className={cx("focusable group flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-left transition-all duration-200",
                        u.active ? "border-mist hover:border-pine-600 hover:shadow-md hover:-translate-y-px" : "opacity-45 cursor-not-allowed border-mist")}>
                      <Avatar name={u.name} size={34} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-[13.5px] truncate group-hover:text-pine-800 transition-colors">{u.name}</span>
                        <span className="block text-[10.5px] text-ink-soft truncate">{ROLE_LABEL[u.role]}{u.note ? ` · ${u.note}` : ""}</span>
                      </span>
                      <Ic n="arrowR" size={14} className="text-ink-soft/40 group-hover:text-pine-700 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-ink-soft mt-6 num">Permission matrix TO VERIFY · Super Admin is management-assigned</p>
        </div>
      </div>
    </div>
  );
}
const fmtN0 = (n: number) => n.toLocaleString("en-US");

/* ---------- role-aware home ---------- */
function HomeTile({ to, icon, title, value, sub, tone = "text-ink", delay = 0 }: {
  to: View; icon: string; title: string; value: React.ReactNode; sub?: string; tone?: string; delay?: number;
}) {
  const nav = useNav();
  return (
    <button onClick={() => nav.go(to)}
      className="focusable anim-up group text-left bg-card border border-mist rounded-lg px-4 py-3.5 transition-all duration-200 hover:border-pine-600 hover:shadow-md hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-display font-bold uppercase tracking-[0.1em] text-ink-soft">{title}</span>
        <span className="w-7 h-7 rounded-md bg-mist/50 flex items-center justify-center text-ink-soft group-hover:bg-pine-100 group-hover:text-pine-700 transition-colors"><Ic n={icon} size={14} /></span>
      </div>
      <p className={cx("num font-bold text-[24px] mt-1.5 leading-none", tone)}>{value}</p>
      {sub && <p className="text-[10.5px] text-ink-soft mt-1 truncate">{sub}</p>}
    </button>
  );
}

function CaseRow({ c }: { c: Case }) {
  const { state } = useStore();
  const nav = useNav();
  const person = state.persons.find((p) => p.id === c.personId);
  const stage = state.stages.find((s) => s.id === c.stage);
  const t = tatFor(c, c.stage, state.stages, todayISO());
  const lv = [null, null, "amber", "rust"][t.level] as string | null;
  return (
    <button onClick={() => nav.go("cases", { caseId: c.id })}
      className="focusable w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-mist/60 last:border-0 hover:bg-pine-50/60 transition-colors text-left group">
      <span className="num text-[10.5px] font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5 shrink-0">{c.ref}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12.5px] font-semibold truncate group-hover:text-pine-800 transition-colors">{person?.name}{c.deal ? <span className="text-ink-soft font-normal"> · {c.deal}</span> : null}</span>
        <span className="block text-[10.5px] text-ink-soft truncate">{stage?.name} · {state.banks.find((b) => b.id === c.bankId)?.short}</span>
      </span>
      {t.level > 0 && lv && <Pill tone={lv}>{`L${t.level} · ${t.daysOver}d over`}</Pill>}
      <DueChip iso={c.nextActionDue} />
      <Ic n="chevR" size={13} className="text-ink-soft/40 group-hover:text-pine-700 transition-colors" />
    </button>
  );
}

export function Home() {
  const { state } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const today = todayISO();
  const seesAll = isOversight(me.role);
  const team = me.role === "TL" ? teamOf(state, me) : new Set<string>([me.id]);
  const inScope = (ownerId: string) => seesAll || team.has(ownerId);

  const open = useMemo(() => state.cases.filter((c) => c.status === "OPEN"), [state.cases]);
  const myCases = open.filter((c) => inScope(c.ownerId));
  const overdue = myCases.filter((c) => (daysUntil(c.nextActionDue) ?? 1) < 0);
  const readyToAdvance = myCases.filter((c) => c.docs.filter((d) => d.stageId === c.stage).every((d) => d.status === "VERIFIED" || d.status === "NA") && !state.tasks.some((t) => t.caseId === c.id && t.stageId === c.stage && t.status === "OPEN"));
  const waiting = myCases.filter((c) => c.waitingFor);
  const myTasks = state.tasks.filter((t) => t.status === "OPEN" && inScope(t.ownerId));
  const myLeads = state.leads.filter((l) => inScope(l.owner) && l.status !== "CONVERTED" && l.status !== "LOST");
  const pipeline = myCases.reduce((s, c) => s + c.loanAmount, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const alerts = deriveAlerts(state, me);

  const firstName = me.name.split(" ")[0];
  const isVRM = me.role === "VRM";
  const isSPO = me.role === "SPO";

  return (
    <div className="space-y-5">
      {/* greeting + headline */}
      <div className="anim-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.16em] text-pine-700">{greeting}, {firstName}</p>
          <h1 className="font-display font-bold text-[28px] tracking-tight leading-tight mt-1">
            {isVRM ? "Your desk — clients & leads" : isSPO ? "Your files — today's movements" : me.role === "TL" ? "Your team — flow & escalations" : "Control Tower"}
          </h1>
          <p className="text-[12.5px] text-ink-soft mt-1">
            {alerts.length
              ? <><span className="font-semibold text-rust-600">{alerts.length} item{alerts.length > 1 ? "s" : ""}</span> need{alerts.length === 1 ? "s" : ""} your attention · {fmtDate(today)}</>
              : <>All clear · {fmtDate(today)}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {isVRM && <Btn onClick={() => nav.go("leads", { params: { create: true } })}><Ic n="plus" size={14} /> New lead</Btn>}
          {isSPO && <Btn onClick={() => nav.go("cases")} variant="dark"><Ic n="briefcase" size={14} /> Open cases</Btn>}
          {!isVRM && !isSPO && <Btn onClick={() => nav.go("decision")}><Ic n="spark" size={14} /> Run Decision Engine</Btn>}
        </div>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(isVRM
          ? <>
            <HomeTile to="leads" icon="funnel" title="Active leads" value={myLeads.length} sub={`${myLeads.filter((l) => l.status === "NEW").length} new · ${myLeads.filter((l) => l.status === "QUALIFIED").length} qualified`} delay={0} />
            <HomeTile to="leads" icon="clock" title="Due today" value={myLeads.filter((l) => daysUntil(l.due) === 0).length + overdue.length} sub="follow-ups scheduled" tone="text-amber-700" delay={60} />
            <HomeTile to="cases" icon="briefcase" title="My cases" value={myCases.length} sub={`${fmtAED(pipeline)} in pipeline`} delay={120} />
            <HomeTile to="decision" icon="spark" title="Eligibility runs" value={state.calcs.filter((c) => c.by === me.id).length} sub="saved calculations" delay={180} />
          </>
          : <>
            <HomeTile to="cases" icon="briefcase" title="Open cases" value={myCases.length} sub={`${fmtAED(pipeline)} financed`} delay={0} />
            <HomeTile to="cases" icon="alert" title="Overdue" value={overdue.length} sub="next action past due" tone={overdue.length ? "text-rust-600" : "text-ink"} delay={60} />
            <HomeTile to="cases" icon="check" title="Ready to advance" value={readyToAdvance.length} sub="all stage gates green" tone="text-pine-700" delay={120} />
            <HomeTile to="tat" icon="timer" title="Escalated" value={alerts.filter((a) => a.severity >= 2).length} sub="L2 / L3 on the ladder" tone={alerts.some((a) => a.severity >= 2) ? "text-rust-600" : "text-ink"} delay={180} />
          </>)}
      </div>

      {/* work queues */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="anim-up bg-card border border-mist rounded-lg overflow-hidden" style={{ animationDelay: "150ms" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-mist bg-paper/50">
            <p className="font-display font-bold text-[13.5px] tracking-tight">{isVRM ? "Needs you today" : "Priority files"}</p>
            <button onClick={() => nav.go(isVRM ? "leads" : "cases")} className="focusable text-[11px] font-display font-bold text-pine-700 hover:underline">View all</button>
          </div>
          {(isVRM
            ? myLeads.slice(0, 6).map((l) => {
              const person = state.persons.find((p) => p.id === l.personId);
              return (
                <button key={l.id} onClick={() => nav.go("leads")} className="focusable w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-mist/60 last:border-0 hover:bg-pine-50/60 transition-colors text-left group">
                  <span className="num text-[10.5px] font-bold text-steel-700 bg-steel-100 rounded px-1.5 py-0.5 shrink-0">{l.ref}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold truncate group-hover:text-pine-800 transition-colors">{person?.name}</span>
                    <span className="block text-[10.5px] text-ink-soft truncate">{l.source} · {l.status.toLowerCase()}</span>
                  </span>
                  <Pill tone={l.status === "NEW" ? "steel" : l.status === "QUALIFIED" ? "pine" : "amber"}>{l.status}</Pill>
                  <DueChip iso={l.due} />
                </button>
              );
            })
            : [...myCases].sort((a, b) => (daysUntil(a.nextActionDue) ?? 99) - (daysUntil(b.nextActionDue) ?? 99)).slice(0, 6).map((c) => <CaseRow key={c.id} c={c} />)
          )}
          {myCases.length === 0 && myLeads.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-ink-soft">Nothing in your queue — enjoy it while it lasts.</p>}
        </div>

        <div className="anim-up bg-card border border-mist rounded-lg overflow-hidden" style={{ animationDelay: "220ms" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-mist bg-paper/50">
            <p className="font-display font-bold text-[13.5px] tracking-tight">Open tasks</p>
            <button onClick={() => nav.go("tasks")} className="focusable text-[11px] font-display font-bold text-pine-700 hover:underline">Task engine</button>
          </div>
          {myTasks.slice(0, 6).map((t) => {
            const ref = state.cases.find((c) => c.id === t.caseId)?.ref ?? "";
            return (
              <div key={t.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-mist/60 last:border-0">
                <span className={cx("w-2 h-2 rounded-full shrink-0", t.priority === "HIGH" ? "bg-rust-500" : t.priority === "MEDIUM" ? "bg-amber-500" : "bg-gr-300")} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-medium truncate">{t.title}</span>
                  <span className="block text-[10.5px] text-ink-soft num">{ref} · {t.priority.toLowerCase()}</span>
                </span>
                <DueChip iso={t.due} />
              </div>
            );
          })}
          {myTasks.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-ink-soft">No open tasks in your scope.</p>}
        </div>
      </div>

      {/* waiting strip */}
      {waiting.length > 0 && (
        <div className="anim-up bg-amber-100/40 border border-amber-500/30 rounded-lg px-4 py-3" style={{ animationDelay: "280ms" }}>
          <div className="flex items-center gap-2 mb-2">
            <Ic n="clock" size={14} className="text-amber-700" />
            <p className="font-display font-bold text-[12.5px] text-amber-700">Waiting on others ({waiting.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {waiting.slice(0, 8).map((c) => (
              <button key={c.id} onClick={() => nav.go("cases", { caseId: c.id })}
                className="focusable num text-[11px] font-semibold bg-card border border-amber-500/40 rounded-md px-2.5 py-1.5 hover:border-pine-600 hover:shadow-sm transition-all">
                {c.ref} <span className="text-ink-soft font-body font-normal">· {c.waitingFor}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
