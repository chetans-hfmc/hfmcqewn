import { useMemo, useState } from "react";
import type { Rule, RuleModule, User } from "../types";
import { ROLE_LABEL, useMe, useStore, isOversight } from "../store";
import { Avatar, Btn, DangerModal, Field, Ic, Modal, NumInput, Pill, Select, TextInput, cx, fmtDate, fmtTime, todayISO, uid } from "../ui";

const MODULES: { id: RuleModule | "ALL"; l: string }[] = [
  { id: "ALL", l: "All" }, { id: "LTV", l: "LTV" }, { id: "DBR", l: "DBR" }, { id: "RETIRE", l: "Retirement" },
  { id: "TENURE", l: "Tenure" }, { id: "CC", l: "Credit Card" }, { id: "STMT", l: "Statements" }, { id: "TAT", l: "TAT" }, { id: "FEE", l: "Fees" },
];

/* ---------- Rule Centre ---------- */
export function RuleCentre() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [mod, setMod] = useState<RuleModule | "ALL">("ALL");
  const [edit, setEdit] = useState<Rule | null>(null);
  const [val, setVal] = useState<number>(0);
  const isAdmin = me?.role === "ADMIN" || me?.role === "HEAD";

  const rows = state.rules.filter((r) => (mod === "ALL" ? true : r.module === mod));
  const openEdit = (r: Rule) => { setEdit(r); setVal(r.value); };
  const save = () => {
    if (!edit) return;
    const nv = edit.version + 1;
    dispatch({
      t: "UPSERT_RULE", rule: {
        ...edit, value: val, version: nv, effectiveFrom: todayISO(),
        history: [...edit.history, { version: nv, value: val, effectiveFrom: todayISO() }],
      },
    });
    setEdit(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 anim-up">
        {MODULES.map((m) => (
          <button key={m.id} onClick={() => setMod(m.id as RuleModule | "ALL")}
            className={cx("px-3.5 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", mod === m.id ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft hover:border-pine-600")}>
            {m.l}{m.id !== "ALL" && <span className="num text-[10px] opacity-70 ml-1">{state.rules.filter((r) => r.module === m.id).length}</span>}
          </button>
        ))}
      </div>

      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[12.5px] min-w-[720px]">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
            <th className="px-4 py-2.5 font-semibold">Rule</th><th className="px-3 py-2.5 font-semibold">Module</th>
            <th className="px-3 py-2.5 font-semibold">Scope</th><th className="px-3 py-2.5 font-semibold">Value</th>
            <th className="px-3 py-2.5 font-semibold">Version</th><th className="px-3 py-2.5 font-semibold">Status</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => isAdmin && openEdit(r)} className={cx("border-b border-mist/60 last:border-0 transition-colors", isAdmin && "hover:bg-pine-50/40 cursor-pointer")}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{r.name}</p>
                  <p className="num text-[10.5px] text-pine-700 font-semibold">{r.code}{r.note ? <span className="text-amber-700 ml-2 font-medium">· {r.note}</span> : null}</p>
                </td>
                <td className="px-3 py-3"><Pill tone="steel">{r.module}</Pill></td>
                <td className="px-3 py-3 text-[11px] text-ink-soft">
                  {r.scope.bankId ? state.banks.find((b) => b.id === r.scope.bankId)?.short : "all banks"}
                  {r.scope.customerType ? ` · ${r.scope.customerType.replace("_", " ")}` : ""}{r.scope.financeCount ? ` · ${r.scope.financeCount === 1 ? "1st" : "2nd+"}` : ""}
                </td>
                <td className="px-3 py-3 num font-bold">{r.value}{r.kind === "pct" ? "%" : r.kind === "months" ? " mo" : r.kind === "years" ? " yrs" : ""}</td>
                <td className="px-3 py-3 num">v{r.version}</td>
                <td className="px-3 py-3"><Pill tone={r.active ? "pine" : "gr"} dot>{r.active ? "active" : "inactive"}</Pill></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-soft">No rules in this module.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-soft anim-up">Editing a rule creates a new version with history — saved calculations keep the version they used. {isAdmin ? "Click a rule to edit." : "Read-only for your role."}</p>

      {edit && (
        <Modal open onClose={() => setEdit(null)} title={`Edit rule · ${edit.code}`} width={460}
          footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}><Ic n="check" size={13} /> Save as v{edit.version + 1}</Btn></>}>
          <div className="space-y-3">
            <p className="text-[12.5px] text-ink-soft">{edit.name} — currently <strong className="num">{edit.value}{edit.kind === "pct" ? "%" : ""}</strong> (v{edit.version}, effective {fmtDate(edit.effectiveFrom)}).</p>
            <Field label="New value" req><NumInput value={val} onChange={setVal} suffix={edit.kind === "pct" ? "%" : edit.kind === "months" ? "mo" : edit.kind === "years" ? "yrs" : undefined} /></Field>
            <div>
              <p className="text-[11px] uppercase tracking-[0.09em] font-display font-bold text-ink-soft mb-1.5">Version history</p>
              {edit.history.map((h) => (
                <div key={h.version} className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px]">
                  <span className="num font-semibold">v{h.version}</span><span className="num">{h.value}{edit.kind === "pct" ? "%" : ""}</span><span className="text-ink-soft num">{fmtDate(h.effectiveFrom)}</span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Users & Roles ---------- */
export function UsersView() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const isAdmin = me?.role === "ADMIN";
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: "", empId: "", role: "SPO" as User["role"], team: "Ops Team (SPO)", note: "" });

  const nextId = () => {
    let n = state.users.length;
    let id = `hfmm-${String(n).padStart(2, "0")}`;
    while (state.users.some((u) => u.empId === id)) { n++; id = `hfmm-${String(n).padStart(2, "0")}`; }
    return id;
  };
  const create = () => {
    const empId = f.empId.trim() || nextId();
    if (state.users.some((u) => u.empId === empId)) return;
    dispatch({
      t: "ADD_USER", user: {
        id: empId, empId, name: f.name.trim(), email: "", mobile: "", role: f.role, team: f.team,
        leaderId: f.role === "SPO" ? "hfmm-01" : f.role === "VRM" ? "hfmm-12" : f.role === "TL" ? "hfmm-14" : undefined,
        active: true, createdAt: todayISO(), note: f.note || undefined,
      },
    });
    setAdd(false); setF({ name: "", empId: "", role: "SPO", team: "Ops Team (SPO)", note: "" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 anim-up">
        {["Management", "Sales & Ops", "Ops Team (SPO)", "Sales Team (VRM)"].map((t, i) => {
          const members = state.users.filter((u) => u.team === t);
          return (
            <div key={t} className={cx("rounded-lg px-3.5 py-3 text-paper anim-up", i === 0 ? "bg-ink" : i === 1 ? "bg-pine-700" : i === 2 ? "bg-steel-600" : "bg-amber-600")} style={{ animationDelay: `${i * 50}ms` }}>
              <p className="font-display font-bold text-[12.5px] tracking-tight">{t}</p>
              <p className="num text-[22px] font-semibold leading-tight mt-1">{members.filter((m) => m.active).length}<span className="text-[11px] opacity-70 font-normal"> active</span></p>
            </div>
          );
        })}
      </div>

      {isAdmin && <Btn onClick={() => setAdd(true)}><Ic n="plus" size={14} /> New user</Btn>}

      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[12.5px] min-w-[700px]">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
            <th className="px-4 py-2.5 font-semibold">User</th><th className="px-3 py-2.5 font-semibold">Role</th>
            <th className="px-3 py-2.5 font-semibold">Team</th><th className="px-3 py-2.5 font-semibold">Reports to</th><th className="px-3 py-2.5 font-semibold text-right">Active</th>
          </tr></thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id} className="border-b border-mist/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size={30} />
                    <div>
                      <p className="font-semibold flex items-center gap-1.5">{u.name}
                        {state.users.some((x) => x.leaderId === u.id) && <span className="text-[9px] font-display font-bold uppercase bg-amber-100 text-amber-700 rounded px-1 py-[1px]">TL</span>}
                      </p>
                      <p className="num text-[10.5px] text-ink-soft">{u.empId}{u.note ? <span className="text-amber-700 ml-1.5">{u.note}</span> : null}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3"><Pill tone={u.role === "ADMIN" ? "ink" : u.role === "HEAD" || u.role === "TL" ? "pine" : u.role === "SPO" ? "steel" : u.role === "VRM" ? "amber" : "gr"}>{ROLE_LABEL[u.role]}</Pill></td>
                <td className="px-3 py-3 text-[12px]">{u.team}</td>
                <td className="px-3 py-3 text-[12px]">{u.leaderId ? state.users.find((x) => x.id === u.leaderId)?.name : "—"}</td>
                <td className="px-3 py-3 text-right">
                  {isAdmin && u.role !== "ADMIN" ? (
                    <button onClick={() => dispatch({ t: "UPDATE_USER", id: u.id, patch: { active: !u.active } })}
                      className={cx("px-2.5 py-1 rounded-full border text-[10.5px] font-display font-bold transition-all", u.active ? "border-pine-500 text-pine-700 hover:bg-pine-50" : "border-mist text-ink-soft")}>{u.active ? "active" : "inactive"}</button>
                  ) : <Pill tone={u.active ? "pine" : "gr"}>{u.active ? "active" : "inactive"}</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {add && (
        <Modal open onClose={() => setAdd(false)} title="New user" width={460}
          footer={<><Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn><Btn disabled={f.name.trim().length < 2} onClick={create}><Ic n="check" size={13} /> Create user</Btn></>}>
          <div className="space-y-3">
            <Field label="Full name" req><TextInput autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Employee ID" hint="Unique — leave blank to auto-assign the next free hfmm-NN."><TextInput value={f.empId} onChange={(e) => setF({ ...f, empId: e.target.value })} placeholder={nextId()} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role"><Select value={f.role} onChange={(v) => setF({ ...f, role: v as User["role"] })} options={Object.keys(ROLE_LABEL).map((k) => ({ v: k, l: ROLE_LABEL[k] }))} /></Field>
              <Field label="Team"><Select value={f.team} onChange={(v) => setF({ ...f, team: v })} options={["Management", "Sales & Ops", "Ops Team (SPO)", "Sales Team (VRM)"].map((t) => ({ v: t, l: t }))} /></Field>
            </div>
            <Field label="Note"><TextInput value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="optional" /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Audit Trail ---------- */
export function AuditView() {
  const { state } = useStore();
  const [mod, setMod] = useState("ALL");
  const mods = useMemo(() => ["ALL", ...Array.from(new Set(state.audit.map((a) => a.module)))], [state.audit]);
  const rows = state.audit.filter((a) => (mod === "ALL" ? true : a.module === mod)).slice(0, 80);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 anim-up">
        {mods.map((m) => (
          <button key={m} onClick={() => setMod(m)} className={cx("px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", mod === m ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft hover:border-pine-600")}>{m}</button>
        ))}
      </div>
      <div className="bg-card border border-mist rounded-lg overflow-hidden anim-up">
        {rows.map((a) => (
          <div key={a.id} className="flex gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0">
            <span className="num text-[10.5px] text-ink-soft shrink-0 w-[120px] pt-0.5">{fmtTime(a.at)}</span>
            <Pill tone={a.module === "CASE" ? "pine" : a.module === "RULE" || a.module === "PRODUCT" ? "steel" : a.module === "AUTH" ? "ink" : "gr"} className="shrink-0 self-start">{a.module}</Pill>
            <p className="flex-1 text-[12.5px]"><strong>{a.action}</strong> — {a.target}{a.detail ? <span className="text-ink-soft"> · {a.detail}</span> : null} <span className="text-ink-soft num text-[10.5px]">by {state.users.find((u) => u.id === a.by)?.name ?? a.by}</span></p>
          </div>
        ))}
        {rows.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-ink-soft">No audit entries for this module.</p>}
      </div>
    </div>
  );
}
