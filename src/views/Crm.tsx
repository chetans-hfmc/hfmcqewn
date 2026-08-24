import { useMemo, useState } from "react";
import type { CustomerType, Employment, Lead, LeadStatus, Person, TxType } from "../types";
import { useMe, useNav, useStore, isOversight } from "../store";
import { dbrPct } from "../calc";
import { Avatar, Btn, DateInput, DangerModal, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, Select, TextInput, cx, fmtAED, fmtDate, todayISO, uid, addDays } from "../ui";

const CT = [{ v: "NATIONAL", l: "UAE National" }, { v: "EXPAT", l: "Expat / Resident" }, { v: "NON_RESIDENT", l: "Non-Resident" }];
const EMP = [{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self-Employed" }];
const TX = [{ v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Pure Equity" }];
const LSTATUSES: LeadStatus[] = ["NEW", "CONTACTED", "APPOINTMENT", "QUALIFIED", "PROPOSAL", "CONVERTED", "LOST"];

/* ---------- lead intake: client step → lead step ---------- */
function CreateLead({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [step, setStep] = useState<"client" | "lead">("client");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState("");
  const [np, setNp] = useState({ name: "", mobile: "", nationality: "", customerType: "EXPAT" as CustomerType, employment: "SALARIED" as Employment, salary: 0 });
  const [lead, setLead] = useState({ source: state.leadSources[0], type: "PURCHASE" as TxType, bankId: "", propertyValue: 0, owner: me?.id ?? "", nextAction: "First contact call", due: addDays(todayISO(), 2), notes: "" });
  const [bankMode, setBankMode] = useState<"undecided" | "choose">("undecided");
  const [banks, setBanks] = useState<string[]>([]);
  const ref = "L-" + (1000 + state.leads.length + 1);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return state.persons.filter((p) =>
      p.name.toLowerCase().includes(n) || p.mobile.replace(/\D/g, "").includes(n.replace(/\D/g, "") || "##") ||
      (p.passportNo ?? "").toLowerCase().includes(n) || (p.eidNumber ?? "").toLowerCase().includes(n),
    ).slice(0, 6);
  }, [q, state.persons]);

  const clientReady = mode === "existing" ? !!sel : np.name.trim().length > 1 && np.mobile.replace(/\D/g, "").length >= 6;

  const create = () => {
    let personId = sel;
    if (mode === "new") {
      personId = "p" + uid();
      dispatch({
        t: "ADD_PERSON", person: {
          id: personId, name: np.name.trim(), customerType: np.customerType, nationality: np.nationality.trim() || "—",
          employment: np.employment, dob: "", mobile: np.mobile.trim(), email: "", monthlySalary: np.salary, otherIncome: 0,
          financeCount: 1, cards: [], liabilities: [], kyc: { passport: false, eid: false, visa: false, address: false }, createdAt: todayISO(),
        },
      });
    }
    const chosen = bankMode === "choose" ? banks : [];
    const make = (bankId?: string, suffix?: string): Lead => ({
      id: "l" + uid(), ref: suffix ? `${ref}-${suffix}` : ref, personId, source: lead.source, type: lead.type, status: "NEW",
      owner: lead.owner, bankId: bankId || undefined, propertyValue: lead.propertyValue || undefined,
      nextAction: lead.nextAction || undefined, due: lead.due || undefined,
      notes: chosen.length > 1 ? `Multi-bank intake → ${chosen.map((b) => state.banks.find((x) => x.id === b)?.short).join(", ")}` : lead.notes || undefined,
      createdAt: todayISO(),
    });
    if (chosen.length === 0) dispatch({ t: "ADD_LEAD", lead: make() });
    else chosen.forEach((b, i) => dispatch({ t: "ADD_LEAD", lead: make(b, String(i + 1)) }));
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`New lead · ${ref}`} width={620}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        {step === "client"
          ? <Btn disabled={!clientReady} onClick={() => setStep("lead")}><Ic n="arrowR" size={13} /> Next · lead details</Btn>
          : <Btn onClick={create}><Ic n="check" size={14} /> {bankMode === "choose" && banks.length > 1 ? `Create ${banks.length} leads — one per bank` : "Create lead"}</Btn>}
      </>}>
      {/* stepper */}
      <div className="flex items-center gap-2 mb-4">
        {(["client", "lead"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cx("w-6 h-6 rounded-full flex items-center justify-center num text-[11px] font-bold", (step === s || (s === "client" && step === "lead")) ? "bg-pine-700 text-paper" : "bg-mist text-ink-soft")}>{i + 1}</span>
            <span className={cx("text-[12px] font-display font-bold", step === s ? "text-ink" : "text-ink-soft")}>{s === "client" ? "Client" : "Lead details"}</span>
            {i === 0 && <span className="w-8 h-px bg-mist" />}
          </div>
        ))}
        {step === "lead" && <button onClick={() => setStep("client")} className="ml-auto text-[11.5px] font-display font-bold text-pine-700 hover:underline flex items-center gap-1"><Ic n="chevL" size={12} /> Back to client</button>}
      </div>

      {step === "client" && (
        <div className="anim-tick">
          <div className="flex gap-1.5 p-1.5 bg-paper/70 border border-mist rounded-lg mb-4">
            {([{ k: "new", l: "New client", sub: "register someone new" }, { k: "existing", l: "Existing client", sub: "search golden records" }] as const).map((t) => (
              <button key={t.k} onClick={() => setMode(t.k)}
                className={cx("flex-1 rounded-md px-3.5 py-2.5 text-left transition-all", mode === t.k ? "bg-ink text-paper shadow-md" : "hover:bg-mist/50")}>
                <span className={cx("block font-display font-bold text-[13px] tracking-tight", mode === t.k ? "text-paper" : "text-ink")}>{t.l}</span>
                <span className={cx("block text-[10.5px]", mode === t.k ? "text-paper/60" : "text-ink-soft")}>{t.sub}</span>
              </button>
            ))}
          </div>

          {mode === "existing" ? (
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"><Ic n="search" size={15} /></span>
                <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(""); }}
                  placeholder="Search by name, passport, Emirates ID or mobile…"
                  className="w-full h-[42px] rounded-lg border border-mist bg-card pl-9 pr-3 text-[13px] focus:outline-none focus:border-pine-600" />
              </div>
              {!q.trim() && <p className="text-[12px] text-ink-soft mt-3">Type at least 2 characters — matches name, passport, EID and mobile.</p>}
              {q.trim() && results.length === 0 && (
                <div className="mt-3 border border-dashed border-mist rounded-lg px-4 py-3.5 text-center">
                  <p className="text-[12.5px] font-semibold">No client matches “{q.trim()}”</p>
                  <button onClick={() => { setMode("new"); setNp({ ...np, name: q.trim() }); }} className="mt-1.5 text-[12px] font-display font-bold text-pine-700 hover:underline">Register as a new client →</button>
                </div>
              )}
              {results.length > 0 && (
                <div className="mt-2.5 space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {results.map((p) => (
                    <button key={p.id} onClick={() => setSel(p.id)}
                      className={cx("w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all", sel === p.id ? "border-pine-600 bg-pine-50 shadow-sm" : "border-mist bg-card hover:border-pine-400")}>
                      <Avatar name={p.name} size={32} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-[13px] truncate">{p.name}</span>
                        <span className="block text-[10.5px] text-ink-soft num truncate">{p.nationality} · {p.mobile || "no mobile"}{p.passportNo ? ` · ${p.passportNo}` : ""}</span>
                      </span>
                      <span className={cx("w-[18px] h-[18px] rounded-full border flex items-center justify-center", sel === p.id ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300")}>{sel === p.id && <Ic n="check" size={10} />}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Field label="Full name" req><TextInput autoFocus value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="e.g. Omar Al Mansouri" /></Field></div>
              <Field label="Mobile" req><TextInput value={np.mobile} onChange={(e) => setNp({ ...np, mobile: e.target.value })} placeholder="+971 5x xxx xxxx" /></Field>
              <Field label="Nationality"><TextInput value={np.nationality} onChange={(e) => setNp({ ...np, nationality: e.target.value })} placeholder="e.g. UAE" /></Field>
              <Field label="Customer type"><Select value={np.customerType} onChange={(v) => setNp({ ...np, customerType: v as CustomerType })} options={CT} /></Field>
              <Field label="Employment"><Select value={np.employment} onChange={(v) => setNp({ ...np, employment: v as Employment })} options={EMP} /></Field>
              <Field label="Monthly salary"><NumInput value={np.salary} onChange={(n) => setNp({ ...np, salary: n })} suffix="AED" /></Field>
            </div>
          )}
        </div>
      )}

      {step === "lead" && (
        <div className="anim-tick grid grid-cols-2 gap-3">
          <Field label="Source"><Select value={lead.source} onChange={(v) => setLead({ ...lead, source: v })} options={state.leadSources.map((s) => ({ v: s, l: s }))} /></Field>
          <Field label="Transaction type"><Select value={lead.type} onChange={(v) => setLead({ ...lead, type: v as TxType })} options={TX} /></Field>
          <Field label="Property value"><NumInput value={lead.propertyValue} onChange={(n) => setLead({ ...lead, propertyValue: n })} suffix="AED" /></Field>
          <Field label="Owner (VRM)"><Select value={lead.owner} onChange={(v) => setLead({ ...lead, owner: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
          <Field label="Next action"><TextInput value={lead.nextAction} onChange={(e) => setLead({ ...lead, nextAction: e.target.value })} /></Field>
          <Field label="Due"><DateInput value={lead.due} onChange={(e) => setLead({ ...lead, due: e.target.value })} /></Field>

          <div className="col-span-2 mt-1">
            <p className="text-[11px] font-display font-bold uppercase tracking-[0.08em] text-ink-soft mb-1.5">Which bank(s) is this going to?</p>
            <div className="flex gap-2 mb-2">
              {([{ k: "undecided", l: "Not decided" }, { k: "choose", l: "Choose banks" }] as const).map((m) => (
                <button key={m.k} onClick={() => setBankMode(m.k)}
                  className={cx("px-3.5 py-1.5 rounded-full border text-[12px] font-display font-bold transition-all", bankMode === m.k ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft hover:border-pine-600")}>{m.l}</button>
              ))}
            </div>
            {bankMode === "choose" && (
              <div className="flex flex-wrap gap-1.5">
                {state.banks.map((b) => {
                  const on = banks.includes(b.id);
                  return (
                    <button key={b.id} onClick={() => setBanks(on ? banks.filter((x) => x !== b.id) : [...banks, b.id])}
                      className={cx("px-3 py-1.5 rounded-full border text-[11.5px] font-semibold transition-all", on ? "bg-pine-700 text-paper border-pine-700" : "border-mist text-ink-soft hover:border-pine-600")}>{b.short}</button>
                  );
                })}
              </div>
            )}
            {bankMode === "choose" && banks.length > 1 && (
              <p className="text-[11.5px] text-pine-800 bg-pine-50 border border-pine-200 rounded-md px-3 py-2 mt-2">
                {banks.length} banks selected — {banks.length} linked leads will be created ({banks.map((b) => state.banks.find((x) => x.id === b)?.short).join(" · ")}), one per bank, so each runs its own pipeline.
              </p>
            )}
          </div>
          <div className="col-span-2"><Field label="Notes"><TextInput value={lead.notes} onChange={(e) => setLead({ ...lead, notes: e.target.value })} placeholder="optional" /></Field></div>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Leads list ---------- */
export function LeadsView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe()!;
  const scoped = !isOversight(me.role) && me.role !== "TL" && me.role !== "PA";
  const [filter, setFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [create, setCreate] = useState(() => nav.params.create === true);
  const [del, setDel] = useState<Lead | null>(null);
  const canDanger = me.role === "HEAD" || me.role === "ADMIN";

  const rows = state.leads
    .filter((l) => (scoped ? l.owner === me.id : true))
    .filter((l) => (filter === "ALL" ? true : l.status === filter));

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2 anim-up">
        {(["ALL", ...LSTATUSES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={cx("px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", filter === s ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft hover:border-pine-600")}>
            {s}{s !== "ALL" && <span className="num text-[10px] opacity-70 ml-1">{state.leads.filter((l) => l.status === s && (!scoped || l.owner === me.id)).length}</span>}
          </button>
        ))}
        <Btn className="ml-auto" onClick={() => setCreate(true)}><Ic n="plus" size={14} /> New lead</Btn>
      </div>

      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
            <th className="px-4 py-2.5 font-semibold">Lead / Client</th><th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 font-semibold">Source</th><th className="px-3 py-2.5 font-semibold">Bank</th>
            <th className="px-3 py-2.5 font-semibold">Owner</th><th className="px-3 py-2.5 font-semibold">Next</th><th className="px-3 py-2.5 font-semibold text-right">Actions</th>
          </tr></thead>
          <tbody>
            {rows.map((l) => {
              const p = state.persons.find((x) => x.id === l.personId);
              return (
                <tr key={l.id} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p?.name ?? "?"} size={30} />
                      <div><p className="font-semibold leading-tight">{p?.name}</p><p className="num text-[10.5px] text-pine-700 font-semibold">{l.ref}</p></div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><Pill tone={l.status === "CONVERTED" ? "ink" : l.status === "LOST" ? "gr" : l.status === "QUALIFIED" || l.status === "PROPOSAL" ? "pine" : "steel"}>{l.status}</Pill></td>
                  <td className="px-3 py-3 text-ink-soft">{l.source}</td>
                  <td className="px-3 py-3 font-medium">{l.bankId ? state.banks.find((b) => b.id === l.bankId)?.short : "—"}</td>
                  <td className="px-3 py-3 text-[12px]">{state.users.find((u) => u.id === l.owner)?.name.split(" ")[0]}</td>
                  <td className="px-3 py-3"><div className="text-[11.5px]">{l.nextAction ?? "—"}</div><DueChip iso={l.due} /></td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {l.status !== "CONVERTED" && l.status !== "LOST" && (
                        <Btn size="sm" variant="outline" onClick={() => nav.go("calculators", { params: { calc: "affordability", personId: l.personId, propertyValue: l.propertyValue, leadId: l.id } })}>Afford</Btn>
                      )}
                      {canDanger && l.status !== "CONVERTED" && (
                        <button onClick={() => setDel(l)} className="p-1.5 rounded-md text-rust-600 hover:bg-rust-100 transition-colors"><Ic n="trash" size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7}><EmptyState icon="funnel" title="No leads here" sub="Create a lead or change the status filter." /></td></tr>}
          </tbody>
        </table>
      </div>

      {create && <CreateLead onClose={() => setCreate(false)} />}
      {del && (
        <DangerModal open onClose={() => setDel(null)} title="Delete lead" target={`${del.ref} · ${state.persons.find((p) => p.id === del.personId)?.name ?? ""}`}
          warn="The lead is removed. The client profile stays. Converted leads can't be deleted."
          confirmLabel="Delete lead"
          onConfirm={(reason) => { dispatch({ t: "DELETE_LEAD", id: del.id, reason }); setDel(null); }} />
      )}
    </div>
  );
}

/* ---------- People list + profile ---------- */
export function PeopleView() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Person | null>(null);
  const canDanger = me.role === "HEAD" || me.role === "ADMIN";
  const [del, setDel] = useState<Person | null>(null);

  const rows = state.persons.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()) || (p.mobile ?? "").includes(q));
  const openCases = open ? state.cases.filter((c) => c.personId === open.id) : [];
  const blocked = open ? openCases.length > 0 || state.leads.some((l) => l.personId === open.id) : false;

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2 anim-up">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"><Ic n="search" size={14} /></span>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="pl-8 w-[260px]" />
        </div>
        <span className="ml-auto num text-[11px] text-ink-soft">{rows.length} clients</span>
      </div>

      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[12.5px] min-w-[700px]">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
            <th className="px-4 py-2.5 font-semibold">Client</th><th className="px-3 py-2.5 font-semibold">Type</th>
            <th className="px-3 py-2.5 font-semibold">Employment</th><th className="px-3 py-2.5 font-semibold">Income</th>
            <th className="px-3 py-2.5 font-semibold">DBR</th><th className="px-3 py-2.5 font-semibold">Cases</th>
          </tr></thead>
          <tbody>
            {rows.map((p) => {
              const dbr = dbrPct(p);
              const nc = state.cases.filter((c) => c.personId === p.id).length;
              return (
                <tr key={p.id} onClick={() => setOpen(p)} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={p.name} size={30} /><div><p className="font-semibold leading-tight">{p.name}</p><p className="num text-[10.5px] text-ink-soft">{p.nationality} · {p.mobile || "—"}</p></div></div></td>
                  <td className="px-3 py-3"><Pill tone={p.customerType === "NATIONAL" ? "pine" : p.customerType === "NON_RESIDENT" ? "amber" : "steel"}>{CT.find((c) => c.v === p.customerType)?.l}</Pill></td>
                  <td className="px-3 py-3 text-ink-soft">{p.employment === "SALARIED" ? "Salaried" : "Self-Employed"}</td>
                  <td className="px-3 py-3 num">{p.monthlySalary + p.otherIncome ? fmtAED(p.monthlySalary + p.otherIncome) : "—"}</td>
                  <td className="px-3 py-3 num">{p.monthlySalary + p.otherIncome ? <span className={cx(dbr >= 50 ? "text-rust-600 font-bold" : "text-pine-700")}>{dbr.toFixed(1)}%</span> : "—"}</td>
                  <td className="px-3 py-3 num">{nc}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6}><EmptyState icon="users" title="No clients" sub="Clients are created from the lead intake." /></td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Drawer open onClose={() => setOpen(null)} title={open.name} width={520}
          footer={<>
            {canDanger && <Btn variant="outline" onClick={() => setDel(open)}><Ic n="trash" size={13} /> Delete client</Btn>}
            <Btn onClick={() => { setOpen(null); }}>Done</Btn>
          </>}>
          <div className="space-y-4">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2">Personal</p>
              <KV k="Nationality" v={open.nationality} mono={false} />
              <KV k="Customer type" v={CT.find((c) => c.v === open.customerType)?.l ?? "—"} mono={false} />
              <KV k="DOB" v={open.dob ? fmtDate(open.dob) : "—"} mono={false} />
              <KV k="Mobile" v={open.mobile || "—"} mono={false} />
              <KV k="Emirate" v={open.emirate ?? "—"} mono={false} />
              <KV k="Passport" v={open.passportNo ?? "—"} />
              <KV k="Emirates ID" v={open.eidNumber ?? "—"} />
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2">Employment & income</p>
              <KV k="Employment" v={open.employment === "SALARIED" ? "Salaried" : "Self-Employed"} mono={false} />
              <KV k="Employer" v={open.employer ?? "—"} mono={false} />
              <KV k="Monthly salary" v={open.monthlySalary ? fmtAED(open.monthlySalary) : "—"} />
              <KV k="Other income" v={open.otherIncome ? fmtAED(open.otherIncome) : "—"} />
              <KV k="Existing liabilities" v={open.liabilities.length ? `${fmtAED(open.liabilities.reduce((s, l) => s + l.monthly, 0))}/mo` : "—"} />
              <KV k="DBR (auto)" v={`${dbrPct(open).toFixed(1)}%`} />
              <KV k="Credit score" v={open.creditScore ?? "—"} mono={false} />
            </div>
            {openCases.length > 0 && (
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2">Cases ({openCases.length})</p>
                {openCases.map((c) => (
                  <p key={c.id} className="text-[12px] border-b border-mist/50 py-1.5">{c.ref} · {state.banks.find((b) => b.id === c.bankId)?.short} · {state.stages.find((s) => s.id === c.stage)?.name} · {c.loanAmount ? fmtAED(c.loanAmount) : "—"}</p>
                ))}
              </div>
            )}
          </div>
        </Drawer>
      )}

      {del && (
        <DangerModal open onClose={() => setDel(null)} title="Delete client" target={del.name}
          blocked={blocked} blockReason="This client still has leads or cases. Close or delete those first so nothing is orphaned."
          warn="The client profile is removed permanently. History stays in the audit trail."
          confirmLabel="Delete client"
          onConfirm={(reason) => { dispatch({ t: "DELETE_PERSON", id: del.id, reason }); setDel(null); setOpen(null); }} />
      )}
    </div>
  );
}
