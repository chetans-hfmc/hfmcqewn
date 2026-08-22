import { useMemo, useState } from "react";
import type { Case, Lead, User } from "../types";
import { ROLE_LABEL, isOversight, teamOf, useMe, useNav, useStore } from "../store";
import { caseBucket, stageGates, tatFor, ESC_LEVELS } from "../calc";
import { Avatar, Btn, DueChip, Ic, Pill, cx, daysUntil, fmtAED, fmtDate, fmtN, todayISO, useCountUp } from "../ui";
import Dashboard from "./Dashboard";
import HandoffModal from "./Handoff";

/* ---------------- shared bits ---------------- */
function HStat({ label, value, format, sub, tone, delay }: { label: string; value: number; format: (n: number) => string; sub?: string; tone?: string; delay: number }) {
  const v = useCountUp(value);
  return (
    <div className="anim-up bg-card border border-mist rounded-lg p-4 hover:shadow-md hover:-translate-y-px transition-all duration-200" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[11px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft">{label}</p>
      <p className={cx("num text-[26px] font-semibold leading-tight mt-1", tone ?? "text-ink")}>{format(v)}</p>
      {sub && <p className="text-[11px] text-ink-soft mt-1">{sub}</p>}
    </div>
  );
}

function RoleHeader({ me, job, accent }: { me: User; job: string; accent: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div className="anim-up flex flex-wrap items-end justify-between gap-4 mb-5">
      <div>
        <div className="flex items-center gap-2.5">
          <Avatar name={me.name} size={34} />
          <div>
            <h1 className="font-display font-bold text-[24px] tracking-tight text-ink leading-tight">{greeting}, {me.name.split(" ")[0]}</h1>
            <p className="text-[12.5px] text-ink-soft">{job}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Pill tone="pine"><Ic n="shield" size={12} /> {ROLE_LABEL[me.role]}</Pill>
        <span className={cx("text-[10px] font-display font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full", accent)}>{me.team}</span>
      </div>
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-2.5">
      <h2 className="font-display font-bold text-[15px] tracking-tight text-ink">{children}</h2>
      {right}
    </div>
  );
}

function CaseRow({ c, onHandoff, showHandoff }: { c: Case; onHandoff: (c: Case) => void; showHandoff?: boolean }) {
  const { state } = useStore();
  const nav = useNav();
  const person = state.persons.find((p) => p.id === c.personId);
  const bank = state.banks.find((b) => b.id === c.bankId);
  const st = state.stages.find((s) => s.id === c.stage);
  const last = (c.handoffs ?? [])[c.handoffs!.length - 1];
  const fromName = last ? state.users.find((u) => u.id === last.fromId)?.name : null;
  return (
    <div className="group flex items-center gap-3 bg-card border border-mist rounded-md px-3 py-2.5 hover:border-pine-500 hover:shadow-sm hover:-translate-y-px transition-all duration-150">
      <button onClick={() => nav.go("cases", { caseId: c.id })} className="flex-1 min-w-0 text-left focusable rounded">
        <div className="flex items-center gap-2">
          <span className="num text-[11px] font-bold text-pine-700 shrink-0">{c.ref}</span>
          <span className="text-[12.5px] font-semibold truncate">{person?.name}</span>
          <span className="text-[10px] font-display font-bold uppercase tracking-wide bg-pine-100 text-pine-800 rounded px-1.5 py-[1px] shrink-0">{st?.short}</span>
          <span className="text-[10.5px] text-ink-soft shrink-0">{bank?.short}</span>
        </div>
        <p className="text-[11px] text-ink-soft truncate mt-0.5">
          {c.nextAction ?? "No next action"}{c.waitingFor ? ` · waiting: ${c.waitingFor}` : ""}
          {fromName ? ` · ← ${fromName}` : ""}
        </p>
      </button>
      <DueChip iso={c.nextActionDue} />
      {showHandoff && (
        <button onClick={() => onHandoff(c)} title="Hand off this file"
          className="focusable shrink-0 w-7 h-7 rounded-md border border-mist flex items-center justify-center text-ink-soft hover:border-pine-600 hover:text-pine-700 hover:bg-pine-50 transition-all opacity-0 group-hover:opacity-100">
          <Ic n="arrowR" size={14} />
        </button>
      )}
    </div>
  );
}

/* ---------------- VRM ---------------- */
const FUNNEL = [
  { s: "NEW", c: "bg-steel-500", t: "text-steel-700" },
  { s: "CONTACTED", c: "bg-[#5b8bb0]", t: "text-steel-700" },
  { s: "APPOINTMENT", c: "bg-amber-500", t: "text-amber-700" },
  { s: "QUALIFIED", c: "bg-[#c07d12]", t: "text-amber-700" },
  { s: "PROPOSAL", c: "bg-pine-500", t: "text-pine-700" },
] as const;

function VrmHome({ me }: { me: User }) {
  const { state } = useStore();
  const nav = useNav();
  const [handoff, setHandoff] = useState<Case | null>(null);
  const [leadH, setLeadH] = useState<Lead | null>(null);

  const myLeads = state.leads.filter((l) => l.owner === me.id);
  const active = myLeads.filter((l) => l.status !== "CONVERTED" && l.status !== "LOST");
  const converted = myLeads.filter((l) => l.status === "CONVERTED").length;
  const myCases = state.cases.filter((c) => c.status === "OPEN" && c.ownerId === me.id);
  const handedOff = state.cases.filter((c) => c.status === "OPEN" && c.ownerId !== me.id && (c.handoffs ?? []).some((h) => h.fromId === me.id));
  const convRate = myLeads.length ? Math.round((converted / myLeads.length) * 100) : 0;
  const month = todayISO().slice(0, 7);
  const newThisMonth = myLeads.filter((l) => l.createdAt.slice(0, 7) === month).length;
  const total = Math.max(1, active.reduce((s) => s + 1, 0) + converted);

  return (
    <div>
      <RoleHeader me={me} job="Bring clients in, qualify fast, and hand off submission-ready files." accent="bg-amber-100 text-amber-700" />

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* New Lead — the VRM's signature action */}
        <button onClick={() => nav.go("leads")}
          className="anim-up group relative overflow-hidden rounded-lg bg-pine-700 text-paper text-left p-5 flex flex-col justify-between hover:bg-pine-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focusable sidebar-texture min-h-[180px]">
          <div className="flex items-start justify-between">
            <span className="w-11 h-11 rounded-md bg-paper/15 flex items-center justify-center group-hover:bg-paper/25 transition-colors"><Ic n="plus" size={22} /></span>
            <Ic n="arrowR" size={18} className="text-pine-300 group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <p className="font-display font-bold text-[20px] tracking-tight leading-tight">Create a<br />new lead</p>
            <p className="text-[11.5px] text-pine-200 mt-1.5">Capture name + mobile in seconds. Enrich later.</p>
          </div>
        </button>

        {/* funnel + stats */}
        <div className="space-y-4">
          <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "60ms" }}>
            <SectionTitle right={<button onClick={() => nav.go("leads")} className="focusable text-[11.5px] font-display font-bold text-pine-700 hover:underline flex items-center gap-1">All leads <Ic n="chevR" size={12} /></button>}>
              My lead funnel <span className="num text-pine-700">{active.length}</span> active
            </SectionTitle>
            <div className="flex h-3 rounded-full overflow-hidden bg-mist/50 mb-3">
              {FUNNEL.map((f) => {
                const n = active.filter((l) => l.status === f.s).length;
                return n > 0 ? <div key={f.s} className={cx("bar-grow", f.c)} style={{ width: `${(n / Math.max(1, active.length)) * 100}%` }} title={`${f.s}: ${n}`} /> : null;
              })}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {FUNNEL.map((f, i) => {
                const n = active.filter((l) => l.status === f.s).length;
                return (
                  <button key={f.s} onClick={() => nav.go("leads")} className="focusable text-left rounded-md border border-mist px-2 py-1.5 hover:border-pine-500 hover:-translate-y-px transition-all anim-up" style={{ animationDelay: `${100 + i * 40}ms` }}>
                    <span className={cx("inline-block w-2 h-2 rounded-full mr-1.5", f.c)} />
                    <span className="text-[9.5px] font-display font-semibold uppercase tracking-wide text-ink-soft">{f.s.toLowerCase()}</span>
                    <p className={cx("num text-[17px] font-semibold leading-none mt-0.5", f.t)}>{n}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HStat label="Leads this month" value={newThisMonth} format={(n) => fmtN(n)} delay={140} />
            <HStat label="Conversion" value={convRate} format={(n) => `${n}%`} sub={`${converted} converted`} tone="text-pine-700" delay={200} />
            <HStat label="My open cases" value={myCases.length} format={(n) => fmtN(n)} sub="still in my name" delay={260} />
            <HStat label="Handed off" value={handedOff.length} format={(n) => fmtN(n)} sub="now with SPO" delay={320} />
          </div>
        </div>
      </div>

      {/* my active leads — hand off to another VRM on leave */}
      <div className="anim-up bg-card border border-mist rounded-lg p-4 mt-4" style={{ animationDelay: "160ms" }}>
        <SectionTitle right={<span className="text-[11px] text-ink-soft">going on leave? hand a lead to another VRM →</span>}>My active leads</SectionTitle>
        <div className="grid md:grid-cols-2 gap-1.5">
          {active.map((l) => {
            const person = state.persons.find((p) => p.id === l.personId);
            return (
              <div key={l.id} className="group flex items-center gap-3 border border-mist rounded-md px-3 py-2.5 hover:border-pine-500 hover:shadow-sm transition-all">
                <button onClick={() => nav.go("leads")} className="flex-1 min-w-0 text-left focusable rounded">
                  <div className="flex items-center gap-2">
                    <span className="num text-[11px] font-bold text-pine-700 shrink-0">{l.ref}</span>
                    <span className="text-[12.5px] font-semibold truncate">{person?.name}</span>
                  </div>
                  <p className="text-[10.5px] text-ink-soft truncate mt-0.5">{l.source} · {l.status.toLowerCase()} · {l.nextAction ?? "no next action"}</p>
                </button>
                <button onClick={() => setLeadH(l)} title="Hand off this lead"
                  className="focusable shrink-0 w-7 h-7 rounded-md border border-mist flex items-center justify-center text-ink-soft hover:border-pine-600 hover:text-pine-700 hover:bg-pine-50 transition-all opacity-0 group-hover:opacity-100">
                  <Ic n="arrowR" size={14} />
                </button>
              </div>
            );
          })}
          {active.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-3">No active leads — create one above.</p>}
        </div>
      </div>

      {/* my cases + handed off */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "180ms" }}>
          <SectionTitle right={<span className="text-[11px] text-ink-soft">hand off to SPO on progression →</span>}>My cases</SectionTitle>
          <div className="space-y-1.5">
            {myCases.map((c) => <CaseRow key={c.id} c={c} onHandoff={setHandoff} showHandoff />)}
            {myCases.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-3">No cases in your name — they move to SPO after conversion.</p>}
          </div>
        </div>
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "240ms" }}>
          <SectionTitle right={<span className="text-[11px] text-ink-soft">read-only after handoff</span>}>Where my files are now</SectionTitle>
          <div className="space-y-1.5">
            {handedOff.slice(0, 6).map((c) => <CaseRow key={c.id} c={c} onHandoff={() => {}} />)}
            {handedOff.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-3">No handed-off files yet.</p>}
          </div>
        </div>
      </div>

      {handoff && <HandoffModal caze={handoff} onClose={() => setHandoff(null)} />}
      {leadH && <HandoffModal lead={leadH} onClose={() => setLeadH(null)} />}
    </div>
  );
}

/* ---------------- SPO ---------------- */
function SpoHome({ me }: { me: User }) {
  const { state } = useStore();
  const nav = useNav();
  const [handoff, setHandoff] = useState<Case | null>(null);
  const today = todayISO();

  const my = state.cases.filter((c) => c.status === "OPEN" && c.ownerId === me.id);
  const ready = my.filter((c) => stageGates(state, c).pass && c.stage !== state.stages[state.stages.length - 1].id);
  const blocked = my.filter((c) => c.waitingFor || c.pendingReason);
  const overdue = my.filter((c) => { const d = daysUntil(c.nextActionDue); return d !== null && d < 0; });
  const queries = state.queries.filter((q) => q.status === "OPEN" && my.some((c) => c.id === q.caseId));
  const inbox = state.cases.filter((c) => c.status === "OPEN" && c.ownerId === me.id && (c.handoffs ?? []).some((h) => h.toId === me.id && daysUntil(h.at.slice(0, 10)) !== null && daysUntil(h.at.slice(0, 10))! >= -7));

  /* today's worklist, prioritized */
  const worklist = useMemo(() => {
    const items: { prio: number; label: string; c: Case; due?: string; icon: string }[] = [];
    queries.forEach((q) => { const c = my.find((x) => x.id === q.caseId)!; items.push({ prio: 0, label: `Respond to bank query · ${q.requirement.slice(0, 44)}…`, c, due: q.due, icon: "help" }); });
    my.filter((c) => c.stage === "PREAPP").forEach((c) => items.push({ prio: 1, label: "Chase pre-approval (daily follow-up)", c, due: c.nextActionDue, icon: "send" }));
    my.filter((c) => c.stage === "FOL").forEach((c) => items.push({ prio: 2, label: "FOL follow-up / client confirmation", c, due: c.nextActionDue, icon: "file" }));
    my.filter((c) => c.stage === "VALUATION").forEach((c) => items.push({ prio: 3, label: "Valuation scheduling / report follow-up", c, due: c.nextActionDue, icon: "timer" }));
    overdue.filter((c) => !items.some((i) => i.c.id === c.id)).forEach((c) => items.push({ prio: 4, label: c.nextAction ?? "Overdue action", c, due: c.nextActionDue, icon: "alert" }));
    return items.sort((a, b) => a.prio - b.prio || (a.due ?? "9999").localeCompare(b.due ?? "9999")).slice(0, 9);
  }, [my, queries, overdue]);

  const stageLanes = state.stages.map((s) => ({ s, n: my.filter((c) => c.stage === s.id).length })).filter((x) => x.n > 0);
  const maxLane = Math.max(1, ...stageLanes.map((x) => x.n));

  return (
    <div>
      <RoleHeader me={me} job="Push your files through the stages — submit, chase, coordinate, close." accent="bg-steel-100 text-steel-700" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <HStat label="My files" value={my.length} format={(n) => fmtN(n)} sub={`${stageLanes.length} stages`} delay={0} />
        <HStat label="Ready to advance" value={ready.length} format={(n) => fmtN(n)} tone="text-pine-700" sub="gates green" delay={60} />
        <HStat label="Blocked / waiting" value={blocked.length} format={(n) => fmtN(n)} tone="text-amber-600" delay={120} />
        <HStat label="Overdue" value={overdue.length} format={(n) => fmtN(n)} tone={overdue.length ? "text-rust-600" : "text-ink"} delay={180} />
      </div>

      {inbox.length > 0 && (
        <div className="anim-up mb-4 border border-pine-300 bg-pine-50/70 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="w-8 h-8 rounded-md bg-pine-600 text-paper flex items-center justify-center shrink-0"><Ic n="arrowR" size={16} /></span>
          <p className="text-[12.5px] flex-1"><strong>{inbox.length} file{inbox.length > 1 ? "s" : ""} handed to you.</strong> They're now in your name below — review the handoff note in each Case 360.</p>
          <Pill tone="pine">handoff inbox</Pill>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        {/* today's worklist */}
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "120ms" }}>
          <SectionTitle right={<span className="text-[11px] text-ink-soft num">{today === todayISO() ? fmtDate(today) : ""}</span>}>Today's worklist</SectionTitle>
          <div className="space-y-1.5">
            {worklist.map((w, i) => (
              <button key={w.c.id + w.prio + i} onClick={() => nav.go("cases", { caseId: w.c.id })}
                className="focusable w-full flex items-center gap-3 bg-paper/50 border border-mist rounded-md px-3 py-2.5 text-left hover:border-pine-500 hover:shadow-sm hover:-translate-y-px transition-all anim-up group"
                style={{ animationDelay: `${160 + i * 45}ms` }}>
                <span className={cx("w-7 h-7 rounded-md flex items-center justify-center shrink-0", w.prio === 0 ? "bg-rust-100 text-rust-700" : w.prio <= 2 ? "bg-amber-100 text-amber-700" : "bg-steel-100 text-steel-700")}>
                  <Ic n={w.icon} size={14} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-semibold truncate group-hover:text-pine-800">{w.label}</span>
                  <span className="block text-[10.5px] text-ink-soft num">{w.c.ref} · {state.persons.find((p) => p.id === w.c.personId)?.name} · {state.banks.find((b) => b.id === w.c.bankId)?.short}</span>
                </span>
                <DueChip iso={w.due} />
              </button>
            ))}
            {worklist.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-3">Nothing urgent — all clear for today.</p>}
          </div>
        </div>

        {/* right column: lanes + ready tray */}
        <div className="space-y-4">
          <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "200ms" }}>
            <SectionTitle>My files by stage</SectionTitle>
            <div className="space-y-2">
              {stageLanes.map(({ s, n }, i) => (
                <button key={s.id} onClick={() => nav.go("cases")} className="focusable w-full flex items-center gap-2.5 group">
                  <span className="w-9 text-[10px] font-display font-bold uppercase tracking-wide text-ink-soft shrink-0">{s.short}</span>
                  <span className="flex-1 h-5 bg-mist/40 rounded overflow-hidden">
                    <span className="block h-full bg-pine-600 group-hover:bg-pine-500 bar-grow transition-colors" style={{ width: `${(n / maxLane) * 100}%`, animationDelay: `${i * 50}ms` }} />
                  </span>
                  <span className="num text-[12px] font-semibold w-5 text-right">{n}</span>
                </button>
              ))}
              {stageLanes.length === 0 && <p className="text-[12px] text-ink-soft italic">No open files.</p>}
            </div>
          </div>

          <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "280ms" }}>
            <SectionTitle right={<Pill tone="pine">{ready.length}</Pill>}>Ready to advance</SectionTitle>
            <div className="space-y-1.5">
              {ready.slice(0, 5).map((c) => <CaseRow key={c.id} c={c} onHandoff={setHandoff} showHandoff />)}
              {ready.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-2">No files with all gates green.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* my open files with handoff */}
      <div className="anim-up bg-card border border-mist rounded-lg p-4 mt-4" style={{ animationDelay: "340ms" }}>
        <SectionTitle right={<span className="text-[11px] text-ink-soft">single active owner — hand off, don't share</span>}>My open files</SectionTitle>
        <div className="grid md:grid-cols-2 gap-1.5">
          {my.map((c) => <CaseRow key={c.id} c={c} onHandoff={setHandoff} showHandoff />)}
        </div>
      </div>

      {handoff && <HandoffModal caze={handoff} onClose={() => setHandoff(null)} />}
    </div>
  );
}

/* ---------------- Team Leader ---------------- */
function TlHome({ me }: { me: User }) {
  const { state } = useStore();
  const nav = useNav();
  const [handoff, setHandoff] = useState<Case | null>(null);
  const today = todayISO();
  const team = teamOf(state, me);
  const members = state.users.filter((u) => team.has(u.id) && u.id !== me.id && u.active);
  const teamCases = state.cases.filter((c) => c.status === "OPEN" && team.has(c.ownerId));

  const rows = members.map((m) => {
    const cs = teamCases.filter((c) => c.ownerId === m.id);
    const od = cs.filter((c) => { const d = daysUntil(c.nextActionDue); return d !== null && d < 0; }).length;
    const adv = cs.filter((c) => (c.stageHistory ?? []).some((h) => h.by === m.id && h.at.slice(0, 10) >= today.slice(0, 8) + "01")).length;
    return { m, n: cs.length, od, adv };
  }).sort((a, b) => b.n - a.n);
  const maxN = Math.max(1, ...rows.map((r) => r.n));

  const escalations = teamCases
    .map((c) => ({ c, t: tatFor(c, c.stage, state.stages, today) }))
    .filter((x) => x.t.level >= 1)
    .sort((a, b) => b.t.level - a.t.level || b.t.daysOver - a.t.daysOver);
  const stuck = teamCases.filter((c) => caseBucket(state, c) === "noaction" || caseBucket(state, c) === "waiting");

  return (
    <div>
      <RoleHeader me={me} job="Keep the team's throughput flowing — unblock, reassign, catch slips early." accent="bg-pine-100 text-pine-800" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <HStat label="Team open files" value={teamCases.length} format={(n) => fmtN(n)} sub={`${members.length} members`} delay={0} />
        <HStat label="Escalations" value={escalations.length} format={(n) => fmtN(n)} tone={escalations.length ? "text-rust-600" : "text-ink"} delay={60} />
        <HStat label="Stuck / waiting" value={stuck.length} format={(n) => fmtN(n)} tone="text-amber-600" delay={120} />
        <HStat label="Team pipeline" value={teamCases.reduce((s, c) => s + c.loanAmount, 0)} format={(n) => (n ? fmtAED(n) : "—")} delay={180} tone="text-pine-700" />
      </div>

      {/* workload */}
      <div className="anim-up bg-card border border-mist rounded-lg p-4 mb-4" style={{ animationDelay: "120ms" }}>
        <SectionTitle right={<span className="text-[11px] text-ink-soft">click a name to see their cases</span>}>Team workload</SectionTitle>
        <div className="space-y-2.5">
          {rows.map(({ m, n, od, adv }, i) => (
            <button key={m.id} onClick={() => nav.go("cases")} className="focusable w-full flex items-center gap-3 group anim-up" style={{ animationDelay: `${160 + i * 45}ms` }}>
              <Avatar name={m.name} size={30} />
              <span className="w-28 text-left">
                <span className="block text-[12.5px] font-semibold truncate group-hover:text-pine-800">{m.name}</span>
                <span className="block text-[10px] text-ink-soft">{ROLE_LABEL[m.role]}</span>
              </span>
              <span className="flex-1 h-6 bg-mist/40 rounded overflow-hidden relative">
                <span className={cx("block h-full bar-grow transition-colors", od > 0 ? "bg-rust-500 group-hover:bg-rust-400" : "bg-pine-600 group-hover:bg-pine-500")} style={{ width: `${(n / maxN) * 100}%`, animationDelay: `${i * 60}ms` }} />
              </span>
              <span className="num text-[13px] font-semibold w-6 text-right">{n}</span>
              {od > 0
                ? <Pill tone="rust">{od} od</Pill>
                : adv > 0 ? <Pill tone="pine">+{adv} mo</Pill> : <span className="w-[52px]" />}
            </button>
          ))}
          {rows.length === 0 && <p className="text-[12px] text-ink-soft italic">No team members found.</p>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* escalation queue */}
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "220ms" }}>
          <SectionTitle right={<Pill tone={escalations.length ? "rust" : "pine"}>{escalations.length}</Pill>}>Escalation queue</SectionTitle>
          <div className="space-y-1.5">
            {escalations.slice(0, 6).map(({ c, t }) => (
              <div key={c.id} className="flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 hover:border-rust-400 transition-colors">
                <button onClick={() => nav.go("cases", { caseId: c.id })} className="flex-1 min-w-0 text-left focusable rounded">
                  <p className="text-[12px] font-semibold truncate">{state.persons.find((p) => p.id === c.personId)?.name} <span className="num text-ink-soft font-normal">· {c.ref}</span></p>
                  <p className="text-[10.5px] text-ink-soft truncate">{state.stages.find((s) => s.id === c.stage)?.name} · {t.daysOver}d over · owner {state.users.find((u) => u.id === c.ownerId)?.name?.split(" ")[0]}</p>
                </button>
                <span className={cx("text-[9.5px] font-display font-bold tracking-wide px-1.5 py-0.5 rounded", ESC_LEVELS[t.level].chip)}>{ESC_LEVELS[t.level].tag}</span>
                <button onClick={() => setHandoff(c)} title="Reassign" className="focusable w-6 h-6 rounded border border-mist flex items-center justify-center text-ink-soft hover:border-pine-600 hover:text-pine-700 transition-all"><Ic n="arrowR" size={13} /></button>
              </div>
            ))}
            {escalations.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-2">No escalations in your team.</p>}
          </div>
        </div>

        {/* stuck */}
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "280ms" }}>
          <SectionTitle right={<Pill tone="amber">{stuck.length}</Pill>}>Stuck / waiting files</SectionTitle>
          <div className="space-y-1.5">
            {stuck.slice(0, 6).map((c) => <CaseRow key={c.id} c={c} onHandoff={setHandoff} showHandoff />)}
            {stuck.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-2">Nothing stuck.</p>}
          </div>
        </div>
      </div>

      {handoff && <HandoffModal caze={handoff} onClose={() => setHandoff(null)} />}
    </div>
  );
}

