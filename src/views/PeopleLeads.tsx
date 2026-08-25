import { useMemo, useState } from "react";
import type { CustomerType, Employment, Lead, LeadStatus, Person, Task, TxType } from "../types";
import { useMe, useNav, useStore } from "../store";
import { Avatar, Btn, DateInput, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, SectionHead, Select, TextInput, addDays, cx, fmtAED, fmtDate, nowISO, todayISO, uid, ageYears } from "../ui";
import { emi } from "../calc";

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

function PSec({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-display font-bold uppercase tracking-[0.11em] text-pine-700 mb-1.5 pb-1 border-b border-pine-100">{t}</h4>
      {children}
    </div>
  );
}

function FSec({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="font-display font-bold text-[11px] uppercase tracking-[0.13em] text-pine-700 mb-2.5 pb-1.5 border-b border-pine-100">{t}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">{children}</div>
    </div>
  );
}

function PersonForm({ onSave, onClose, existing }: { onSave: (p: Person) => void; onClose: () => void; existing?: Person }) {
  const { state } = useStore();
  const [f, setF] = useState({
    name: existing?.name ?? "", preferredName: existing?.preferredName ?? "", customerType: existing?.customerType ?? ("EXPAT" as CustomerType),
    nationality: existing?.nationality ?? "", countryOfBirth: existing?.countryOfBirth ?? "", gender: existing?.gender ?? "",
    dob: existing?.dob ?? "", mobile: existing?.mobile ?? "", altMobile: existing?.altMobile ?? "", email: existing?.email ?? "",
    whatsapp: existing?.whatsapp ?? "",
    uaeResident: existing?.uaeResident ?? true, residencyStatus: existing?.residencyStatus ?? "", visaType: existing?.visaType ?? "",
    visaExpiry: existing?.visaExpiry ?? "", eidNumber: existing?.eidNumber ?? "", eidExpiry: existing?.eidExpiry ?? "",
    passportNo: existing?.passportNo ?? "", passportExpiry: existing?.passportExpiry ?? "", emirate: existing?.emirate ?? "",
    currentAddress: existing?.currentAddress ?? "",
    employment: existing?.employment ?? ("SALARIED" as Employment), employer: existing?.employer ?? "", jobTitle: existing?.jobTitle ?? "",
    sector: existing?.sector ?? "", yearsEmployed: existing?.yearsEmployed ?? 0, workLocation: existing?.workLocation ?? "",
    hrName: existing?.hrName ?? "", hrPhone: existing?.hrPhone ?? "",
    monthlySalary: existing?.monthlySalary ?? 0, otherIncome: existing?.otherIncome ?? 0, financeCount: existing?.financeCount ?? (1 as 1 | 2),
    creditScore: existing?.creditScore ?? "", dependants: existing?.dependants ?? 0, primaryAccountBank: existing?.primaryAccountBank ?? "",
    assignedTeam: existing?.assignedTeam ?? "", assignedRm: existing?.assignedRm ?? "", dateRegistered: existing?.dateRegistered ?? todayISO(),
    leadSource: existing?.leadSource ?? "",
  });
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim().length > 1;
  const total = f.monthlySalary + f.otherIncome;
  return (
    <Modal open onClose={onClose} title={existing ? `Client profile · ${existing.name}` : "New client profile"} width={720}
      footer={<>
        <p className="mr-auto text-[11px] text-ink-soft num">Total income {fmtAED(total)}/mo</p>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!valid} onClick={() => onSave({
          id: existing?.id ?? "p" + uid(), name: f.name.trim(), preferredName: f.preferredName || undefined,
          customerType: f.customerType, nationality: f.nationality || "—", countryOfBirth: f.countryOfBirth || undefined, gender: f.gender || undefined,
          dob: f.dob, mobile: f.mobile, altMobile: f.altMobile || undefined, email: f.email, whatsapp: f.whatsapp || undefined,
          uaeResident: f.uaeResident, residencyStatus: f.residencyStatus || undefined, visaType: f.visaType || undefined,
          visaExpiry: f.visaExpiry || undefined, eidNumber: f.eidNumber || undefined, eidExpiry: f.eidExpiry || undefined,
          passportNo: f.passportNo || undefined, passportExpiry: f.passportExpiry || undefined, emirate: f.emirate || undefined,
          currentAddress: f.currentAddress || undefined,
          employment: f.employment, employer: f.employer, jobTitle: f.jobTitle || undefined, sector: f.sector || undefined,
          yearsEmployed: f.yearsEmployed || undefined, workLocation: f.workLocation || undefined,
          hrName: f.hrName || undefined, hrPhone: f.hrPhone || undefined,
          monthlySalary: f.monthlySalary, otherIncome: f.otherIncome, financeCount: f.financeCount,
          creditScore: f.creditScore || undefined, dependants: f.dependants || undefined, primaryAccountBank: f.primaryAccountBank || undefined,
          assignedTeam: f.assignedTeam || undefined, assignedRm: f.assignedRm || undefined,
          dateRegistered: f.dateRegistered || undefined, leadSource: f.leadSource || undefined,
          cards: existing?.cards ?? [], liabilities: existing?.liabilities ?? [],
          kyc: existing?.kyc ?? { passport: false, eid: false, visa: false, address: false },
          createdAt: existing?.createdAt ?? todayISO(),
        })}>{existing ? "Save profile" : "Create profile"}</Btn>
      </>}>
      <FSec t="Personal information">
        <Field label="Full name" req><TextInput value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dina Khalid Saeed Alalami" /></Field>
        <Field label="Preferred name"><TextInput value={f.preferredName} onChange={(e) => set("preferredName", e.target.value)} /></Field>
        <Field label="Date of birth"><DateInput value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
        <Field label="Gender"><Select value={f.gender} onChange={(v) => set("gender", v)} options={[{ v: "", l: "—" }, { v: "Female", l: "Female" }, { v: "Male", l: "Male" }]} /></Field>
        <Field label="Mobile"><TextInput value={f.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="+971 …" /></Field>
        <Field label="Alt mobile"><TextInput value={f.altMobile} onChange={(e) => set("altMobile", e.target.value)} /></Field>
        <Field label="Email"><TextInput value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="WhatsApp"><TextInput value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
        <Field label="Nationality"><TextInput value={f.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. UAE National" /></Field>
        <Field label="Country of birth"><TextInput value={f.countryOfBirth} onChange={(e) => set("countryOfBirth", e.target.value)} /></Field>
        <Field label="Customer type"><Select value={f.customerType} onChange={(v) => set("customerType", v)} options={CT.map((c) => ({ v: c.v, l: c.l }))} /></Field>
      </FSec>
      <FSec t="Residency & visa">
        <Field label="UAE resident"><Select value={f.uaeResident ? "yes" : "no"} onChange={(v) => set("uaeResident", v === "yes")} options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]} /></Field>
        <Field label="Residency status"><Select value={f.residencyStatus} onChange={(v) => set("residencyStatus", v)} options={[{ v: "", l: "—" }, { v: "Citizen", l: "Citizen" }, { v: "Resident", l: "Resident" }, { v: "Non-resident", l: "Non-resident" }]} /></Field>
        <Field label="Visa type"><TextInput value={f.visaType} onChange={(e) => set("visaType", e.target.value)} placeholder="N/A for citizens" /></Field>
        <Field label="Visa expiry"><DateInput value={f.visaExpiry} onChange={(e) => set("visaExpiry", e.target.value)} /></Field>
        <Field label="Emirates ID no."><TextInput value={f.eidNumber} onChange={(e) => set("eidNumber", e.target.value)} placeholder="784-…" /></Field>
        <Field label="EID expiry"><DateInput value={f.eidExpiry} onChange={(e) => set("eidExpiry", e.target.value)} /></Field>
        <Field label="Passport no."><TextInput value={f.passportNo} onChange={(e) => set("passportNo", e.target.value)} /></Field>
        <Field label="Passport expiry"><DateInput value={f.passportExpiry} onChange={(e) => set("passportExpiry", e.target.value)} /></Field>
        <Field label="Emirate"><Select value={f.emirate} onChange={(v) => set("emirate", v)} options={[{ v: "", l: "—" }, ...["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "RAK", "Fujairah", "UAQ"].map((x) => ({ v: x, l: x }))]} /></Field>
        <Field label="Current address"><TextInput value={f.currentAddress} onChange={(e) => set("currentAddress", e.target.value)} /></Field>
      </FSec>
      <FSec t="Employment details">
        <Field label="Employment type"><Select value={f.employment} onChange={(v) => set("employment", v)} options={EMP.map((c) => ({ v: c.v, l: c.l }))} /></Field>
        <Field label="Employer name"><TextInput value={f.employer} onChange={(e) => set("employer", e.target.value)} /></Field>
        <Field label="Job title"><TextInput value={f.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} /></Field>
        <Field label="Sector"><Select value={f.sector} onChange={(v) => set("sector", v)} options={[{ v: "", l: "—" }, ...["Government", "Semi-Government", "Private", "Banking", "Oil & Gas", "Healthcare", "Education", "Other"].map((x) => ({ v: x, l: x }))]} /></Field>
        <Field label="Years employed"><NumInput value={f.yearsEmployed} onChange={(n) => set("yearsEmployed", n)} suffix="yrs" /></Field>
        <Field label="Work location"><TextInput value={f.workLocation} onChange={(e) => set("workLocation", e.target.value)} /></Field>
        <Field label="HR contact name"><TextInput value={f.hrName} onChange={(e) => set("hrName", e.target.value)} /></Field>
        <Field label="HR contact phone"><TextInput value={f.hrPhone} onChange={(e) => set("hrPhone", e.target.value)} /></Field>
      </FSec>
      <FSec t="Financial profile">
        <Field label="Monthly salary"><NumInput value={f.monthlySalary} onChange={(n) => set("monthlySalary", n)} suffix="AED" /></Field>
        <Field label="Other income"><NumInput value={f.otherIncome} onChange={(n) => set("otherIncome", n)} suffix="AED" /></Field>
        <Field label="Credit score"><Select value={f.creditScore} onChange={(v) => set("creditScore", v)} options={[{ v: "", l: "—" }, ...["Excellent", "Good", "Fair", "Poor"].map((x) => ({ v: x, l: x }))]} /></Field>
        <Field label="No. of dependants"><NumInput value={f.dependants} onChange={(n) => set("dependants", n)} /></Field>
        <Field label="Primary account bank"><TextInput value={f.primaryAccountBank} onChange={(e) => set("primaryAccountBank", e.target.value)} /></Field>
        <Field label="Property finance count"><Select value={String(f.financeCount)} onChange={(v) => set("financeCount", Number(v) as 1 | 2)} options={[{ v: "1", l: "1st property finance" }, { v: "2", l: "2nd or more" }]} /></Field>
      </FSec>
      <FSec t="Assignment & registration">
        <Field label="Assigned team"><Select value={f.assignedTeam} onChange={(v) => set("assignedTeam", v)} options={[{ v: "", l: "—" }, { v: "VRM1", l: "VRM1" }, { v: "VRM2", l: "VRM2" }, ...Array.from(new Set(state.users.filter((u) => u.active && u.role === "VRM").map((u) => u.name))).map((n) => ({ v: n, l: n }))]
          .filter((o, i, a) => a.findIndex((x) => x.v === o.v) === i)} /></Field>
        <Field label="Assigned RM"><Select value={f.assignedRm} onChange={(v) => set("assignedRm", v)} options={[{ v: "", l: "—" }, ...state.users.filter((u) => u.active && (u.role === "VRM" || u.role === "SPO")).map((u) => ({ v: u.name, l: u.name }))]} /></Field>
        <Field label="Date registered"><DateInput value={f.dateRegistered} onChange={(e) => set("dateRegistered", e.target.value)} /></Field>
        <Field label="Lead source"><Select value={f.leadSource} onChange={(v) => set("leadSource", v)} options={[{ v: "", l: "—" }, ...state.leadSources.map((s) => ({ v: s, l: s }))]} /></Field>
      </FSec>
    </Modal>
  );
}

export function PeopleView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<null | { existing?: Person }>(null);
  const [sel, setSel] = useState<string | null>((nav.params.personId as string) ?? null);

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
            <PSec t="Personal information">
              <KV k="Full name" v={person.name} mono={false} />
              <KV k="Preferred name" v={person.preferredName || "—"} mono={false} />
              <KV k="Date of birth" v={person.dob ? fmtDate(person.dob) : "—"} mono={false} />
              <KV k="Gender" v={person.gender || "—"} mono={false} />
              <KV k="Mobile" v={person.mobile || "—"} mono={false} />
              <KV k="Alt mobile" v={person.altMobile || "—"} mono={false} />
              <KV k="Email" v={person.email || "—"} mono={false} />
              <KV k="WhatsApp" v={person.whatsapp || "—"} mono={false} />
              <KV k="Nationality" v={person.nationality} mono={false} />
              <KV k="Country of birth" v={person.countryOfBirth || "—"} mono={false} />
            </PSec>
            <PSec t="Residency & visa">
              <KV k="UAE resident" v={person.uaeResident === undefined ? "—" : person.uaeResident ? "Yes" : "No"} mono={false} />
              <KV k="Residency status" v={person.residencyStatus || "—"} mono={false} />
              <KV k="Visa type" v={person.visaType || "—"} mono={false} />
              <KV k="Visa expiry" v={person.visaExpiry ? fmtDate(person.visaExpiry) : "—"} mono={false} />
              <KV k="Emirates ID no." v={person.eidNumber || "—"} />
              <KV k="EID expiry" v={person.eidExpiry ? fmtDate(person.eidExpiry) : "—"} mono={false} />
              <KV k="Passport no." v={person.passportNo || "—"} />
              <KV k="Passport expiry" v={person.passportExpiry ? fmtDate(person.passportExpiry) : "—"} mono={false} />
              <KV k="Emirate" v={person.emirate || "—"} mono={false} />
              <KV k="Current address" v={person.currentAddress || "—"} mono={false} />
            </PSec>
            <PSec t="Employment details">
              <KV k="Employment type" v={EMP.find((c) => c.v === person.employment)?.l ?? "—"} mono={false} />
              <KV k="Employer name" v={person.employer || "—"} mono={false} />
              <KV k="Job title" v={person.jobTitle || "—"} mono={false} />
              <KV k="Sector" v={person.sector || "—"} mono={false} />
              <KV k="Years employed" v={person.yearsEmployed ? `${person.yearsEmployed}` : "—"} />
              <KV k="Work location" v={person.workLocation || "—"} mono={false} />
              <KV k="HR contact name" v={person.hrName || "—"} mono={false} />
              <KV k="HR contact phone" v={person.hrPhone || "—"} mono={false} />
            </PSec>
            <PSec t="Financial profile">
              <KV k="Monthly salary" v={person.monthlySalary ? fmtAED(person.monthlySalary) : "—"} />
              <KV k="Other income" v={person.otherIncome ? fmtAED(person.otherIncome) : "—"} />
              <KV k="Total income (auto)" v={person.monthlySalary + person.otherIncome ? fmtAED(person.monthlySalary + person.otherIncome) : "—"} />
              <KV k="Existing liabilities" v={person.liabilities.length ? `${fmtAED(person.liabilities.reduce((s, l) => s + l.monthly, 0))}/mo` : "—"} />
              <KV k="DBR % (auto)" v={(() => {
                const inc = person.monthlySalary + person.otherIncome;
                if (!inc) return "—";
                const dbr = (person.liabilities.reduce((s, l) => s + l.monthly, 0) / inc) * 100;
                return `${dbr.toFixed(1)}%${dbr >= 50 ? " · above 50% ceiling" : ""}`;
              })()} />
              <KV k="Credit score" v={person.creditScore || "—"} mono={false} />
              <KV k="No. of dependants" v={person.dependants !== undefined && person.dependants !== null ? `${person.dependants}` : "—"} />
              <KV k="Primary account bank" v={person.primaryAccountBank || "—"} mono={false} />
              <KV k="Property finance count" v={person.financeCount === 1 ? "1st property finance" : "2nd or more"} mono={false} />
            </PSec>
            <PSec t="Transaction details (from linked cases)">
              {(() => {
                const cs = state.cases.filter((c) => c.personId === person.id && c.status === "OPEN");
                if (!cs.length) return <p className="text-[12px] text-ink-soft italic px-1">No open transaction — details appear when a case is created.</p>;
                return cs.map((cz) => {
                  const bank = state.banks.find((b) => b.id === cz.bankId);
                  const ltv = cz.propertyValue ? (cz.loanAmount / cz.propertyValue) * 100 : 0;
                  const emiV = emi(cz.loanAmount, cz.rate, cz.tenureMonths);
                  return (
                    <button key={cz.id} onClick={() => nav.go("cases", { caseId: cz.id })} className="w-full text-left border border-mist rounded-md px-3 py-2.5 mb-2 hover:border-pine-400 hover:shadow-sm transition-all focusable">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="num text-[11px] font-bold text-pine-700">{cz.ref} · {bank?.short}{cz.deal ? ` · ${cz.deal}` : ""}</span>
                        <span className="text-[10px] font-display font-bold uppercase tracking-wide bg-pine-100 text-pine-800 rounded px-1.5 py-0.5">{state.stages.find((s) => s.id === cz.stage)?.short}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 text-[11.5px]">
                        <KV k="Transaction type" v={TX.find((t) => t.v === cz.txType)?.l ?? "—"} mono={false} />
                        <KV k="Property value" v={cz.propertyValue ? fmtAED(cz.propertyValue) : "—"} />
                        <KV k="Finance amount" v={cz.loanAmount ? fmtAED(cz.loanAmount) : "—"} />
                        <KV k="LTV % (auto)" v={ltv ? `${ltv.toFixed(0)}%` : "—"} />
                        <KV k="Tenor" v={`${Math.round(cz.tenureMonths / 12)} yrs (${cz.tenureMonths} mo)`} />
                        <KV k="Interest rate" v={`${cz.rate}%`} />
                        <KV k="Monthly EMI (auto)" v={cz.loanAmount ? fmtAED(emiV) : "—"} />
                        <KV k="Bank status" v={cz.bankApp?.status || state.stages.find((s) => s.id === cz.stage)?.name || "—"} mono={false} />
                      </div>
                    </button>
                  );
                });
              })()}
              <KV k="Assigned team" v={person.assignedTeam || "—"} mono={false} />
              <KV k="Assigned RM" v={person.assignedRm || "—"} mono={false} />
              <KV k="Date registered" v={person.dateRegistered ? fmtDate(person.dateRegistered) : fmtDate(person.createdAt)} mono={false} />
              <KV k="Lead source" v={person.leadSource || "—"} mono={false} />
            </PSec>
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
