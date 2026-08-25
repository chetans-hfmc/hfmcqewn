import { useMemo, useState } from "react";
import type { Rule, RuleModule, User } from "../types";
import { ROLE_LABEL, isOversight, useMe, useStore } from "../store";
import { Avatar, Btn, DangerModal, Field, Ic, KV, Modal, NumInput, Pill, SectionHead, Select, TextArea, TextInput, cx, fmtDate, fmtTime, nowISO, todayISO, uid } from "../ui";

const MODULES: { v: RuleModule; l: string }[] = [
  { v: "LTV", l: "LTV" }, { v: "DBR", l: "DBR / DSR" }, { v: "RETIRE", l: "Retirement age" },
  { v: "TENURE", l: "Tenure" }, { v: "CC", l: "Credit card" }, { v: "MIN_SAL", l: "Min salary" },
  { v: "FEE", l: "Fees" }, { v: "STMT", l: "Statement period" }, { v: "TAT", l: "TAT timelines" },
];

/* ---------- Rule Centre ---------- */
export function RuleCentre() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const [mod, setMod] = useState<"ALL" | RuleModule>("ALL");
  const [edit, setEdit] = useState<{ rule: Rule; value: number; isNew: boolean } | null>(null);
  const canEdit = isOversight(me.role);
  const rules = state.rules.filter((r) => (mod === "ALL" ? true : r.module === mod));
  return (
    <div className="space-y-4">
      <SectionHead title="Rule centre" sub="Versioned global & bank rules. Every change creates a new version — old cases keep the rule they were decided under."
        right={canEdit && <Btn onClick={() => setEdit({ rule: { id: "r" + uid(), code: "", module: "LTV", name: "", scope: {}, kind: "pct", value: 0, version: 1, effectiveFrom: todayISO(), active: true, history: [] }, value: 0, isNew: true })}><Ic n="plus" size={14} /> New rule</Btn>} />
      <div className="anim-up flex flex-wrap gap-1.5">
        {([{ v: "ALL", l: "All" }] as { v: "ALL" | RuleModule; l: string }[]).concat(MODULES).map((m) => (
          <button key={m.v} onClick={() => setMod(m.v)}
            className={cx("focusable px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all",
              mod === m.v ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft hover:border-ink/40")}>
            {m.l} <span className="num opacity-70">{m.v === "ALL" ? state.rules.length : state.rules.filter((r) => r.module === m.v).length}</span>
          </button>
        ))}
      </div>
      <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto" style={{ animationDelay: "80ms" }}>
        <table className="w-full text-[12.5px] min-w-[820px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">Rule</th>
              <th className="px-3 py-2.5 font-semibold">Module</th>
              <th className="px-3 py-2.5 font-semibold">Scope</th>
              <th className="px-3 py-2.5 font-semibold">Value</th>
              <th className="px-3 py-2.5 font-semibold">Version</th>
              <th className="px-3 py-2.5 font-semibold">Effective</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              {canEdit && <th className="px-3 py-2.5 font-semibold text-right">Edit</th>}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const scope = [
                r.scope.bankId ? state.banks.find((b) => b.id === r.scope.bankId)?.short : null,
                r.scope.customerType, r.scope.employment, r.scope.financeCount ? `${r.scope.financeCount}${r.scope.financeCount === 1 ? "st" : "nd"} finance` : null,
              ].filter(Boolean).join(" · ") || "Global";
              return (
                <tr key={r.id} className="border-b border-mist/60 last:border-0 hover:bg-paper/40 transition-colors">
                  <td className="px-4 py-3"><div><p className="font-semibold">{r.name}</p><p className="num text-[10.5px] text-ink-soft">{r.code}{r.note ? ` · ${r.note}` : ""}</p></div></td>
                  <td className="px-3 py-3"><Pill tone="steel">{r.module}</Pill></td>
                  <td className="px-3 py-3 text-[11.5px]">{scope}</td>
                  <td className="px-3 py-3 num font-bold text-pine-700">{r.value}{r.kind === "pct" ? "%" : r.kind === "months" ? " mo" : r.kind === "years" ? " yrs" : ""}</td>
                  <td className="px-3 py-3 num text-[11px]">v{r.version}{r.history.length > 1 && <span className="text-ink-soft"> ({r.history.length} versions)</span>}</td>
                  <td className="px-3 py-3 num text-[11px]">{fmtDate(r.effectiveFrom)}</td>
                  <td className="px-3 py-3"><Pill tone={r.active ? "pine" : "gr"} dot>{r.active ? "active" : "inactive"}</Pill></td>
                  {canEdit && <td className="px-3 py-3 text-right"><button onClick={() => setEdit({ rule: r, value: r.value, isNew: false })} className="focusable p-1.5 rounded-md hover:bg-pine-100 text-pine-700 transition-colors"><Ic n="edit" size={14} /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && <RuleEditor edit={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function RuleEditor({ edit, onClose }: { edit: { rule: Rule; value: number; isNew: boolean }; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [f, setF] = useState({ ...edit.rule, value: edit.value, name: edit.rule.name, code: edit.rule.code });
  const changed = !edit.isNew && f.value !== edit.rule.value;
  const save = () => {
    const nextVersion = changed ? edit.rule.version + 1 : edit.rule.version;
    const rule: Rule = {
      ...f,
      version: nextVersion,
      effectiveFrom: changed ? todayISO() : f.effectiveFrom,
      history: changed ? [...f.history, { version: nextVersion, value: f.value, effectiveFrom: todayISO() }] : (f.history.length ? f.history : [{ version: nextVersion, value: f.value, effectiveFrom: f.effectiveFrom }]),
    };
    dispatch({ t: "UPSERT_RULE", rule, isNew: edit.isNew });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={edit.isNew ? "New rule" : `Edit ${edit.rule.code}`} width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={edit.isNew && (!f.code.trim() || !f.name.trim())} onClick={save}>
          <Ic n="check" size={13} /> {changed ? `Save as v${edit.rule.version + 1}` : "Save"}
        </Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" req><TextInput disabled={!edit.isNew} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="e.g. LTV-EXP-1" /></Field>
        <Field label="Module"><Select value={f.module} onChange={(v) => setF({ ...f, module: v as RuleModule })} options={MODULES} /></Field>
        <div className="col-span-2"><Field label="Name" req><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
        <Field label="Value"><NumInput value={f.value} onChange={(n) => setF({ ...f, value: n })} /></Field>
        <Field label="Kind"><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v as Rule["kind"] })} options={[{ v: "pct", l: "Percent" }, { v: "months", l: "Months" }, { v: "years", l: "Years" }, { v: "amount", l: "Amount" }, { v: "number", l: "Number" }]} /></Field>
        <Field label="Bank scope"><Select value={f.scope.bankId ?? ""} onChange={(v) => setF({ ...f, scope: { ...f.scope, bankId: v || undefined } })} options={[{ v: "", l: "All banks" }, ...state.banks.map((b) => ({ v: b.id, l: b.name }))]} /></Field>
        <Field label="Customer type"><Select value={f.scope.customerType ?? ""} onChange={(v) => setF({ ...f, scope: { ...f.scope, customerType: (v || undefined) as Rule["scope"]["customerType"] } })} options={[{ v: "", l: "All" }, { v: "NATIONAL", l: "National" }, { v: "EXPAT", l: "Expat" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Active"><Select value={f.active ? "1" : "0"} onChange={(v) => setF({ ...f, active: v === "1" })} options={[{ v: "1", l: "Active" }, { v: "0", l: "Inactive" }]} /></Field>
        <div className="col-span-2"><Field label="Note"><TextInput value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value || undefined })} placeholder="e.g. TO VERIFY" /></Field></div>
      </div>
      {!edit.isNew && f.history.length > 0 && (
        <div className="mt-4">
          <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Version history</p>
          {[...f.history].reverse().map((h) => (
            <div key={h.version} className="flex items-center gap-3 text-[11.5px] py-1.5 border-b border-mist/50 last:border-0">
              <span className="num font-bold text-pine-700">v{h.version}</span>
              <span className="num">{h.value}</span>
              <span className="num text-ink-soft ml-auto">from {fmtDate(h.effectiveFrom)}</span>
            </div>
          ))}
          {changed && <p className="text-[11px] text-amber-700 mt-2">Value changed — saving will create v{edit.rule.version + 1} effective today.</p>}
        </div>
      )}
    </Modal>
  );
}

/* ---------- Users & Roles ---------- */
export function UsersView() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const [add, setAdd] = useState(false);
  const canEdit = me.role === "ADMIN" || me.role === "HEAD";
  return (
    <div className="space-y-4">
      <SectionHead title="Users & roles" sub="User → Role → Permission. The permission matrix remains TO VERIFY."
        right={canEdit && <Btn onClick={() => setAdd(true)}><Ic n="plus" size={14} /> New user</Btn>} />
      <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">User</th>
              <th className="px-3 py-2.5 font-semibold">Role</th>
              <th className="px-3 py-2.5 font-semibold">Team</th>
              <th className="px-3 py-2.5 font-semibold">Reports to</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              {canEdit && <th className="px-3 py-2.5 font-semibold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id} className="border-b border-mist/60 last:border-0 hover:bg-paper/40 transition-colors">
                <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={u.name} size={30} /><div><p className="font-semibold">{u.name}</p><p className="num text-[10.5px] text-ink-soft">{u.empId}{u.note ? ` · ${u.note}` : ""}</p></div></div></td>
                <td className="px-3 py-3"><Pill tone={u.role === "ADMIN" ? "ink" : u.role === "HEAD" ? "pine" : u.role === "TL" ? "steel" : u.role === "SPO" ? "amber" : "gr"}>{ROLE_LABEL[u.role]}</Pill></td>
                <td className="px-3 py-3 text-[11.5px]">{u.team}</td>
                <td className="px-3 py-3 text-[11.5px]">{u.leaderId ? state.users.find((x) => x.id === u.leaderId)?.name : "—"}</td>
                <td className="px-3 py-3"><Pill tone={u.active ? "pine" : "gr"} dot>{u.active ? "active" : "inactive"}</Pill></td>
                {canEdit && (
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => dispatch({ t: "UPDATE_USER", id: u.id, patch: { active: !u.active } })}
                      className="focusable text-[11px] font-display font-bold text-ink-soft hover:text-rust-600 transition-colors">
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {add && <UserForm onClose={() => setAdd(false)} />}
    </div>
  );
}

function UserForm({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const nextNum = state.users.length + 1;
  const [f, setF] = useState({ empId: `hfmm-${String(nextNum).padStart(2, "0")}`, name: "", role: "SPO" as User["role"], team: "Ops Team (SPO)", note: "" });
  const taken = state.users.some((u) => u.empId === f.empId.trim());
  return (
    <Modal open onClose={onClose} title="New user" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.name.trim() || taken} onClick={() => {
          dispatch({ t: "ADD_USER", user: { id: f.empId.trim(), empId: f.empId.trim(), name: f.name.trim(), email: "", mobile: "", role: f.role, team: f.team, active: true, createdAt: todayISO(), note: f.note || undefined } });
          onClose();
        }}><Ic n="plus" size={13} /> Add user</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Employee ID" req hint={taken ? "already taken" : undefined}>
          <TextInput value={f.empId} onChange={(e) => setF({ ...f, empId: e.target.value })} />
        </Field>
        <Field label="Full name" req><TextInput autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Role"><Select value={f.role} onChange={(v) => setF({ ...f, role: v as User["role"] })} options={Object.entries(ROLE_LABEL).map(([v, l]) => ({ v, l }))} /></Field>
        <Field label="Team"><Select value={f.team} onChange={(v) => setF({ ...f, team: v })} options={[{ v: "Management", l: "Management" }, { v: "Sales & Ops", l: "Sales & Ops" }, { v: "Ops Team (SPO)", l: "Ops Team (SPO)" }, { v: "Sales Team (VRM)", l: "Sales Team (VRM)" }]} /></Field>
        <div className="col-span-2"><Field label="Note"><TextInput value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. New joiner" /></Field></div>
      </div>
    </Modal>
  );
}

/* ---------- Audit Trail ---------- */
export function AuditView() {
  const { state } = useStore();
  const [mod, setMod] = useState("ALL");
  const [q, setQ] = useState("");
  const modules = useMemo(() => Array.from(new Set(state.audit.map((a) => a.module))), [state.audit]);
  const rows = state.audit
    .filter((a) => (mod === "ALL" ? true : a.module === mod))
    .filter((a) => !q.trim() || [a.action, a.target, a.detail ?? "", state.users.find((u) => u.id === a.by)?.name ?? ""].join(" ").toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-4">
      <SectionHead title="Audit trail" sub="WHO did WHAT, WHEN — every mutation is recorded."
        right={<div className="flex gap-2">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-[200px]" />
          <Select value={mod} onChange={setMod} className="w-[140px]" options={[{ v: "ALL", l: "All modules" }, ...modules.map((m) => ({ v: m, l: m }))]} />
        </div>} />
      <div className="anim-up bg-card border border-mist rounded-lg overflow-hidden">
        {rows.slice(0, 120).map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0 hover:bg-paper/40 transition-colors">
            <Avatar name={state.users.find((u) => u.id === a.by)?.name ?? a.by} size={24} />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px]"><span className="font-semibold">{state.users.find((u) => u.id === a.by)?.name ?? a.by}</span> <span className="text-ink-soft">·</span> {a.action} <span className="font-medium">{a.target}</span></p>
              {a.detail && <p className="text-[11px] text-ink-soft truncate">{a.detail}</p>}
            </div>
            <Pill tone="gr">{a.module}</Pill>
            <span className="num text-[10.5px] text-ink-soft whitespace-nowrap">{fmtTime(a.at)}</span>
          </div>
        ))}
        {!rows.length && <p className="px-4 py-10 text-center text-ink-soft text-[12px]">No audit entries match.</p>}
      </div>
    </div>
  );
}

/* ---------- Ops Guide Book (Batch 1 summary) ---------- */
export function GuideView() {
  const chapters = [
    { n: "2", t: "Operating principles", d: "One case, one controlled journey. Verification before submission. Transaction type drives the document set. Stage handover is a control point." },
    { n: "3", t: "Operating model", d: "Virtual RM 1 → Pre-Approval → VRM 2 → SPO (Valuation / FOL / Final Transfer) → Bank RM / Huspy. The current-stage owner owns follow-up until the handover condition is met." },
    { n: "4", t: "Mortgage lifecycle", d: "File Intake → Pre-Approval → Valuation → FOL → Signing/DDA → Loan Booking → Liability/Release → Final Transfer → Title Deed QC → Closure." },
    { n: "5", t: "Handover logic", d: "RECEIVED · VERIFIED · PENDING · ISSUE · READY · HANDOVER. A handover is a transfer of a controlled case with evidence — not just an email." },
    { n: "6", t: "Transaction types", d: "Primary Sale · Resale · Buyout · Buyout + Equity · Pure Equity/Refinance. Each carries its own property-document package and settlement mechanics." },
    { n: "8", t: "Critical control points", d: "A) Identify the transaction before building the file. B) Keep the case stage-ready (received ≠ verified). C) Preserve bank-specific requirements. D) Separate source-derived rules from confirmed rules — TO VERIFY." },
  ];
  return (
    <div className="space-y-4 max-w-[900px]">
      <SectionHead title="Operations guide book" sub="Batch 1 of 8 — foundation, lifecycle and transaction types. Working draft for operational review." />
      <div className="anim-up bg-pine-950 text-paper rounded-lg p-5 sidebar-texture">
        <p className="text-[10.5px] font-display font-bold uppercase tracking-[0.16em] text-pine-300">HFMC · Document control</p>
        <h2 className="font-display font-bold text-[22px] tracking-tight mt-1">Mortgage Operations Guide Book</h2>
        <p className="text-[12px] text-paper/60 mt-1.5 max-w-[560px]">Where source material contains bank-specific or historical requirements, they are presented as source-derived controls and must be confirmed before live use.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {chapters.map((c, i) => (
          <div key={c.n} className="anim-up bg-card border border-mist rounded-lg p-4 hover:border-pine-600 hover:shadow-md transition-all" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-baseline gap-2.5">
              <span className="num font-bold text-[24px] text-pine-700">{c.n}.</span>
              <h3 className="font-display font-bold text-[14.5px] tracking-tight">{c.t}</h3>
            </div>
            <p className="text-[12px] text-ink-soft leading-relaxed mt-2">{c.d}</p>
          </div>
        ))}
      </div>
      <div className="anim-up bg-amber-100/50 border border-amber-500/30 rounded-lg px-4 py-3 text-[12px] text-amber-700">
        <strong>Source control:</strong> rules like "DBR strictly below 50%", "FOL validity 30/60/90 days" and bank-specific LTVs are seeded as working values — verify each against current bank instruction before production.
      </div>
    </div>
  );
}