/* ---------------- PA / Binish — Coordination Desk ---------------- */
function PaHome({ me }: { me: User }) {
  const { state } = useStore();
  const nav = useNav();
  const today = todayISO();
  const valuations = state.cases.filter((c) => c.status === "OPEN" && c.stage === "VALUATION");
  const feePending = valuations.filter((c) => !(c.docs ?? []).some((dsc) => dsc.typeId === "VALPAYPROOF" && (dsc.status === "RECEIVED" || dsc.status === "VERIFIED")));
  const reportsDue = valuations.filter((c) => tatFor(c, "VALUATION", state.stages, today).level >= 1);
  const myTasks = state.tasks.filter((t) => t.status === "OPEN" && t.ownerId === me.id);
  const eibor = state.eibor[state.eibor.length - 1];

  return (
    <div>
      <RoleHeader me={me} job="Coordinate valuations & inspections — the 24h evaluator contact and 48h report clocks run through you." accent="bg-steel-100 text-steel-700" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <HStat label="Valuations in motion" value={valuations.length} format={(n) => fmtN(n)} delay={0} />
        <HStat label="Fees pending" value={feePending.length} format={(n) => fmtN(n)} tone={feePending.length ? "text-amber-600" : "text-ink"} sub="client to pay" delay={60} />
        <HStat label="Reports overdue" value={reportsDue.length} format={(n) => fmtN(n)} tone={reportsDue.length ? "text-rust-600" : "text-ink"} sub="48h clock" delay={120} />
        <HStat label="My tasks" value={myTasks.length} format={(n) => fmtN(n)} delay={180} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* valuations board */}
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "120ms" }}>
          <SectionTitle right={<span className="text-[11px] text-ink-soft">evaluator contact ≤24h · report ≤48h</span>}>Valuations board</SectionTitle>
          <div className="space-y-1.5">
            {valuations.map((c, i) => {
              const t = tatFor(c, "VALUATION", state.stages, today);
              const fee = (c.docs ?? []).find((dsc) => dsc.typeId === "VALPAYPROOF");
              const paid = fee && (fee.status === "RECEIVED" || fee.status === "VERIFIED");
              return (
                <button key={c.id} onClick={() => nav.go("cases", { caseId: c.id, params: { tab: "tat" } })}
                  className="focusable w-full flex items-center gap-3 border border-mist rounded-md px-3 py-2.5 text-left hover:border-pine-500 hover:shadow-sm hover:-translate-y-px transition-all anim-up group"
                  style={{ animationDelay: `${160 + i * 45}ms` }}>
                  <span className={cx("w-8 h-8 rounded-md flex items-center justify-center shrink-0", paid ? "bg-pine-100 text-pine-700" : "bg-amber-100 text-amber-700")}>
                    <Ic n="timer" size={15} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold truncate group-hover:text-pine-800">{state.persons.find((p) => p.id === c.personId)?.name} <span className="num text-ink-soft font-normal">· {c.ref}</span></span>
                    <span className="block text-[10.5px] text-ink-soft truncate">{state.banks.find((b) => b.id === c.bankId)?.short} · {paid ? "fee paid" : "fee pending"} · {state.users.find((u) => u.id === c.ownerId)?.name?.split(" ")[0]}</span>
                  </span>
                  <Pill tone={paid ? "pine" : "amber"}>{paid ? "fee ✓" : "fee due"}</Pill>
                  {t.level >= 1 && <span className={cx("text-[9.5px] font-display font-bold px-1.5 py-0.5 rounded", ESC_LEVELS[t.level].chip)}>{ESC_LEVELS[t.level].tag}</span>}
                </button>
              );
            })}
            {valuations.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-3">No active valuations.</p>}
          </div>
        </div>

        {/* right: my tasks + admin strip */}
        <div className="space-y-4">
          <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "200ms" }}>
            <SectionTitle>My coordination tasks</SectionTitle>
            <div className="space-y-1.5">
              {myTasks.slice(0, 5).map((t) => (
                <button key={t.id} onClick={() => nav.go("tasks")} className="focusable w-full text-left border border-mist rounded-md px-3 py-2 hover:border-pine-500 transition-colors">
                  <p className="text-[12px] font-semibold truncate">{t.title}</p>
                  <p className="text-[10.5px] text-ink-soft num">{t.type} · {t.priority.toLowerCase()}</p>
                </button>
              ))}
              {myTasks.length === 0 && <p className="text-[12px] text-ink-soft italic px-1 py-2">No open tasks.</p>}
            </div>
          </div>

          <div className="anim-up rounded-lg bg-ink text-paper p-4 sidebar-texture" style={{ animationDelay: "280ms" }}>
            <p className="text-[10px] font-display font-semibold uppercase tracking-[0.13em] text-paper/60">Admin strip</p>
            {eibor && (
              <div className="flex items-center justify-between mt-2.5">
                <div>
                  <p className="font-display font-bold text-[15px]">EIBOR 3M <span className="num text-pine-300">{fmtN(eibor.m3, 3)}%</span></p>
                  <p className="text-[10.5px] text-paper/60 num">published {fmtDate(eibor.date)}</p>
                </div>
                <Ic n="pulse" size={22} className="text-pine-400" />
              </div>
            )}
            <button onClick={() => nav.go("rules")} className="focusable mt-3 w-full flex items-center justify-center gap-2 bg-pine-600 hover:bg-pine-500 text-paper rounded-md py-2 text-[12px] font-display font-bold transition-colors">
              <Ic n="plus" size={14} /> Publish EIBOR row
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- TBD ---------------- */
function TbdHome({ me }: { me: User }) {
  return (
    <div>
      <RoleHeader me={me} job="Your designation is being finalized — you have read access to the control tower." accent="bg-gr-100 text-gr-700" />
      <Dashboard />
    </div>
  );
}

/* ---------------- dispatcher ---------------- */
export default function Home() {
  const me = useMe()!;
  if (isOversight(me.role)) return <Dashboard />; // Head / Admin / PA-oversee keep the full control tower
  switch (me.role) {
    case "VRM": return <VrmHome me={me} />;
    case "SPO": return <SpoHome me={me} />;
    case "TL": return <TlHome me={me} />;
    case "PA": return <PaHome me={me} />;
    default: return <TbdHome me={me} />;
  }
}
