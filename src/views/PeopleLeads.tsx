import { useMemo, useState } from "react";
import type { CustomerType, Employment, Lead, LeadStatus, Person, Task, TxType } from "../types";
import { useMe, useNav, useStore } from "../store";
import { Avatar, Btn, DateInput, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, SectionHead, Select, TextInput, addDays, cx, fmtAED, fmtDate, nowISO, todayISO, uid, ageYears } from "../ui";

const CT: { v: CustomerType; l: string }[] = [
  { v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" },
];
const EMP: { v: Employment; l: string }[] = [
  { v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self-Employed" },
];
const TX: { v: TxType; l: string }[] = [
  { v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Pure Equity" },
];
const LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "APPOINTMENT", "QUALIFIED", "PROPOSAL", "CONVERTED", "LOST"];
const statusTone: Record<LeadStatus, string> = {
  NEW: "steel", CONTACTED: "steel", APPOINTMENT: "amber", QUALIFIED: "pine", PROPOSAL: "gold", CONVERTED: "ink", LOST: "gr",
};

function PersonForm({ onSave, onClose, existing }: { onSave: (p: Person) => void; onClose: () => void; existing?: Person }) {
  const [f, setF] = useState({
    name: existing?.name ?? "", customerType: existing?.customerType ?? ("EXPAT" as CustomerType), nationality: existing?.nationality ?? "",
    employment: existing?.employment ?? ("SALARIED" as Employment), dob: existing?.dob ?? "1992-01-01", mobile: existing?.mobile ?? "",
    email: existing?.email ?? "", employer: existing?.employer ?? "", monthlySalary: existing?.monthlySalary ?? 0,
    otherIncome: existing?.otherIncome ?? 0, financeCount: existing?.financeCount ?? (1 as 1 | 2),
  });
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim().length > 1;
  return (
    <Modal open onClose={onClose} title={existing ? `Edit · ${existing.name}` : "New person"} width={620}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!valid} onClick={() => onSave({
          id: existing?.id ?? "p" + uid(), name: f.name.trim(), customerType: f.customerType, nationality: f.nationality || "—",
          employment: f.employment, dob: f.dob, mobile: f.mobile, email: f.email, employer: f.employer,
          monthlySalary: f.monthlySalary, otherIncome: f.otherIncome, financeCount: f.financeCount,
          cards: existing?.cards ?? [], liabilities: existing?.liabilities ?? [],
          kyc: existing?.kyc ?? { passport: false, eid: false, visa: false, address: false },
          createdAt: existing?.createdAt ?? todayISO(),
        })}>{existing ? "Save changes" : "Create person"}</Btn>
      </>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Full name" req><TextInput value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Arjun Malhotra" /></Field></div>
        <Field label="Customer type"><Select value={f.customerType} onChange={(v) => set("customerType", v)} options={CT.map((c) => ({ v: c.v, l: c.l }))} /></Field>
        <Field label="Nationality"><TextInput value={f.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. India" /></Field>
        <Field label="Employment"><Select value={f.employment} onChange={(v) => set("employment", v)} options={EMP.map((c) => ({ v: c.v, l: c.l }))} /></Field>
        <Field label="Date of birth"><DateInput value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
        <Field label="Mobile"><TextInput value={f.mobile} onChange={(e) => set("mobile", e.target.value)} /></Field>
        <Field label="Email"><TextInput value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Employer"><TextInput value={f.employer} onChange={(e) => set("employer", e.target.value)} /></Field>
        <Field label="Property finance count"><Select value={String(f.financeCount)} onChange={(v) => set("financeCount", Number(v) as 1 | 2)} options={[{ v: "1", l: "1st property finance" }, { v: "2", l: "2nd or more" }]} /></Field>
        <Field label="Monthly salary"><NumInput value={f.monthlySalary} onChange={(n) => set("monthlySalary", n)} suffix="AED" /></Field>
        <Field label="Other monthly income"><NumInput value={f.otherIncome} onChange={(n) => set("otherIncome", n)} suffix="AED" /></Field>
      </div>
    </Modal>
  );
}

export function PeopleView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<null | { existing?: Person }>(null);
  const [sel, setSel] = useState<string | null>(null);

  const list = state.persons.filter((p) => (p.name + p.nationality + p.email).toLowerCase().includes(q.toLowerCase()));
  const person = state.persons.find((p) => p.id === sel);

  return (
    <div>
      <SectionHead title="People" sub="One golden person record — KYC, income, liabilities and every case linked to it."
        right={<div className="flex gap-2">
          <div className="relative"><Ic n="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" /><TextInput className="pl-8 w-56" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Btn onClick={() => setForm({})}><Ic n="plus" size={14} /> New person</Btn>
        </div>} />
      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[13px] min-w-[860px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/60">
              <th className="px-4 py-2.5 font-semibold">Person</th><th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 font-semibold">Age</th><th className="px-3 py-2.5 font-semibold">Monthly income</th>
              <th className="px-3 py-2.5 font-semibold">Cards / Liabilities</th><th className="px-3 py-2.5 font-semibold">KYC</th>
              <th className="px-3 py-2.5 font-semibold">Cases</th><th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => {
              const kycN = Object.values(p.kyc).filter(Boolean).length;
              const cases = state.cases.filter((c) => c.personId === p.id);
              return (
                <tr key={p.id} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/50 cursor-pointer transition-colors anim-up" style={{ animationDelay: `${i * 30}ms` }} onClick={() => setSel(p.id)}>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar name={p.name} size={30} /><div><p className="font-semibold">{p.name}</p><p className="text-[11px] text-ink-soft">{p.nationality} · {p.employment === "SALARIED" ? "Salaried" : "Self-employed"}</p></div></div></td>
                  <td className="px-3 py-2.5"><Pill tone={p.customerType === "NATIONAL" ? "pine" : p.customerType === "EXPAT" ? "steel" : "amber"}>{CT.find((c) => c.v === p.customerType)?.l}</Pill></td>
                  <td className="px-3 py-2.5 num">{p.dob ? ageYears(p.dob) : "—"}</td>
                  <td className="px-3 py-2.5 num">{p.monthlySalary + p.otherIncome ? fmtAED(p.monthlySalary + p.otherIncome) : <span className="text-ink-soft/60 not-italic text-[11px]">to profile</span>}</td>
                  <td className="px-3 py-2.5 num text-ink-soft">{p.cards.length} cards · {fmtAED(p.liabilities.reduce((s, l) => s + l.monthly, 0))}/m</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-1.5 bg-ink/10 rounded-full overflow-hidden"><div className={cx("h-full rounded-full", kycN === 4 ? "bg-pine-500" : "bg-amber-500")} style={{ width: `${(kycN / 4) * 100}%` }} /></div>
                      <span className="num text-[11px] text-ink-soft">{kycN}/4</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 num">{cases.length || "—"}</td>
                  <td className="px-3 py-2.5"><button className="p-1.5 rounded-md hover:bg-ink/8 text-ink-soft" onClick={(e) => { e.stopPropagation(); setForm({ existing: p }); }}><Ic n="pen" size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState title="No people match" sub="Try a different search or create a new person." />}
      </div>

      {form && <PersonForm existing={form.existing} onClose={() => setForm(null)}
        onSave={(p) => { dispatch({ t: form.existing ? "UPDATE_PERSON" : "ADD_PERSON", ...(form.existing ? { id: p.id, patch: p } : { person: p }) } as never); setForm(null); }} />}

      <Drawer open={!!person} onClose={() => setSel(null)} width={520}
        title={person ? <span className="flex items-center gap-2"><Avatar name={person.name} size={26} />{person.name}</span> : ""}
        footer={person && <>
          <Btn variant="outline" onClick={() => nav.go("calculators", { params: { calc: "affordability", personId: person.id } })}><Ic n="calc" size={14} /> Run affordability</Btn>
          <Btn variant="ghost" onClick={() => setForm({ existing: person })}><Ic n="pen" size={14} /> Edit</Btn>
        </>}>
        {person && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-1.5">
              <Pill tone={person.customerType === "NATIONAL" ? "pine" : person.customerType === "EXPAT" ? "steel" : "amber"}>{CT.find((c) => c.v === person.customerType)?.l}</Pill>
              <Pill tone="gr">{EMP.find((c) => c.v === person.employment)?.l}</Pill>
              <Pill tone="gr">Age {ageYears(person.dob)}</Pill>
              <Pill tone="gr">{person.financeCount === 1 ? "1st finance" : "2nd+ finance"}</Pill>
            </div>
            <div>
              <h4 className="text-[11px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft mb-1.5">Profile</h4>
              <KV k="Nationality" v={person.nationality} mono={false} />
              <KV k="DOB" v={fmtDate(person.dob)} mono={false} />
              <KV k="Mobile" v={person.mobile || "—"} mono={false} />
              <KV k="Email" v={person.email || "—"} mono={false} />
              <KV k="Employer" v={person.employer || "—"} mono={false} />
              <KV k="Monthly salary" v={person.monthlySalary ? fmtAED(person.monthlySalary) : "—"} />
              <KV k="Other income" v={fmtAED(person.otherIncome)} />
            </div>
            <div>
              <h4 className="text-[11px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft mb-1.5">KYC checklist</h4>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(person.kyc) as (keyof Person["kyc"])[]).map((k) => (
                  <button key={k} onClick={() => dispatch({ t: "UPDATE_PERSON", id: person.id, patch: { kyc: { ...person.kyc, [k]: !person.kyc[k] } } })}
                    className={cx("flex items-center gap-2 px-3 py-2 rounded-md border text-[12px] font-medium transition-all focusable",
                      person.kyc[k] ? "border-pine-200 bg-pine-50 text-pine-800" : "border-mist bg-card text-ink-soft hover:border-ink/25")}>
                    <span className={cx("w-4 h-4 rounded-full flex items-center justify-center border", person.kyc[k] ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300")}>
                      {person.kyc[k] && <Ic n="check" size={10} />}
                    </span>
                    {k === "eid" ? "Emirates ID" : k === "address" ? "Address proof" : k[0].toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {(person.cards.length > 0 || person.liabilities.length > 0) && (
              <div>
                <h4 className="text-[11px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft mb-1.5">Credit profile</h4>
                {person.cards.map((c, i) => <KV key={i} k={`Card · ${c.bank}`} v={`limit ${fmtAED(c.limit)}`} />)}
                {person.liabilities.map((l, i) => <KV key={i} k={l.type} v={`${fmtAED(l.monthly)}/mo`} />)}
              </div>
            )}
            <div>
              <h4 className="text-[11px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft mb-1.5">Linked records</h4>
              {state.leads.filter((l) => l.personId === person.id).map((l) => (
                <button key={l.id} onClick={() => nav.go("leads")} className="w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-ink/5 text-[12px] focusable">
                  <span className="num font-semibold">{l.ref}</span><Pill tone={statusTone[l.status]}>{l.status}</Pill>
                </button>
              ))}
              {state.cases.filter((c) => c.personId === person.id).map((c) => (
                <button key={c.id} onClick={() => nav.go("cases", { caseId: c.id })} className="w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-ink/5 text-[12px] focusable">
                  <span className="num font-semibold text-pine-700">{c.ref}</span>
                  <span className="text-ink-soft">{state.stages.find((s) => s.id === c.stage)?.name}</span>
                  <Pill tone={c.status === "CLOSED" ? "gr" : "pine"}>{c.status}</Pill>
                </button>
              ))}
              {state.leads.filter((l) => l.personId === person.id).length + state.cases.filter((c) => c.personId === person.id).length === 0 &&
                <p className="text-xs text-ink-soft">No leads or cases yet.</p>}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ================= LEADS ================= */

export function LeadsView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe();
  const [filter, setFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [create, setCreate] = useState(false);
  const [convert, setConvert] = useState<Lead | null>(null);

  const list = state.leads.filter((l) => filter === "ALL" || l.status === filter);
  const personName = (id: string) => state.persons.find((p) => p.id === id)?.name ?? "—";

  return (
    <div>
      <SectionHead title="Leads" sub="From first contact to handover — every lead carries its calculator snapshot into the case."
        right={<Btn onClick={() => setCreate(true)}><Ic n="plus" size={14} /> New lead</Btn>} />
      <div className="flex gap-1.5 mb-4 flex-wrap anim-up">
        {(["ALL", ...LEAD_STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s as "ALL" | LeadStatus)}
            className={cx("px-3 py-1.5 rounded-full text-[12px] font-display font-semibold border transition-all focusable",
              filter === s ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft hover:border-ink/30 hover:text-ink")}>
            {s === "ALL" ? "All" : s[0] + s.slice(1).toLowerCase()}
            <span className="ml-1.5 num text-[10px] opacity-70">{s === "ALL" ? state.leads.length : state.leads.filter((l) => l.status === s).length}</span>
          </button>
        ))}
      </div>
      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[13px] min-w-[920px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/60">
              <th className="px-4 py-2.5 font-semibold">Lead</th><th className="px-3 py-2.5 font-semibold">Client</th>
              <th className="px-3 py-2.5 font-semibold">Source</th><th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 font-semibold">Property</th><th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Next action</th><th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {list.map((l, i) => (
              <tr key={l.id} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/50 transition-colors anim-up" style={{ animationDelay: `${i * 30}ms` }}>
                <td className="px-4 py-2.5"><p className="num font-semibold">{l.ref}</p><p className="text-[11px] text-ink-soft">{fmtDate(l.createdAt)} · {state.users.find((u) => u.id === l.owner)?.name.split(" ")[0]}</p></td>
                <td className="px-3 py-2.5 font-semibold">{personName(l.personId)}</td>
                <td className="px-3 py-2.5 text-ink-soft">{l.source}</td>
                <td className="px-3 py-2.5"><Pill tone="gr">{TX.find((t) => t.v === l.type)?.l}</Pill></td>
                <td className="px-3 py-2.5 num">{l.propertyValue ? fmtAED(l.propertyValue) : "—"}{l.bankId ? <p className="text-[10.5px] text-ink-soft not-num font-sans">{state.banks.find((b) => b.id === l.bankId)?.short}</p> : null}</td>
                <td className="px-3 py-2.5">
                  <select value={l.status} disabled={l.status === "CONVERTED"}
                    onChange={(e) => dispatch({ t: "UPDATE_LEAD", id: l.id, patch: { status: e.target.value as LeadStatus } })}
                    className={cx("text-[11px] font-display font-semibold rounded-full border px-2 py-1 bg-card focusable cursor-pointer",
                      l.status === "CONVERTED" ? "opacity-60 cursor-not-allowed" : "")}
                    style={{ borderColor: "var(--color-mist)" }}>
                    {LEAD_STATUSES.filter((s) => s !== "CONVERTED" || l.status === "CONVERTED").map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2.5"><p className="text-[12px] font-medium">{l.nextAction ?? <span className="text-ink-soft/60">—</span>}</p>{l.due && <DueChip iso={l.due} />}</td>
                <td className="px-3 py-2.5 text-right">
                  {l.status !== "CONVERTED" && l.status !== "LOST" && (
                    <div className="flex gap-1 justify-end">
                      <button title="Run affordability" className="p-1.5 rounded-md hover:bg-pine-100 text-pine-700" onClick={() => nav.go("calculators", { params: { calc: "affordability", personId: l.personId, propertyValue: l.propertyValue, leadId: l.id } })}><Ic n="calc" size={15} /></button>
                      <button title="Convert to case" className="p-1.5 rounded-md hover:bg-ink/8 text-ink" onClick={() => setConvert(l)}><Ic n="arrowR" size={15} /></button>
                    </div>
                  )}
                  {l.status === "CONVERTED" && <Pill tone="ink">Converted</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState icon="funnel" title="No leads in this view" sub="Create a lead or switch the status filter." />}
      </div>

      {create && <CreateLead onClose={() => setCreate(false)} />}
      {convert && <ConvertLead lead={convert} onClose={() => setConvert(null)} />}
    </div>
  );
}

function CreateLead({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ personId: state.persons[0]?.id ?? "", source: state.leadSources[0], type: "PURCHASE" as TxType, bankId: "", propertyValue: 0, owner: state.users.find((u) => u.role === "VRM")?.id ?? "", nextAction: "First contact call", due: addDays(todayISO(), 2), notes: "" });
  const ref = "L-" + (1000 + state.leads.length + 1);
  return (
    <Modal open onClose={onClose} title={`New lead · ${ref}`} width={560}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => {
          dispatch({
            t: "ADD_LEAD", lead: {
              id: "l" + uid(), ref, personId: f.personId, source: f.source, type: f.type, status: "NEW",
              owner: f.owner, bankId: f.bankId || undefined, propertyValue: f.propertyValue || undefined,
              nextAction: f.nextAction || undefined, due: f.due || undefined, notes: f.notes || undefined, createdAt: todayISO(),
            },
          });
          onClose();
        }}>Create lead</Btn>
      </>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Client" req><Select value={f.personId} onChange={(v) => setF({ ...f, personId: v })} options={state.persons.map((p) => ({ v: p.id, l: p.name }))} /></Field>
        <Field label="Source"><Select value={f.source} onChange={(v) => setF({ ...f, source: v })} options={state.leadSources.map((s) => ({ v: s, l: s }))} /></Field>
        <Field label="Transaction type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v as TxType })} options={TX.map((t) => ({ v: t.v, l: t.l }))} /></Field>
        <Field label="Preferred bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={[{ v: "", l: "Not decided" }, ...state.banks.map((b) => ({ v: b.id, l: b.name }))]} /></Field>
        <Field label="Property value"><NumInput value={f.propertyValue} onChange={(n) => setF({ ...f, propertyValue: n })} suffix="AED" /></Field>
        <Field label="Owner (VRM)"><Select value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Next action"><TextInput value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} /></Field>
        <Field label="Due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ConvertLead({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe();
  const person = state.persons.find((p) => p.id === lead.personId);
  const [bankId, setBankId] = useState(lead.bankId ?? state.banks[0].id);
  const prods = state.products.filter((p) => p.bankId === bankId);
  const [productId, setProductId] = useState(prods[0]?.id ?? "");
  const prod = state.products.find((p) => p.id === productId);
  const [pv, setPv] = useState(lead.propertyValue ?? 1000000);
  const [loan, setLoan] = useState(Math.round((lead.propertyValue ?? 1000000) * 0.8));
  const [tenure, setTenure] = useState(prod?.maxTenureMonths ?? 300);
  const [owner, setOwner] = useState(state.users.find((u) => u.role === "SPO")?.id ?? "");
  const [revenue, setRevenue] = useState(Math.round((lead.propertyValue ?? 1000000) * 0.02));
  const refNum = Math.max(...state.cases.map((c) => parseInt(c.ref.replace("HF-", ""), 10) || 2000), 2000) + 1;
  const ref = "HF-" + refNum;

  return (
    <Modal open onClose={onClose} title={`Convert ${lead.ref} → ${ref}`} width={620}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => {
          const caze = {
            id: "c" + uid(), ref, personId: lead.personId, leadId: lead.id, ownerId: owner, bankId, productId,
            txType: lead.type, propertyValue: pv, loanAmount: loan, rate: prod?.rate ?? 4, tenureMonths: tenure,
            stage: "HANDOVER", status: "OPEN" as const,
            stageHistory: [{ stageId: "HANDOVER", at: nowISO(), by: me?.id ?? "" }],
            nextAction: "Sales→Ops handover briefing", nextActionDue: addDays(todayISO(), 2),
            expectedRevenue: revenue, docs: [], createdAt: todayISO(),
          };
          const bootTasks: Task[] = state.stages[0].tasks.map((t) => ({
            id: "t" + uid(), caseId: caze.id, stageId: "HANDOVER", type: t.split(" ").slice(0, 3).join(" "),
            title: t, ownerId: owner, priority: "MEDIUM" as const, status: "OPEN" as const, createdAt: nowISO(), due: addDays(todayISO(), 2),
          }));
          dispatch({ t: "CONVERT_LEAD", leadId: lead.id, caze, tasks: bootTasks });
          onClose();
          nav.go("cases", { caseId: caze.id });
        }}><Ic n="arrowR" size={14} /> Open case {ref}</Btn>
      </>}>
      <p className="text-[12px] text-ink-soft mb-4 -mt-1">The case opens at <span className="font-semibold text-ink">Handover</span>. Stage tasks and the document checklist are generated from the workflow engine.</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bank"><Select value={bankId} onChange={(v) => { setBankId(v); const np = state.products.filter((p) => p.bankId === v); setProductId(np[0]?.id ?? ""); }} options={state.banks.map((b) => ({ v: b.id, l: b.name }))} /></Field>
        <Field label="Product"><Select value={productId} onChange={setProductId} options={prods.map((p) => ({ v: p.id, l: `${p.name} · ${p.rate}%` }))} /></Field>
        <Field label="Property value"><NumInput value={pv} onChange={setPv} suffix="AED" /></Field>
        <Field label="Loan amount"><NumInput value={loan} onChange={setLoan} suffix="AED" /></Field>
        <Field label="Rate"><TextInput className="num" value={`${prod?.rate ?? 0}%`} disabled /></Field>
        <Field label="Tenure (months)"><NumInput value={tenure} onChange={setTenure} suffix="mo" /></Field>
        <Field label="Case owner (SPO)"><Select value={owner} onChange={setOwner} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Expected revenue"><NumInput value={revenue} onChange={setRevenue} suffix="AED" /></Field>
      </div>
      {person && (
        <div className="mt-4 bg-paper/70 border border-mist rounded-md px-3.5 py-2.5 text-[12px] flex flex-wrap gap-x-5 gap-y-1">
          <span><span className="text-ink-soft">Client:</span> <span className="font-semibold">{person.name}</span></span>
          <span><span className="text-ink-soft">Income:</span> <span className="num font-semibold">{fmtAED(person.monthlySalary + person.otherIncome)}</span></span>
          <span><span className="text-ink-soft">Type:</span> <span className="font-semibold">{person.customerType.replace("_", "-")}</span></span>
        </div>
      )}
    </Modal>
  );
}
