import { useMemo, useState } from "react";
import type { Rule, RuleModule, User } from "../types";
import { ROLE_LABEL, useMe, useNav, useStore } from "../store";
import { Avatar, Btn, DateInput, Field, Ic, Modal, NumInput, Pill, SectionHead, Select, TextInput, Toggle, cx, fmtAED, fmtDate, fmtN, fmtTime, todayISO, uid } from "../ui";

const MODULES: { m: RuleModule; l: string; d: string }[] = [
  { m: "LTV", l: "LTV matrix", d: "Customer type × finance count" },
  { m: "DBR", l: "DBR ceiling", d: "Strictly-below enforcement" },
  { m: "RETIRE", l: "Retirement age", d: "Incl. bank exceptions" },
  { m: "TENURE", l: "Tenure cap", d: "300 months / 25 years" },
  { m: "CC", l: "Credit card", d: "% of limits qualifying" },
  { m: "MIN_SAL", l: "Minimum salary", d: "By customer type" },
  { m: "FEE", l: "Fees", d: "Loan / property / flat basis" },
  { m: "SETTLE", l: "Settlement", d: "Early settlement charge" },
  { m: "STRESS", l: "Qualifying stress", d: "Added to rate for DBR" },
];

function scopeChips(r: Rule) {
  const chips: string[] = [];
  if (r.scope.customerType) chips.push(r.scope.customerType.replace("_", "-"));
  if (r.scope.employment) chips.push(r.scope.employment === "SALARIED" ? "Salaried" : "Self-empl.");
  if (r.scope.bankId) chips.push(r.scope.bankId.replace("b-", "").toUpperCase());
  if (r.scope.txType) chips.push(r.scope.txType.replace("_", "+"));
  if (r.scope.financeCount) chips.push(r.scope.financeCount === 1 ? "1st" : "2nd+");
  return chips;
}

function valueLabel(r: Rule) {
  if (r.kind === "pct") return `${r.value}%`;
  if (r.kind === "months") return `${r.value} mo`;
  if (r.kind === "years") return `${r.value} yrs`;
  if (r.kind === "amount") return fmtAED(r.value);
  return fmtN(r.value);
}

function EditRule({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const { dispatch } = useStore();
  const [value, setValue] = useState(rule.value);
  const [eff, setEff] = useState(todayISO());
  const [note, setNote] = useState(rule.note ?? "");
  return (
    <Modal open onClose={onClose} title={`Edit rule · ${rule.code}`} width={460}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => {
          dispatch({
            t: "UPSERT_RULE", rule: {
              ...rule, value, effectiveFrom: eff, note: note || undefined,
              version: rule.version + 1,
              history: [...rule.history, { version: rule.version, value: rule.value, effectiveFrom: rule.effectiveFrom }],
            },
          });
          onClose();
        }}>Publish v{rule.version + 1}</Btn></>}>
      <p className="text-[12px] text-ink-soft mb-4 -mt-1">Versioning: v{rule.version} ({valueLabel(rule)}, effective {fmtDate(rule.effectiveFrom)}) is archived to history. Saved calculations keep referencing the version they used.</p>
      <div className="space-y-4">
        <Field label={rule.kind === "pct" ? "Value (%)" : rule.kind === "amount" ? "Value (AED)" : "Value"}><NumInput value={value} onChange={setValue} suffix={rule.kind === "pct" ? "%" : rule.kind === "months" ? "mo" : rule.kind === "years" ? "yrs" : undefined} /></Field>
        <Field label="Effective from"><DateInput value={eff} onChange={(e) => setEff(e.target.value)} /></Field>
        <Field label="Note"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for change" /></Field>
      </div>
    </Modal>
  );
}

