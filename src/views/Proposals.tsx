/* ============================================================
   Proposal Desk — bank-by-bank proposal comparison for a client.
   Generates a full proposal sheet per bank (like a DIB offer) and a
   side-by-side comparison so the customer can see which is better.
   ============================================================ */
import { useMemo, useState } from "react";
import type { ClientProfile, ProductDecision } from "../types";
import { useMe, useStore } from "../store";
import { currentEiborFix, evaluateAll, personToProfile } from "../decision";
import { ageYears } from "../calc";
import { buildInsights, buildProposal, proposalText } from "../proposal";
import type { BankProposal } from "../proposal";
import { Avatar, Btn, Drawer, EmptyState, Field, Ic, NumInput, Pill, Select, TextInput, cx, fmtAED, fmtN } from "../ui";

const VERDICT_META: Record<string, { tone: string; l: string }> = {
  ELIGIBLE: { tone: "pine", l: "Eligible" },
  ELIGIBLE_WITH_CONDITIONS: { tone: "steel", l: "Eligible · conditions" },
  REFER: { tone: "amber", l: "Refer" },
  NOT_ELIGIBLE: { tone: "rust", l: "Not eligible" },
  UNKNOWN: { tone: "ink", l: "Unknown · verify" },
};

export default function ProposalsView() {
  const { state } = useStore();
  const me = useMe()!;
  const [personId, setPersonId] = useState("");
  const [propertyValue, setPropertyValue] = useState(1500000);
  const [loanRequested, setLoanRequested] = useState(1100000);
  const [financeCount, setFinanceCount] = useState<1 | 2>(1);
  const [proposals, setProposals] = useState<BankProposal[] | null>(null);
  const [genClient, setGenClient] = useState<ClientProfile | null>(null);
  const [bankFilter, setBankFilter] = useState<Set<string>>(new Set());
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [customerView, setCustomerView] = useState(false);
  const [openBank, setOpenBank] = useState<BankProposal | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const eibor = currentEiborFix(state.eibor);
  const isInternal = me.role === "ADMIN" || me.role === "HEAD" || me.role === "TL" || me.role === "SPO" || me.role === "VRM";

  const generate = () => {
    const p = state.persons.find((x) => x.id === personId);
    if (!p) return;
    const client = personToProfile(p, propertyValue, loanRequested, p.dob ? ageYears(p.dob) : 35);
    client.financeCount = financeCount;
    const decisions = evaluateAll(state.productDefs, client, { eibor, rules: state.rules, promos: state.promos, today: new Date().toISOString().slice(0, 10) });
    const props = decisions.map((d) => buildProposal(state.productDefs.find((x) => x.id === d.productDefId)!, d, client, eibor));
    setProposals(props);
    setGenClient(client);
    setBankFilter(new Set());
  };

  const visible = useMemo(() => {
    if (!proposals) return [];
    return proposals.filter((p) =>
      (!onlyEligible || p.eligible) &&
      (bankFilter.size === 0 || bankFilter.has(p.def.bankId)));
  }, [proposals, onlyEligible, bankFilter]);

  const insights = useMemo(() => (proposals ? buildInsights(proposals) : []), [proposals]);
  const allBanks = useMemo(() => [...new Set((proposals ?? []).map((p) => p.def.bankId))], [proposals]);
  const bankShort = (id: string) => state.banks.find((b) => b.id === id)?.short ?? id.replace(/^b-/, "").toUpperCase();

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  return (
    <div className="space-y-4">
      {/* setup */}
      <div className="anim-up bg-card border border-mist rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ic n="file" size={16} className="text-pine-700" />
          <p className="font-display font-bold text-[15px] tracking-tight">Proposal Desk</p>
          <span className="num text-[10.5px] text-ink-soft bg-mist/60 rounded px-2 py-[2px]">bank-by-bank offers for one client</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2"><Field label="Client" req><Select value={personId} onChange={setPersonId} options={[{ v: "", l: "— select —" }, ...state.persons.map((p) => ({ v: p.id, l: p.name }))]} /></Field></div>
          <Field label="Property value"><NumInput value={propertyValue} onChange={setPropertyValue} suffix="AED" /></Field>
          <Field label="Loan requested"><NumInput value={loanRequested} onChange={setLoanRequested} suffix="AED" /></Field>
          <Field label="Finance count"><Select value={String(financeCount)} onChange={(v) => setFinanceCount(v === "2" ? 2 : 1)} options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd or more" }]} /></Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Btn disabled={!personId} onClick={generate}><Ic n="spark" size={14} /> Generate proposals</Btn>
          {proposals && isInternal && (
            <button onClick={() => setCustomerView(!customerView)}
              className={cx("focusable inline-flex items-center gap-1.5 px-3 py-[7px] rounded-md border text-[11.5px] font-display font-bold transition-all",
                customerView ? "bg-pine-700 text-paper border-pine-700" : "bg-card border-mist text-ink-soft hover:border-pine-500")}>
              <Ic n={customerView ? "eye" : "lock"} size={13} /> {customerView ? "Customer view (on)" : "Customer view (off)"}
            </button>
          )}
        </div>
      </div>

      {!proposals && (
        <div className="anim-up"><EmptyState icon="file" title="No proposals yet" sub="Pick a client, set the property value and loan, then generate to compare every bank's offer side by side." /></div>
      )}

      {proposals && genClient && (<>
        {/* insights (internal only) */}
        {isInternal && !customerView && insights.length > 0 && (
          <div className="anim-up bg-card border border-mist rounded-lg p-4">
            <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-2">What this means for {genClient.name}</p>
            <div className="flex flex-col gap-1.5">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2 anim-tick" style={{ animationDelay: `${i * 40}ms` }}>
                  <Ic n={ins.kind === "best" ? "check" : ins.kind === "warn" ? "x" : "alert"} size={14}
                    className={cx("mt-0.5", ins.kind === "best" ? "text-pine-600" : ins.kind === "warn" ? "text-rust-600" : "text-amber-600")} />
                  <p className="text-[12.5px]">{ins.bank && <span className="num font-bold text-pine-700 mr-1.5">{bankShort(ins.bank)}</span>}{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* bank filter chips */}
        <div className="anim-up flex flex-wrap items-center gap-2">
          <button onClick={() => setOnlyEligible(false)}
            className={cx("focusable px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", !onlyEligible ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft hover:border-ink/40")}>
            All banks
          </button>
          <button onClick={() => setOnlyEligible(true)}
            className={cx("focusable px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", onlyEligible ? "bg-pine-700 text-paper border-pine-700" : "bg-card border-mist text-ink-soft hover:border-pine-500")}>
            Eligible only
          </button>
          <span className="w-px h-5 bg-mist mx-1" />
          {allBanks.map((b) => (
            <button key={b} onClick={() => setBankFilter((prev) => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n; })}
              className={cx("focusable px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all",
                bankFilter.has(b) ? "bg-steel-600 text-paper border-steel-600" : "bg-card border-mist text-ink-soft hover:border-steel-500")}>
              {bankShort(b)}
            </button>
          ))}
        </div>

        {/* comparison matrix */}
        <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[900px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                <th className="px-4 py-2.5 font-semibold">Bank / Product</th>
                <th className="px-3 py-2.5 font-semibold">Verdict</th>
                <th className="px-3 py-2.5 font-semibold">Eligible finance</th>
                <th className="px-3 py-2.5 font-semibold">Self contribution</th>
                <th className="px-3 py-2.5 font-semibold">Fixed (rate · EMI)</th>
                <th className="px-3 py-2.5 font-semibold">Variable (rate · EMI)</th>
                {!customerView && <th className="px-3 py-2.5 font-semibold">Upfront fees</th>}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p, i) => {
                const vm = VERDICT_META[p.verdict] ?? VERDICT_META.UNKNOWN;
                const fixed = p.options.find((o) => o.kind === "FIXED");
                const vari = p.options.find((o) => o.kind === "VARIABLE");
                const scale = p.financeAmount > 0 ? p.financeAmount / 100000 : 0;
                const emiOf = (o?: { emiValue: number | null }) => (o?.emiValue != null && scale > 0 ? o.emiValue * scale : null);
                return (
                  <tr key={p.def.id} onClick={() => setOpenBank(p)}
                    className="group border-b border-mist/60 last:border-0 hover:bg-pine-50/40 cursor-pointer transition-colors anim-tick"
                    style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[13px]">{bankShort(p.def.bankId)}</p>
                      <p className="text-[10.5px] text-ink-soft truncate max-w-[180px]">{p.def.name}</p>
                    </td>
                    <td className="px-3 py-3"><Pill tone={vm.tone} dot>{vm.l}</Pill></td>
                    <td className="px-3 py-3 num font-semibold">{p.eligible ? fmtAED(p.financeAmount) : "—"}</td>
                    <td className="px-3 py-3 num">{p.eligible ? <>{fmtAED(p.selfContribution)}<span className="text-[10px] text-ink-soft ml-1">({p.contributionPct.toFixed(0)}%)</span></> : "—"}</td>
                    <td className="px-3 py-3 num">{fixed ? <>{fixed.ratePct != null ? fixed.ratePct.toFixed(2) + "%" : "TBC"}{emiOf(fixed) != null && <span className="text-ink-soft text-[10.5px]"> · {fmtAED(emiOf(fixed)!)}/mo</span>}</> : <span className="text-ink-soft/50">—</span>}</td>
                    <td className="px-3 py-3 num">{vari ? <>{vari.ratePct != null ? vari.ratePct.toFixed(2) + "%" : "TBC"}{emiOf(vari) != null && <span className="text-ink-soft text-[10.5px]"> · {fmtAED(emiOf(vari)!)}/mo</span>}</> : <span className="text-ink-soft/50">—</span>}</td>
                    {!customerView && <td className="px-3 py-3 num">{p.totalUpfront != null ? fmtAED(p.totalUpfront) : "—"}</td>}
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-display font-bold text-pine-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        Full offer <Ic n="arrowR" size={12} />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && <tr><td colSpan={customerView ? 7 : 8} className="px-4 py-12 text-center text-ink-soft">No banks match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[10.5px] text-ink-soft anim-up">Click any row for the full bank-wise offer sheet{isInternal && !customerView ? " · missing information and required documents are shown in internal view" : ""}.</p>
      </>)}

      {/* bank-wise detail */}
      {openBank && genClient && (
        <Drawer open onClose={() => setOpenBank(null)} width={520}
          title={`${bankShort(openBank.def.bankId)} — ${openBank.def.name}`}
          footer={<>
            <Btn variant="outline" onClick={() => copy("bank", proposalText(openBank, genClient, { customer: customerView }))}>
              <Ic n={copied === "bank" ? "check" : "copy"} size={13} /> {copied === "bank" ? "Copied" : "Copy offer"}
            </Btn>
            <Btn onClick={() => setOpenBank(null)}>Done</Btn>
          </>}>
          <BankSheet p={openBank} c={genClient} customerView={customerView} />
        </Drawer>
      )}
    </div>
  );
}

/* ---------- the bank-wise offer sheet ---------- */
function BankSheet({ p, c, customerView }: { p: BankProposal; c: ClientProfile; customerView: boolean }) {
  const vm = VERDICT_META[p.verdict] ?? VERDICT_META.UNKNOWN;
  const scale = p.financeAmount > 0 ? p.financeAmount / 100000 : 0;
  const emiOf = (o?: { emiValue: number | null }) => (o?.emiValue != null && scale > 0 ? o.emiValue * scale : null);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 anim-tick">
        <Pill tone={vm.tone} dot>{vm.l}</Pill>
        <span className="text-[11px] text-ink-soft num">v{p.pv.version} · {p.def.loanType}</span>
      </div>

      {!p.eligible ? (
        <div className="border border-rust-500/40 bg-rust-100/40 rounded-lg p-4 anim-tick">
          <p className="font-display font-bold text-[13.5px] text-rust-700">Not eligible for this client</p>
          <p className="text-[12.5px] mt-1.5">{p.blockReason ?? "See the decision findings for the reason."}</p>
        </div>
      ) : (<>
        {/* headline numbers */}
        <div className="grid grid-cols-2 gap-2.5 anim-tick">
          {[
            { k: "Eligible tenure", v: `${p.tenureMonths} months` },
            { k: "Eligible finance", v: fmtAED(p.financeAmount), strong: true },
            { k: "Self contribution", v: fmtAED(p.selfContribution) },
            { k: "Contribution %", v: `${p.contributionPct.toFixed(0)}% of property value` },
          ].map((x) => (
            <div key={x.k} className="rounded-md border border-mist bg-paper/50 px-3 py-2.5">
              <p className="text-[9.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft">{x.k}</p>
              <p className={cx("num mt-0.5", x.strong ? "text-[16px] font-semibold text-pine-700" : "text-[13.5px] font-semibold")}>{x.v}</p>
            </div>
          ))}
        </div>

        {/* rate options */}
        <div className="anim-tick">
          <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-2">Rate options</p>
          <div className="flex flex-col gap-2">
            {p.options.map((o, i) => (
              <div key={i} className={cx("rounded-lg border p-3.5", o.kind === "FIXED" ? "border-pine-300 bg-pine-50/60" : "border-steel-500/40 bg-steel-100/40")}>
                <div className="flex items-center justify-between gap-2">
                  <Pill tone={o.kind === "FIXED" ? "pine" : "steel"}>{o.kind === "FIXED" ? "Fixed" : "Variable"}</Pill>
                  <span className="num text-[16px] font-semibold">{o.ratePct != null ? o.ratePct.toFixed(2) + "%" : "TBC"}</span>
                </div>
                <p className="text-[11.5px] text-ink-soft mt-1.5">{o.recipe}</p>
                <p className="num text-[12px] mt-1">
                  {emiOf(o) != null ? <>≈ <strong>{fmtAED(emiOf(o)!)}/mo</strong> on {fmtAED(p.financeAmount)}</> : "EMI unconfirmed (index fix unavailable)"}
                </p>
              </div>
            ))}
            {!p.options.length && <p className="text-[12px] text-ink-soft">No rate cell matched this client segment.</p>}
          </div>
        </div>

        {/* fees */}
        <div className="anim-tick">
          <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-2">Fees & charges</p>
          <div className="rounded-lg border border-mist divide-y divide-mist/70">
            {p.fees.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div>
                  <p className="text-[12.5px] font-semibold">{f.label}</p>
                  {f.note && <p className="text-[10.5px] text-ink-soft">{f.note}</p>}
                </div>
                <span className="num text-[12.5px] font-semibold">{f.amount != null ? fmtAED(f.amount) : "—"}</span>
              </div>
            ))}
            {p.vat != null && (
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-paper/50">
                <p className="text-[12px] text-ink-soft">VAT</p><span className="num text-[12px]">{fmtAED(p.vat)}</span>
              </div>
            )}
            {p.totalUpfront != null && (
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-pine-50">
                <p className="text-[12.5px] font-display font-bold">Total upfront</p><span className="num text-[13.5px] font-semibold text-pine-700">{fmtAED(p.totalUpfront)}</span>
              </div>
            )}
          </div>
        </div>

        {/* insurance + settlement */}
        <div className="anim-tick">
          <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-2">Insurance & settlement</p>
          <div className="rounded-lg border border-mist divide-y divide-mist/70 text-[12px]">
            <div className="px-3.5 py-2.5"><p className="font-semibold">Life insurance</p><p className="text-[11px] text-ink-soft mt-0.5">{p.lifeInsurance}</p></div>
            <div className="px-3.5 py-2.5"><p className="font-semibold">Property insurance</p><p className="text-[11px] text-ink-soft mt-0.5">{p.propertyInsurance}</p></div>
            {p.pv.fees.earlySettlement && <div className="px-3.5 py-2.5"><p className="font-semibold">Early settlement</p><p className="text-[11px] text-ink-soft mt-0.5">{p.pv.fees.earlySettlement}</p></div>}
            {p.pv.fees.partialSettlement && <div className="px-3.5 py-2.5"><p className="font-semibold">Part payment</p><p className="text-[11px] text-ink-soft mt-0.5">{p.pv.fees.partialSettlement}</p></div>}
            <div className="px-3.5 py-2.5 flex items-center justify-between"><p className="font-semibold">Salary transfer required</p><Pill tone={p.salaryTransferRequired ? "amber" : "gr"}>{p.salaryTransferRequired ? "Yes" : "No"}</Pill></div>
          </div>
        </div>
      </>)}

      {/* internal-only: missing info + docs */}
      {!customerView && p.eligible && (p.missing.length > 0 || p.docs.length > 0) && (
        <div className="anim-tick">
          <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-2">Before submission (internal)</p>
          {p.missing.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-100/40 p-3.5 mb-2">
              <p className="text-[12px] font-display font-bold text-amber-700 mb-1.5">Missing information</p>
              {p.missing.map((m) => (
                <div key={m.field} className="flex items-start gap-2 py-1">
                  <Ic n="alert" size={13} className="text-amber-600 mt-0.5" />
                  <p className="text-[11.5px]"><strong>{m.field}</strong> — <span className="text-ink-soft">{m.why}</span></p>
                </div>
              ))}
            </div>
          )}
          {p.docs.length > 0 && (
            <div className="rounded-lg border border-mist p-3.5">
              <p className="text-[12px] font-display font-bold mb-1.5">Documents this bank requires</p>
              <div className="flex flex-wrap gap-1.5">{p.docs.map((d) => <span key={d} className="num text-[10.5px] bg-mist/60 rounded px-2 py-[3px]">{d}</span>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
