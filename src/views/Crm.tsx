import { useMemo, useState } from "react";
import type { Case, CustomerType, Employment, Lead, LeadStatus, Person, Task, TxType } from "../types";
import { isOversight, useMe, useNav, useStore } from "../store";
import { Avatar, Btn, DateInput, DangerModal, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, Select, TextInput, addDays, ageYears, cx, fmtAED, fmtDate, nowISO, todayISO, uid } from "../ui";

const CT: { v: CustomerType; l: string }[] = [{ v: "NATIONAL", l: "UAE National" }, { v: "EXPAT", l: "Expat" }, { v: "NON_RESIDENT", l: "Non-Resident" }];
const EMP: { v: Employment; l: string }[] = [{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self Employed" }];
const TX: { v: TxType; l: string }[] = [{ v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Equity Release" }];

/* ---------- People ---------- */
export function PeopleView() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Person | null>(null);
  const [add, setAdd] = useState(false);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return state.persons.filter((p) => !n || [p.name, p.nationality, p.employer ?? "", p.mobile].join(" ").toLowerCase().includes(n));
  }, [state.persons, q]);
  return (
    <div className="space-y-4">
      <div className="anim-up flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"><Ic n="search" size={14} /></span>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="pl-8 w-[260px]" />
        </div>
        <span className="text-[11.5px] text-ink-soft num ml-1">{filtered.length} people</span>
        <Btn className="ml-auto" onClick={() => setAdd(true)}><Ic n="plus" size={14} /> New person</Btn>
      </div>
      <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto" style={{ animationDelay: "80ms" }}>
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">Person</th>
              <th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 font-semibold">Employment</th>
              <th className="px-3 py-2.5 font-semibold">Age</th>
              <th className="px-3 py-2.5 font-semibold">Monthly income</th>
              <th className="px-3 py-2.5 font-semibold">Open cases</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const cases = state.cases.filter((c) => c.personId === p.id && c.status === "OPEN").length;
              return (
                <tr key={p.id} onClick={() => setSel(p)} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={p.name} size={28} /><div><p className="font-semibold">{p.name}</p><p className="text-[10.5px] text-ink-soft num">{p.nationality} · {p.mobile}</p></div></div></td>
                  <td className="px-3 py-3"><Pill tone={p.customerType === "NATIONAL" ? "pine" : p.customerType === "EXPAT" ? "steel" : "amber"}>{CT.find((c) => c.v === p.customerType)?.l}</Pill></td>
                  <td className="px-3 py-3">{p.employment === "SALARIED" ? "Salaried" : "Self Employed"}</td>
                  <td className="px-3 py-3 num">{p.dob ? ageYears(p.dob) : "—"}</td>
                  <td className="px-3 py-3 num font-semibold">{fmtAED(p.monthlySalary + p.otherIncome)}</td>
                  <td className="px-3 py-3"><span className="num font-bold text-pine-700">{cases}</span></td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={6}><EmptyState icon="users" title="No people match" /></td></tr>}
          </tbody>
        </table>
      </div>
      {sel && <PersonDrawer p={sel} onClose={() => setSel(null)} />}
      {add && <PersonForm onClose={() => setAdd(false)} />}
    </div>
  );
}

function PersonDrawer({ p, onClose }: { p: Person; onClose: () => void }) {
  const { state } = useStore();
  const nav = useNav();
  const me = useMe()!;
  const [del, setDel] = useState(false);
  const cases = state.cases.filter((c) => c.personId === p.id);
  const leads = state.leads.filter((l) => l.personId === p.id);
  const canDelete = isOversight(me.role) && cases.length === 0 && leads.length === 0;
  return (
    <Drawer open onClose={onClose} title={p.name} width={460}>
      <div className="space-y-4">
        <div className="bg-paper/60 border border-mist rounded-lg p-3.5">
          <KV k="Customer type" v={CT.find((c) => c.v === p.customerType)?.l ?? p.customerType} mono={false} />
          <KV k="Nationality" v={p.nationality} mono={false} />
          <KV k="Date of birth" v={p.dob ? `${fmtDate(p.dob)} (${ageYears(p.dob)} yrs)` : "—"} mono={false} />
          <KV k="Mobile" v={p.mobile || "—"} mono={false} />
          <KV k="Email" v={p.email || "—"} mono={false} />
          <KV k="Employer" v={p.employer ?? "—"} mono={false} />
          <KV k="Employment" v={p.employment === "SALARIED" ? "Salaried" : "Self Employed"} mono={false} />
        </div>
        <div className="bg-paper/60 border border-mist rounded-lg p-3.5">
          <KV k="Monthly salary" v={fmtAED(p.monthlySalary)} />
          <KV k="Other income" v={fmtAED(p.otherIncome)} />
          <KV k="Existing liabilities" v={`${fmtAED(p.liabilities.reduce((s, l) => s + l.monthly, 0))}/mo`} />
          <KV k="Credit card limits" v={fmtAED(p.cards.reduce((s, c) => s + c.limit, 0))} />
          <KV k="Finance count" v={p.financeCount === 1 ? "1st property" : "2nd+"} mono={false} />
        </div>
        {cases.length > 0 && (
          <div>
            <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Cases ({cases.length})</p>
            {cases.map((c) => (
              <button key={c.id} onClick={() => { nav.go("cases", { caseId: c.id }); onClose(); }}
                className="focusable w-full flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 mb-1.5 hover:border-pine-600 transition-colors text-left">
                <span className="num text-[10.5px] font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5">{c.ref}</span>
                <span className="flex-1 text-[12px]">{state.stages.find((s) => s.id === c.stage)?.name}</span>
                <Pill tone={c.status === "CLOSED" ? "gr" : "pine"}>{c.status}</Pill>
              </button>
            ))}
          </div>
        )}
        {leads.length > 0 && (
          <div>
            <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Leads ({leads.length})</p>
            {leads.map((l) => (
              <div key={l.id} className="flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 mb-1.5">
                <span className="num text-[10.5px] font-bold text-steel-700 bg-steel-100 rounded px-1.5 py-0.5">{l.ref}</span>
                <span className="flex-1 text-[12px]">{l.source}</span>
                <Pill tone={l.status === "CONVERTED" ? "pine" : "amber"}>{l.status}</Pill>
              </div>
            ))}
          </div>
        )}
        {isOversight(me.role) && (
          <div className="border-t border-mist pt-3">
            <Btn variant="outline" size="sm" disabled={!canDelete} onClick={() => setDel(true)} title={canDelete ? "" : "Only deletable when no cases or leads are linked"}>
              <Ic n="trash" size={13} /> Delete person
            </Btn>
          </div>
        )}
      </div>
      {del && <DangerModal open onClose={() => setDel(false)} title="Delete person" target={p.name}
        warn="This removes the person record. It is only allowed when no cases or leads are linked."
        onConfirm={(reason) => { useStoreDeletePerson(p.id, reason); onClose(); }} />}
    </Drawer>
  );
}
/* tiny indirection so the drawer can dispatch without re-reading context oddly */
function useStoreDeletePerson(id: string, reason: string) {
  const { dispatch } = useStore();
  dispatch({ t: "DELETE_PERSON", id, reason });
}

function PersonForm({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const [f, setF] = useState({ name: "", customerType: "EXPAT" as CustomerType, nationality: "", employment: "SALARIED" as Employment, dob: "", mobile: "", email: "", employer: "", monthlySalary: 0, otherIncome: 0, financeCount: 1 as 1 | 2 });
  return (
    <Modal open onClose={onClose} title="New person" width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={f.name.trim().length < 2} onClick={() => {
          dispatch({ t: "ADD_PERSON", person: { id: "p" + uid(), ...f, cards: [], liabilities: [], createdAt: todayISO() } }); onClose();
        }}>Create person</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Full name" req><TextInput autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
        <Field label="Customer type"><Select value={f.customerType} onChange={(v) => setF({ ...f, customerType: v as CustomerType })} options={CT} /></Field>
        <Field label="Nationality"><TextInput value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} /></Field>
        <Field label="Employment"><Select value={f.employment} onChange={(v) => setF({ ...f, employment: v as Employment })} options={EMP} /></Field>
        <Field label="Date of birth"><DateInput value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="Mobile"><TextInput value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></Field>
        <Field label="Email"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Employer"><TextInput value={f.employer} onChange={(e) => setF({ ...f, employer: e.target.value })} /></Field>
        <Field label="Finance count"><Select value={String(f.financeCount)} onChange={(v) => setF({ ...f, financeCount: v === "2" ? 2 : 1 })} options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd or more" }]} /></Field>
        <Field label="Monthly salary"><NumInput value={f.monthlySalary} onChange={(n) => setF({ ...f, monthlySalary: n })} suffix="AED" /></Field>
        <Field label="Other income"><NumInput value={f.otherIncome} onChange={(n) => setF({ ...f, otherIncome: n })} suffix="AED" /></Field>
      </div>
    </Modal>
  );
}

/* ---------- Leads ---------- */
export function LeadsView() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [filter, setFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [create, setCreate] = useState(() => nav.params.create === true);
  const [convert, setConvert] = useState<Lead | null>(null);
  const [del, setDel] = useState<Lead | null>(null);

  const scoped = state.leads.filter((l) => isOversight(me.role) || l.owner === me.id);
  const filtered = scoped.filter((l) => (filter === "ALL" ? true : l.status === filter));
  const statuses: (LeadStatus | "ALL")[] = ["ALL", "NEW", "CONTACTED", "APPOINTMENT", "QUALIFIED", "PROPOSAL", "CONVERTED", "LOST"];

  return (
    <div className="space-y-4">
      <div className="anim-up flex flex-wrap items-center gap-2">
        {statuses.map((s) => {
          const n = s === "ALL" ? scoped.length : scoped.filter((l) => l.status === s).length;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={cx("focusable px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all",
                filter === s ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft hover:border-ink/40")}>
              {s === "ALL" ? "All" : s.toLowerCase()} <span className="num opacity-70">{n}</span>
            </button>
          );
        })}
        <Btn className="ml-auto" onClick={() => setCreate(true)}><Ic n="plus" size={14} /> New lead</Btn>
      </div>

      <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto" style={{ animationDelay: "80ms" }}>
        <table className="w-full text-[12.5px] min-w-[820px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">Lead</th>
              <th className="px-3 py-2.5 font-semibold">Client</th>
              <th className="px-3 py-2.5 font-semibold">Source</th>
              <th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 font-semibold">Property value</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Owner</th>
              <th className="px-3 py-2.5 font-semibold">Next due</th>
              <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const person = state.persons.find((p) => p.id === l.personId);
              return (
                <tr key={l.id} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/40 transition-colors">
                  <td className="px-4 py-3"><span className="num text-[11px] font-bold text-steel-700 bg-steel-100 rounded px-1.5 py-0.5">{l.ref}</span></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar name={person?.name ?? "?"} size={24} /><span className="font-semibold">{person?.name}</span></div></td>
                  <td className="px-3 py-3 text-[11.5px]">{l.source}</td>
                  <td className="px-3 py-3 text-[11.5px]">{TX.find((t) => t.v === l.type)?.l}</td>
                  <td className="px-3 py-3 num font-semibold">{l.propertyValue ? fmtAED(l.propertyValue) : "—"}</td>
                  <td className="px-3 py-3">
                    <Select value={l.status} onChange={(v) => dispatch({ t: "UPDATE_LEAD", id: l.id, patch: { status: v as LeadStatus } })} className="w-[130px] h-[30px] text-[12px]"
                      options={statuses.filter((s) => s !== "ALL").map((s) => ({ v: s, l: s }))} />
                  </td>
                  <td className="px-3 py-3 text-[11.5px]">{state.users.find((u) => u.id === l.owner)?.name?.split(" ")[0]}</td>
                  <td className="px-3 py-3">{l.status !== "CONVERTED" && l.status !== "LOST" ? <DueChip iso={l.due} /> : <span className="text-[11px] text-ink-soft">—</span>}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      {l.status !== "CONVERTED" && l.status !== "LOST" && (<>
                        <button title="Run affordability" onClick={() => nav.go("decision", { params: { personId: l.personId, propertyValue: l.propertyValue } })}
                          className="focusable p-1.5 rounded-md hover:bg-pine-100 text-pine-700 transition-colors"><Ic n="calc" size={15} /></button>
                        <button title="Convert to case" onClick={() => setConvert(l)}
                          className="focusable p-1.5 rounded-md hover:bg-ink/8 text-ink transition-colors"><Ic n="arrowR" size={15} /></button>
                      </>)}
                      {l.status === "CONVERTED" && <Pill tone="ink">Converted</Pill>}
                      {isOversight(me.role) && l.status !== "CONVERTED" && (
                        <button title="Delete lead" onClick={() => setDel(l)} className="focusable p-1.5 rounded-md hover:bg-rust-100 text-rust-600 transition-colors"><Ic n="trash" size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={9}><EmptyState icon="funnel" title="No leads here" sub="Create a lead to start the pipeline." /></td></tr>}
          </tbody>
        </table>
      </div>

      {create && <LeadForm onClose={() => setCreate(false)} />}
      {convert && <ConvertModal lead={convert} onClose={() => setConvert(null)} />}
      {del && <DangerModal open onClose={() => setDel(null)} title="Delete lead" target={del.ref}
        warn="Converted leads cannot be deleted — they are part of a live case's golden record."
        onConfirm={(reason) => { dispatch({ t: "DELETE_LEAD", id: del.id, reason }); setDel(null); }} />}
    </div>
  );
}

function LeadForm({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ personId: state.persons[0]?.id ?? "", source: state.leadSources[0], type: "PURCHASE" as TxType, bankId: "", propertyValue: 0, owner: me?.id ?? "", nextAction: "First contact call", due: addDays(todayISO(), 2) });
  const ref = "L-" + (1000 + state.leads.length + 1);
  return (
    <Modal open onClose={onClose} title={`New lead · ${ref}`} width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.personId} onClick={() => {
          dispatch({ t: "ADD_LEAD", lead: { id: "l" + uid(), ref, personId: f.personId, source: f.source, type: f.type, status: "NEW", owner: f.owner, bankId: f.bankId || undefined, propertyValue: f.propertyValue || undefined, nextAction: f.nextAction, due: f.due, createdAt: todayISO() } });
          onClose();
        }}>Create lead</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Client" req><Select value={f.personId} onChange={(v) => setF({ ...f, personId: v })} options={state.persons.map((p) => ({ v: p.id, l: p.name }))} /></Field>
        <Field label="Source"><Select value={f.source} onChange={(v) => setF({ ...f, source: v })} options={state.leadSources.map((s) => ({ v: s, l: s }))} /></Field>
        <Field label="Transaction type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v as TxType })} options={TX} /></Field>
        <Field label="Preferred bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={[{ v: "", l: "Not decided" }, ...state.banks.map((b) => ({ v: b.id, l: b.name }))]} /></Field>
        <Field label="Property value"><NumInput value={f.propertyValue} onChange={(n) => setF({ ...f, propertyValue: n })} suffix="AED" /></Field>
        <Field label="Owner (VRM)"><Select value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Next action"><TextInput value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} /></Field>
        <Field label="Due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ConvertModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const person = state.persons.find((p) => p.id === lead.personId);
  const [f, setF] = useState({ bankId: lead.bankId ?? state.banks[0].id, propertyValue: lead.propertyValue ?? 1500000, loanAmount: Math.floor((lead.propertyValue ?? 1500000) * 0.8), ownerId: me?.id ?? "" });
  const ref = "HF-" + (3000 + state.cases.length + 1);
  const convert = () => {
    const first = state.stages[0];
    const caze: Case = {
      id: "c" + uid(), ref, personId: lead.personId, ownerId: f.ownerId || me?.id || "",
      bankId: f.bankId, txType: lead.type, propertyValue: f.propertyValue, loanAmount: f.loanAmount,
      rate: 4.25, tenureMonths: 300, stage: first.id, status: "OPEN", expectedRevenue: Math.round(f.loanAmount * 0.011),
      stageHistory: [{ stageId: first.id, at: nowISO(), by: me?.id ?? "" }],
      triggerDates: { [first.id]: todayISO() }, conditionsDone: {}, docs: [], createdAt: todayISO(),
      nextAction: first.tasks[0], nextActionDue: addDays(todayISO(), first.sla),
    };
    const tasks: Task[] = first.tasks.map((title, i) => ({
      id: "t" + uid() + i, caseId: caze.id, stageId: first.id, title, ownerId: caze.ownerId,
      priority: i === 0 ? "HIGH" : "MEDIUM", due: addDays(todayISO(), i + 1), status: "OPEN", createdAt: nowISO(),
    }));
    dispatch({ t: "CONVERT_LEAD", leadId: lead.id, caze, tasks });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Convert ${lead.ref} → ${ref}`} width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={convert}><Ic n="arrowR" size={14} /> Create case</Btn></>}>
      <div className="space-y-4">
        <p className="text-[12.5px] text-ink-soft">Opens a golden record at <strong>{state.stages[0].name}</strong> and generates the stage's tasks. The lead is marked converted.</p>
        <p className="text-[13px] font-semibold flex items-center gap-2"><Avatar name={person?.name ?? "?"} size={22} /> {person?.name}</p>
        <Field label="Bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={state.banks.map((b) => ({ v: b.id, l: b.name }))} /></Field>
        <Field label="Property value"><NumInput value={f.propertyValue} onChange={(n) => setF({ ...f, propertyValue: n })} suffix="AED" /></Field>
        <Field label="Loan amount"><NumInput value={f.loanAmount} onChange={(n) => setF({ ...f, loanAmount: n })} suffix="AED" /></Field>
        <Field label="Case owner"><Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={state.users.filter((u) => u.active && ["SPO", "TL", "HEAD", "ADMIN"].includes(u.role)).map((u) => ({ v: u.id, l: `${u.name} — ${u.role}` }))} /></Field>
      </div>
    </Modal>
  );
}