function NewRule({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const [f, setF] = useState({ module: "LTV" as RuleModule, code: "", name: "", kind: "pct" as Rule["kind"], value: 0, customerType: "", employment: "", bankId: "", txType: "", financeCount: "", basis: "loan" as "loan" | "property" | "flat", min: 0, cap: 0, eff: todayISO() });
  return (
    <Modal open onClose={onClose} title="New rule" width={560}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.code.trim() || !f.name.trim()} onClick={() => {
          dispatch({
            t: "UPSERT_RULE", isNew: true, rule: {
              id: "r" + uid(), code: f.code.trim().toUpperCase(), module: f.module, name: f.name.trim(),
              kind: f.kind, value: f.value,
              scope: {
                customerType: (f.customerType || undefined) as never, employment: (f.employment || undefined) as never,
                bankId: f.bankId || undefined, txType: (f.txType || undefined) as never,
                financeCount: f.financeCount ? (Number(f.financeCount) as 1 | 2) : undefined,
              },
              fee: f.module === "FEE" ? { basis: f.basis, min: f.min || undefined, cap: f.cap || undefined } : undefined,
              version: 1, effectiveFrom: f.eff, active: true, history: [],
            },
          });
          onClose();
        }}>Create v1</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Module"><Select value={f.module} onChange={(v) => setF({ ...f, module: v as RuleModule })} options={MODULES.map((m) => ({ v: m.m, l: m.l }))} /></Field>
        <Field label="Code" req><TextInput value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="e.g. LTV-EXP-1" /></Field>
        <div className="col-span-2"><Field label="Name" req><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. LTV · Expat · 1st finance" /></Field></div>
        <Field label="Kind"><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v as Rule["kind"] })} options={[{ v: "pct", l: "Percent" }, { v: "amount", l: "Amount AED" }, { v: "months", l: "Months" }, { v: "years", l: "Years" }, { v: "number", l: "Number" }]} /></Field>
        <Field label="Value"><NumInput value={f.value} onChange={(n) => setF({ ...f, value: n })} /></Field>
        <Field label="Customer type scope"><Select value={f.customerType} onChange={(v) => setF({ ...f, customerType: v })} options={[{ v: "", l: "All" }, { v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Employment scope"><Select value={f.employment} onChange={(v) => setF({ ...f, employment: v })} options={[{ v: "", l: "All" }, { v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self-Employed" }]} /></Field>
        <Field label="Finance count scope"><Select value={f.financeCount} onChange={(v) => setF({ ...f, financeCount: v })} options={[{ v: "", l: "Any" }, { v: "1", l: "1st" }, { v: "2", l: "2nd+" }]} /></Field>
        <Field label="Effective from"><DateInput value={f.eff} onChange={(e) => setF({ ...f, eff: e.target.value })} /></Field>
        {f.module === "FEE" && <>
          <Field label="Fee basis"><Select value={f.basis} onChange={(v) => setF({ ...f, basis: v as never })} options={[{ v: "loan", l: "% of loan" }, { v: "property", l: "% of property" }, { v: "flat", l: "Flat amount" }]} /></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="Min"><NumInput value={f.min} onChange={(n) => setF({ ...f, min: n })} /></Field><Field label="Cap"><NumInput value={f.cap} onChange={(n) => setF({ ...f, cap: n })} /></Field></div>
        </>}
      </div>
    </Modal>
  );
}

export function RuleCentre() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [edit, setEdit] = useState<Rule | null>(null);
  const [add, setAdd] = useState(false);
  const [showHist, setShowHist] = useState<string | null>(null);
  const canEdit = me?.role === "ADMIN" || me?.role === "HEAD";

  const [eib, setEib] = useState({ date: todayISO(), d1: 4.18, w1: 4.3, m1: 4.38, m3: 4.47, m6: 4.53, y1: 4.6 });

  return (
    <div>
      <SectionHead title="Rule Centre" sub="Admin-controlled business rules. Every edit publishes a new version — calculators and saved results always state which version they used."
        right={<div className="flex items-center gap-2">
          <Pill tone="amber"><Ic n="alert" size={12} /> DBR / age rules TO VERIFY</Pill>
          {canEdit && <Btn onClick={() => setAdd(true)}><Ic n="plus" size={14} /> New rule</Btn>}
        </div>} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          {MODULES.map((mod, mi) => {
            const rules = state.rules.filter((r) => r.module === mod.m);
            if (!rules.length) return null;
            return (
              <div key={mod.m} className="anim-up bg-card border border-mist rounded-lg overflow-hidden" style={{ animationDelay: `${mi * 40}ms` }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-mist bg-paper/60">
                  <div><p className="font-display font-bold text-[13.5px] tracking-tight">{mod.l}</p><p className="text-[10.5px] text-ink-soft">{mod.d}</p></div>
                  <span className="num text-[11px] text-ink-soft">{rules.filter((r) => r.active).length} active</span>
                </div>
                <div>
                  {rules.map((r) => (
                    <div key={r.id} className={cx("px-4 py-2.5 border-b border-mist/60 last:border-0 transition-colors", !r.active && "opacity-45")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="num text-[11px] text-ink-soft w-28">{r.code}</span>
                        <span className="text-[12.5px] font-semibold flex-1 min-w-[140px]">{r.name}</span>
                        {scopeChips(r).map((c) => <span key={c} className="text-[10px] font-display font-semibold bg-ink/6 rounded px-1.5 py-0.5">{c}</span>)}
                        <span className={cx("num font-bold text-[15px] w-24 text-right", r.active ? "text-pine-700" : "")}>{valueLabel(r)}</span>
                        <button onClick={() => setShowHist(showHist === r.id ? null : r.id)} title="Version history"
                          className={cx("num text-[10.5px] rounded-full border px-2 py-0.5 font-semibold transition-colors", showHist === r.id ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft hover:border-ink/40")}>
                          v{r.version}{r.history.length > 0 && ` · ${r.history.length + 1}`}
                        </button>
                        {canEdit ? (
                          <div className="flex items-center gap-1.5">
                            <button className="p-1.5 rounded-md hover:bg-ink/8 text-ink-soft" onClick={() => setEdit(r)}><Ic n="pen" size={13} /></button>
                            <Toggle on={r.active} onChange={(v) => dispatch({ t: "UPSERT_RULE", rule: { ...r, active: v } })} />
                          </div>
                        ) : <Pill tone="gr">view</Pill>}
                      </div>
                      {r.note && <p className="text-[10.5px] text-ink-soft mt-1 ml-[7.5rem]">{r.note}</p>}
                      {showHist === r.id && (
                        <div className="ml-[7.5rem] mt-2 space-y-1 anim-tick">
                          {[...r.history].reverse().map((h) => (
                            <div key={h.version} className="flex items-center gap-2 text-[11px] num bg-paper/70 border border-mist rounded px-2 py-1">
                              <span className="font-semibold">v{h.version}</span><span className="text-ink-soft">{h.value}{r.kind === "pct" ? "%" : ""}</span>
                              <span className="text-ink-soft">effective {fmtDate(h.effectiveFrom)}</span>
                              <span className="ml-auto text-gr-500">archived</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-2 text-[11px] num bg-pine-50 border border-pine-200 rounded px-2 py-1">
                            <span className="font-semibold">v{r.version}</span><span>{r.value}{r.kind === "pct" ? "%" : ""}</span>
                            <span className="text-ink-soft">effective {fmtDate(r.effectiveFrom)}</span>
                            <span className="ml-auto text-pine-700 font-semibold">current</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* EIBOR master */}
        <div className="space-y-4">
          <div className="anim-up bg-ink text-paper rounded-lg p-4" style={{ animationDelay: "120ms" }}>
            <p className="font-display font-bold text-[14px] tracking-tight flex items-center gap-2"><Ic n="pulse" size={15} /> EIBOR master</p>
            <p className="text-[11px] text-paper/60 mt-0.5 mb-3">Daily publication · history retained · source recorded</p>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {[...state.eibor].reverse().map((x) => (
                <div key={x.date} className="flex items-center justify-between text-[11.5px] num border-b border-paper/10 pb-1">
                  <span className="text-paper/70">{fmtDate(x.date)}</span>
                  <span>{fmtN(x.m1, 3)}</span>
                  <span className="font-bold text-pine-300">{fmtN(x.m3, 3)}</span>
                  <span>{fmtN(x.m6, 3)}</span>
                  <span>{fmtN(x.y1, 3)}</span>
                </div>
              ))}
            </div>
            <p className="text-[9.5px] text-paper/40 mt-1.5 num">date · 1M · 3M · 6M · 1Y</p>
          </div>
          {canEdit && (
            <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "180ms" }}>
              <p className="font-display font-bold text-[13px] tracking-tight mb-3">Publish today's EIBOR</p>
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Date"><DateInput value={eib.date} onChange={(e) => setEib({ ...eib, date: e.target.value })} /></Field>
                <Field label="1M"><NumInput value={eib.m1} onChange={(n) => setEib({ ...eib, m1: n })} /></Field>
                <Field label="3M"><NumInput value={eib.m3} onChange={(n) => setEib({ ...eib, m3: n })} /></Field>
                <Field label="6M"><NumInput value={eib.m6} onChange={(n) => setEib({ ...eib, m6: n })} /></Field>
                <Field label="1Y"><NumInput value={eib.y1} onChange={(n) => setEib({ ...eib, y1: n })} /></Field>
                <Field label="O/N"><NumInput value={eib.d1} onChange={(n) => setEib({ ...eib, d1: n })} /></Field>
              </div>
              <Btn className="mt-3 w-full" variant="dark" onClick={() => dispatch({ t: "ADD_EIBOR", row: { ...eib, w1: eib.d1 + 0.12, source: "Central Bank UAE", updatedBy: me?.id ?? "" } })}><Ic n="plus" size={13} /> Add to master</Btn>
            </div>
          )}
          <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "220ms" }}>
            <p className="font-display font-bold text-[13px] tracking-tight mb-2">How the engine resolves a rule</p>
            <ol className="text-[11.5px] text-ink-soft space-y-1.5 list-decimal list-inside">
              <li>Collect active rules for the module.</li>
              <li>Score scope specificity — bank &gt; customer+employment &gt; generic.</li>
              <li>Most specific match wins (e.g. DIB exception beats the expat default).</li>
              <li>The winning version is stamped onto every saved calculation.</li>
            </ol>
          </div>
        </div>
      </div>

      {edit && <EditRule rule={edit} onClose={() => setEdit(null)} />}
      {add && <NewRule onClose={() => setAdd(false)} />}
    </div>
  );
}

/* ================= USERS ================= */
export function UsersView() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [add, setAdd] = useState(false);
  const canEdit = me?.role === "ADMIN";
  return (
    <div>
      <SectionHead title="Users & roles" sub="User → Role → Permission. The final permission matrix remains TO VERIFY with compliance."
        right={canEdit ? <Btn onClick={() => setAdd(true)}><Ic n="plus" size={14} /> New user</Btn> : <Pill tone="gr">view only</Pill>} />

      {/* org snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { team: "Management", icon: "shield", tone: "bg-ink text-paper" },
          { team: "Sales & Ops", icon: "layers", tone: "bg-pine-700 text-paper" },
          { team: "Ops Team (SPO)", icon: "clipboard", tone: "bg-steel-600 text-paper" },
          { team: "Sales Team (VRM)", icon: "funnel", tone: "bg-amber-600 text-paper" },
        ].map((t, i) => {
          const members = state.users.filter((u) => u.team === t.team);
          const leader = state.users.find((u) => u.team === t.team && members.some((m) => m.leaderId === u.id));
          return (
            <div key={t.team} className={cx("rounded-lg px-3.5 py-3 anim-up", t.tone)} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center justify-between">
                <p className="font-display font-bold text-[12.5px] tracking-tight">{t.team}</p>
                <Ic n={t.icon} size={15} />
              </div>
              <p className="num text-[22px] font-semibold leading-tight mt-1">{members.filter((m) => m.active).length}<span className="text-[11px] opacity-70 font-body font-normal"> active · {members.length} total</span></p>
              <p className="text-[10.5px] opacity-80 mt-0.5">{leader ? `Lead: ${leader.name}` : members.length ? members.map((m) => m.name.split(" ")[0]).slice(0, 3).join(", ") : "—"}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[13px] min-w-[840px]">
          <thead><tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/60">
            <th className="px-4 py-2.5 font-semibold">User</th><th className="px-3 py-2.5 font-semibold">Role</th><th className="px-3 py-2.5 font-semibold">Team</th><th className="px-3 py-2.5 font-semibold">Reports to</th><th className="px-3 py-2.5 font-semibold">Open tasks</th><th className="px-3 py-2.5 font-semibold">Cases</th><th className="px-3 py-2.5 font-semibold">Active</th>
          </tr></thead>
          <tbody>
            {state.users.map((u, i) => (
              <tr key={u.id} className={cx("border-b border-mist/60 last:border-0 anim-up", !u.active && "opacity-50")} style={{ animationDelay: `${i * 30}ms` }}>
                <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar name={u.name} size={30} /><div>
                  <p className="font-semibold flex items-center gap-1.5">{u.name}
                    {state.users.some((x) => x.leaderId === u.id) && <span className="text-[9px] font-display font-bold uppercase tracking-wide bg-amber-100 text-amber-700 rounded px-1 py-[1px]">TL</span>}
                  </p>
                  <p className="text-[11px] text-ink-soft num">{u.empId}{u.email ? ` · ${u.email}` : ""}</p>
                  {u.note && <p className="text-[10.5px] text-amber-700 font-medium">{u.note}</p>}
                </div></div></td>
                <td className="px-3 py-2.5"><Pill tone={u.role === "ADMIN" ? "ink" : u.role === "HEAD" ? "pine" : u.role === "TL" ? "pine" : u.role === "SPO" ? "steel" : u.role === "VRM" ? "amber" : "gr"}>{ROLE_LABEL[u.role]}</Pill></td>
                <td className="px-3 py-2.5 text-ink-soft">{u.team}</td>
                <td className="px-3 py-2.5 text-ink-soft">{u.leaderId ? state.users.find((x) => x.id === u.leaderId)?.name : "—"}</td>
                <td className="px-3 py-2.5 num">{state.tasks.filter((t) => t.ownerId === u.id && t.status === "OPEN").length}</td>
                <td className="px-3 py-2.5 num">{state.cases.filter((c) => c.ownerId === u.id && c.status === "OPEN").length}</td>
                <td className="px-3 py-2.5">{canEdit ? <Toggle on={u.active} onChange={(v) => dispatch({ t: "UPDATE_USER", id: u.id, patch: { active: v } })} /> : <Pill tone={u.active ? "pine" : "gr"}>{u.active ? "YES" : "NO"}</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 bg-card border border-mist rounded-lg p-4 anim-up">
        <p className="font-display font-bold text-[13px] tracking-tight mb-2">Permission matrix (draft — TO VERIFY)</p>
        <div className="overflow-x-auto">
          <table className="text-[11.5px] w-full">
            <thead><tr className="text-left text-ink-soft"><th className="py-1.5 pr-4 font-display uppercase text-[10px] tracking-wide">Module</th>{["SPO", "VRM", "TL", "HEAD", "ADMIN"].map((r) => <th key={r} className="py-1.5 px-3 font-display uppercase text-[10px] tracking-wide">{r}</th>)}</tr></thead>
            <tbody className="num">
              {[
                ["Case", "VIEW / EDIT", "VIEW LIMITED", "VIEW / EDIT / ASSIGN", "VIEW / ESCALATE", "FULL"],
                ["Lead", "VIEW", "VIEW / CREATE / EDIT", "VIEW / ASSIGN", "VIEW", "FULL"],
                ["Rules", "—", "—", "VIEW", "VIEW", "ADMIN"],
                ["Documents", "MARK STATUS", "—", "VERIFY", "VERIFY", "FULL"],
                ["Queries", "RESPOND", "—", "QC / CLOSE", "QC / CLOSE", "FULL"],
                ["Export", "—", "—", "EXPORT", "EXPORT", "EXPORT"],
              ].map((row) => (
                <tr key={row[0]} className="border-t border-mist/70">
                  <td className="py-1.5 pr-4 font-display font-semibold">{row[0]}</td>
                  {row.slice(1).map((v, i) => <td key={i} className={cx("py-1.5 px-3", v === "FULL" || v === "ADMIN" ? "font-semibold text-pine-700" : v === "—" ? "text-ink-soft/50" : "")}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {add && <AddUser onClose={() => setAdd(false)} />}
    </div>
  );
}

const TEAMS = ["Management", "Sales & Ops", "Ops Team (SPO)", "Sales Team (VRM)"];

function AddUser({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const nextId = (() => {
    const nums = state.users.map((u) => parseInt((u.empId.match(/hfmm-(\d+)/) ?? [])[1] ?? "0", 10)).filter((n) => !isNaN(n));
    return "hfmm-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, "0");
  })();
  const [f, setF] = useState({
    empId: nextId, name: "", email: "", mobile: "", role: "SPO" as User["role"],
    team: "Ops Team (SPO)", leaderId: state.users.find((u) => u.role === "TL")?.id ?? "", note: "",
  });
  const empTaken = state.users.some((u) => u.empId === f.empId.trim() || u.id === f.empId.trim());
  const valid = f.name.trim().length > 1 && f.empId.trim().length > 0 && !empTaken;
  return (
    <Modal open onClose={onClose} title="New user" width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!valid} onClick={() => {
          const empId = f.empId.trim();
          dispatch({
            t: "ADD_USER",
            user: {
              id: empId, empId, name: f.name.trim(),
              email: f.email.trim() || `${f.name.trim().split(" ")[0].toLowerCase()}@hfmc.ae`,
              mobile: f.mobile.trim(), role: f.role, team: f.team,
              leaderId: f.leaderId || undefined, active: true, createdAt: todayISO(),
              note: f.note.trim() || undefined,
            },
          });
          onClose();
        }}><Ic n="plus" size={14} /> Create user</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Employee ID" req hint={empTaken ? "This ID is already in use" : "Unique login / reference ID"}>
          <TextInput value={f.empId} onChange={(e) => setF({ ...f, empId: e.target.value })} className={empTaken ? "border-rust-500 text-rust-600" : ""} />
        </Field>
        <Field label="Designation" req><Select value={f.role} onChange={(v) => setF({ ...f, role: v as User["role"] })} options={Object.keys(ROLE_LABEL).map((r) => ({ v: r, l: ROLE_LABEL[r] }))} /></Field>
        <div className="col-span-2"><Field label="Full name" req><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Arjun Malhotra" /></Field></div>
        <Field label="Team"><Select value={f.team} onChange={(v) => setF({ ...f, team: v })} options={TEAMS.map((t) => ({ v: t, l: t }))} /></Field>
        <Field label="Reporting manager"><Select value={f.leaderId} onChange={(v) => setF({ ...f, leaderId: v })} options={[{ v: "", l: "—" }, ...state.users.filter((u) => u.active && u.id !== f.empId.trim()).map((u) => ({ v: u.id, l: `${u.name} (${u.empId})` }))]} /></Field>
        <Field label="Email"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="auto if empty" /></Field>
        <Field label="Mobile"><TextInput value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} placeholder="+971 …" /></Field>
        <div className="col-span-2"><Field label="Note (optional)"><TextInput value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. New joiner — designation to be confirmed" /></Field></div>
      </div>
      <p className="text-[11px] text-ink-soft mt-3">The Employee ID becomes the user's unique reference across tasks, cases, audit trail and escalations. Suggested next: <span className="num font-semibold text-pine-700">{nextId}</span>.</p>
    </Modal>
  );
}

/* ================= AUDIT ================= */
export function AuditView() {
  const { state } = useStore();
  const nav = useNav();
  const [mod, setMod] = useState("ALL");
  const [q, setQ] = useState("");
  const mods = useMemo(() => ["ALL", ...Array.from(new Set(state.audit.map((a) => a.module)))], [state.audit]);
  const list = state.audit.filter((a) => (mod === "ALL" || a.module === mod) && (a.target + a.action + (a.detail ?? "")).toLowerCase().includes(q.toLowerCase()));
  const user = (id: string) => state.users.find((u) => u.id === id)?.name ?? "system";
  return (
    <div>
      <SectionHead title="Audit trail" sub="WHO · WHAT · WHEN — stage changes, owner changes, rule versions, document marks, query closures, calculations."
        right={<div className="relative"><Ic n="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" /><TextInput className="pl-8 w-56" placeholder="Search audit…" value={q} onChange={(e) => setQ(e.target.value)} /></div>} />
      <div className="flex gap-1.5 mb-4 flex-wrap anim-up">
        {mods.map((m) => (
          <button key={m} onClick={() => setMod(m)} className={cx("px-3 py-1.5 rounded-full text-[12px] font-display font-semibold border transition-all focusable", mod === m ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft hover:border-ink/30")}>
            {m === "ALL" ? "All" : m}<span className="ml-1.5 num text-[10px] opacity-70">{m === "ALL" ? state.audit.length : state.audit.filter((a) => a.module === m).length}</span>
          </button>
        ))}
      </div>
      <div className="bg-card border border-mist rounded-lg overflow-hidden anim-up">
        {list.map((a, i) => (
          <div key={a.id} className={cx("flex items-center gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0 anim-up", i > 40 && "hidden")} style={{ animationDelay: `${Math.min(i, 15) * 20}ms` }}>
            <Avatar name={user(a.by)} size={26} />
            <Pill tone={a.module === "RULE" ? "amber" : a.module === "STAGE" ? "pine" : a.module === "QUERY" ? "steel" : a.module === "DOC" ? "pine" : a.module === "CALC" ? "gold" : "gr"}>{a.module}</Pill>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px]"><span className="font-semibold">{user(a.by)}</span> · {a.action} — <span className="font-medium">{a.target}</span></p>
              {a.detail && <p className="text-[11px] text-ink-soft">{a.detail}</p>}
            </div>
            {a.caseId && <button className="num text-[11px] font-semibold text-pine-700 hover:underline shrink-0" onClick={() => nav.go("cases", { caseId: a.caseId })}>{state.cases.find((c) => c.id === a.caseId)?.ref}</button>}
            <span className="num text-[10.5px] text-ink-soft shrink-0">{fmtTime(a.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
