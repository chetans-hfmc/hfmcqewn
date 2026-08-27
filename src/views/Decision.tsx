import { useMemo, useState } from "react";
import type { ClientProfile, CustomerType, DecisionSnapshot, Employment, ProductDecision, Verdict, WeightingProfile } from "../types";
import { useMe, useNav, useStore } from "../store";
import { RESOLVER_VERSION, collectRuleVersions, currentEiborFix, evaluateAll, personToProfile, rankDecisions, replayDecision, runGoldenCases } from "../decision";
import { ageYears } from "../calc";
import { Avatar, Btn, Field, Ic, NumInput, Pill, Select, TextInput, cx, fmtAED, fmtDate, fmtN, fmtPct, nowISO, todayISO, uid } from "../ui";

const VERDICT_META: Record<Verdict, { tone: string; l: string; icon: string }> = {
  ELIGIBLE: { tone: "pine", l: "Eligible", icon: "check" },
  ELIGIBLE_WITH_CONDITIONS: { tone: "steel", l: "Eligible · conditions", icon: "check" },
  REFER: { tone: "amber", l: "Refer", icon: "alert" },
  NOT_ELIGIBLE: { tone: "rust", l: "Not eligible", icon: "x" },
};

function VerdictPill({ v }: { v: Verdict }) {
  const m = VERDICT_META[v];
  return <Pill tone={m.tone} dot>{m.l}</Pill>;
}

const emptyProfile: ClientProfile = {
  name: "", nationality: "India", customerType: "EXPAT", residency: "RESIDENT", employment: "SALARIED",
  age: 35, monthlyIncome: 40000, otherIncome: 0, monthlyLiabilities: 3000, creditCardLimits: 20000,
  propertyValue: 1500000, loanRequested: 1100000, financeCount: 1, propertyType: "RESIDENTIAL",
  emirate: "DUBAI", sector: "", yearsEmployed: 3,
};

export default function DecisionView() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const nav = useNav();
  const [tab, setTab] = useState<"evaluate" | "snapshots" | "golden">("evaluate");
  const [profile, setProfile] = useState<ClientProfile>(emptyProfile);
  const [personId, setPersonId] = useState("");
  const [weightId, setWeightId] = useState(state.weightingProfiles[0]?.id ?? "wp-balanced");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<ProductDecision[] | null>(null);
  const [replayFor, setReplayFor] = useState<DecisionSnapshot | null>(null);
  const isAdmin = me?.role === "ADMIN" || me?.role === "HEAD";

  const eibor = currentEiborFix(state.eibor);
  const weight = state.weightingProfiles.find((w) => w.id === weightId) ?? state.weightingProfiles[0];

  const loadPerson = (pid: string) => {
    setPersonId(pid);
    const p = state.persons.find((x) => x.id === pid);
    if (!p) return;
    setProfile(personToProfile(p, profile.propertyValue || 1500000, profile.loanRequested || 1100000, p.dob ? ageYears(p.dob) : 35));
  };

  const evaluate = () => {
    const ctx = { eibor, rules: state.rules, promos: state.promos, today: todayISO() };
    const raw = evaluateAll(state.productDefs, profile, ctx);
    setDecisions(rankDecisions(raw, weight?.weights ?? { finance: 30, rate: 25, ltv: 20, fees: 15, tat: 10 }));
    setExpanded(null);
  };

  const saveSnapshot = () => {
    if (!decisions) return;
    const snap: DecisionSnapshot = {
      id: "snap" + uid(), at: nowISO(), by: me?.id ?? "system", client: profile,
      resolverVersion: RESOLVER_VERSION, eiborFix: eibor, weightingProfileId: weight?.id ?? "",
      ruleVersions: collectRuleVersions(decisions), decisions,
    };
    dispatch({ t: "SAVE_DECISION_SNAPSHOT", snapshot: snap });
    setTab("snapshots");
  };

  const goldenResults = useMemo(() => {
    if (tab !== "golden") return null;
    const ctx = { eibor, rules: state.rules, promos: state.promos, today: todayISO() };
    return runGoldenCases(state.goldenCases, state.productDefs, ctx);
  }, [tab, eibor, state.rules, state.promos, state.goldenCases, state.productDefs]);

  const eligibleCount = decisions?.filter((d) => d.eligibleAmount > 0).length ?? 0;
  const bestRate = decisions?.filter((d) => d.ratePct != null && d.eligibleAmount > 0).sort((a, b) => (a.ratePct ?? 99) - (b.ratePct ?? 99))[0];
  const bestFinance = decisions?.filter((d) => d.eligibleAmount > 0).sort((a, b) => b.eligibleAmount - a.eligibleAmount)[0];

  const num = "num font-semibold";

  return (
    <div className="space-y-4">
      <div className="anim-up flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[24px] tracking-tight">Decision Engine</h1>
          <p className="text-[12.5px] text-ink-soft mt-0.5">Enter the client once → the engine evaluates every bank product, explains each verdict, and ranks the options.</p>
        </div>
        <div className="flex gap-1 border border-mist rounded-lg p-1 bg-card">
          {([{ id: "evaluate", l: "Evaluate" }, { id: "snapshots", l: `Snapshots (${state.decisionSnapshots.length})` }, ...(isAdmin ? [{ id: "golden", l: "Golden tests" }] : [])] as { id: typeof tab; l: string }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cx("focusable px-3 py-1.5 rounded-md text-[12px] font-display font-bold transition-all", tab === t.id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink")}>{t.l}</button>
          ))}
        </div>
      </div>

      {tab === "evaluate" && (
        <div className="grid lg:grid-cols-12 gap-4">
          {/* client input */}
          <div className="lg:col-span-4 anim-up bg-card border border-mist rounded-lg p-4 self-start">
            <p className="font-display font-bold text-[14px] tracking-tight mb-3">Normalized client profile</p>
            <Field label="Load from People">
              <Select value={personId} onChange={loadPerson} options={[{ v: "", l: "— enter manually —" }, ...state.persons.map((p) => ({ v: p.id, l: p.name }))]} />
            </Field>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2"><Field label="Name"><TextInput value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Client name" /></Field></div>
              <Field label="Nationality"><TextInput value={profile.nationality} onChange={(e) => setProfile({ ...profile, nationality: e.target.value })} /></Field>
              <Field label="Age"><NumInput value={profile.age} onChange={(n) => setProfile({ ...profile, age: n })} suffix="yrs" /></Field>
              <Field label="Customer type"><Select value={profile.customerType} onChange={(v) => setProfile({ ...profile, customerType: v as CustomerType, residency: v === "NON_RESIDENT" ? "NON_RESIDENT" : "RESIDENT" })} options={[{ v: "NATIONAL", l: "National" }, { v: "EXPAT", l: "Expat" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
              <Field label="Employment"><Select value={profile.employment} onChange={(v) => setProfile({ ...profile, employment: v as Employment })} options={[{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self Emp" }]} /></Field>
              <Field label="Monthly income"><NumInput value={profile.monthlyIncome} onChange={(n) => setProfile({ ...profile, monthlyIncome: n })} suffix="AED" /></Field>
              <Field label="Other income"><NumInput value={profile.otherIncome} onChange={(n) => setProfile({ ...profile, otherIncome: n })} suffix="AED" /></Field>
              <Field label="Liabilities /mo"><NumInput value={profile.monthlyLiabilities} onChange={(n) => setProfile({ ...profile, monthlyLiabilities: n })} suffix="AED" /></Field>
              <Field label="Card limits"><NumInput value={profile.creditCardLimits} onChange={(n) => setProfile({ ...profile, creditCardLimits: n })} suffix="AED" /></Field>
              <Field label="Property value"><NumInput value={profile.propertyValue} onChange={(n) => setProfile({ ...profile, propertyValue: n })} suffix="AED" /></Field>
              <Field label="Loan requested"><NumInput value={profile.loanRequested} onChange={(n) => setProfile({ ...profile, loanRequested: n })} suffix="AED" /></Field>
              <Field label="Finance count"><Select value={String(profile.financeCount)} onChange={(v) => setProfile({ ...profile, financeCount: v === "2" ? 2 : 1 })} options={[{ v: "1", l: "1st" }, { v: "2", l: "2nd+" }]} /></Field>
              <Field label="Sector"><TextInput value={profile.sector} onChange={(e) => setProfile({ ...profile, sector: e.target.value })} placeholder="optional" /></Field>
            </div>

            {/* credit group */}
            <p className="text-[10px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mt-4 mb-2">Credit</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="AECB score"><NumInput value={profile.aecbScore ?? 0} onChange={(n) => setProfile({ ...profile, aecbScore: n || undefined })} /></Field>
              <Field label="Dependants"><NumInput value={profile.dependants ?? 0} onChange={(n) => setProfile({ ...profile, dependants: n || undefined })} /></Field>
              <Field label="Negative bureau?"><Select value={profile.negativeBureau ? "1" : "0"} onChange={(v) => setProfile({ ...profile, negativeBureau: v === "1" || undefined })} options={[{ v: "0", l: "No" }, { v: "1", l: "Yes" }]} /></Field>
            </div>

            {/* self-employed group (shown only when relevant) */}
            {profile.employment === "SELF_EMPLOYED" && (
              <div className="anim-tick">
                <p className="text-[10px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mt-4 mb-2">Self-employed</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Business age (LOB)"><NumInput value={profile.lobYears ?? 0} onChange={(n) => setProfile({ ...profile, lobYears: n || undefined })} suffix="yrs" /></Field>
                  <Field label="Service (LOS)"><NumInput value={profile.losMonths ?? 0} onChange={(n) => setProfile({ ...profile, losMonths: n || undefined })} suffix="mo" /></Field>
                  <Field label="Low doc?"><Select value={profile.lowDoc ? "1" : "0"} onChange={(v) => setProfile({ ...profile, lowDoc: v === "1" || undefined })} options={[{ v: "0", l: "Full doc" }, { v: "1", l: "Low doc" }]} /></Field>
                </div>
              </div>
            )}

            {/* property & transaction group */}
            <p className="text-[10px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mt-4 mb-2">Property & transaction</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Use"><Select value={profile.propertyUse ?? "OWNER_OCCUPIED"} onChange={(v) => setProfile({ ...profile, propertyUse: v as ClientProfile["propertyUse"] })} options={[{ v: "OWNER_OCCUPIED", l: "Owner-occupied" }, { v: "INVESTMENT", l: "Investment" }]} /></Field>
              <Field label="Status"><Select value={profile.propertyStatus ?? "READY"} onChange={(v) => setProfile({ ...profile, propertyStatus: v as ClientProfile["propertyStatus"] })} options={[{ v: "READY", l: "Ready" }, { v: "OFF_PLAN", l: "Off plan" }, { v: "UNDER_CONSTRUCTION", l: "Under construction" }, { v: "LAND", l: "Land" }]} /></Field>
              <Field label="Valuation"><NumInput value={profile.valuation ?? 0} onChange={(n) => setProfile({ ...profile, valuation: n || undefined })} suffix="AED" /></Field>
              <Field label="Transaction"><Select value={profile.txType ?? "PURCHASE"} onChange={(v) => setProfile({ ...profile, txType: v as ClientProfile["txType"] })} options={[{ v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + equity" }, { v: "EQUITY", l: "Equity release" }]} /></Field>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Btn onClick={evaluate}><Ic n="spark" size={15} /> Evaluate all banks</Btn>
              {decisions && <Btn variant="outline" onClick={saveSnapshot}><Ic n="lock" size={13} /> Save decision snapshot</Btn>}
            </div>
            <p className="text-[10.5px] text-ink-soft mt-3 num">resolver v{RESOLVER_VERSION} · EIBOR 3M {eibor.m3}% ({fmtDate(eibor.date)})</p>
          </div>

          {/* results */}
          <div className="lg:col-span-8 space-y-4">
            {decisions ? (
              <>
                <div className="anim-up grid grid-cols-3 gap-3">
                  <div className="bg-pine-50 border border-pine-200 rounded-lg px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-pine-700 font-display font-bold">Eligible products</p>
                    <p className="num font-bold text-[24px] text-pine-800 mt-0.5">{eligibleCount}<span className="text-[13px] text-pine-700">/{decisions.length}</span></p>
                  </div>
                  <div className="bg-card border border-mist rounded-lg px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft font-display font-bold">Best rate</p>
                    <p className="num font-bold text-[24px] mt-0.5">{bestRate?.ratePct != null ? fmtPct(bestRate.ratePct, 2) : "—"}</p>
                    {bestRate && <p className="text-[10px] text-ink-soft truncate">{state.banks.find((b) => b.id === bestRate.bankId)?.short}</p>}
                  </div>
                  <div className="bg-card border border-mist rounded-lg px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft font-display font-bold">Highest finance</p>
                    <p className="num font-bold text-[24px] mt-0.5">{bestFinance ? fmtAED(bestFinance.eligibleAmount) : "—"}</p>
                    {bestFinance && <p className="text-[10px] text-ink-soft truncate">{state.banks.find((b) => b.id === bestFinance.bankId)?.short}</p>}
                  </div>
                </div>

                <div className="anim-up flex items-center justify-between" style={{ animationDelay: "60ms" }}>
                  <p className="text-[12px] text-ink-soft">Rank by weighting profile:</p>
                  <div className="flex gap-1.5">
                    {state.weightingProfiles.map((w) => (
                      <button key={w.id} onClick={() => { setWeightId(w.id); if (decisions) setDecisions(rankDecisions(decisions, w.weights)); }}
                        className={cx("focusable px-2.5 py-1 rounded-full border text-[11px] font-display font-bold transition-all", weightId === w.id ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft hover:border-ink/40")}>{w.name}</button>
                    ))}
                  </div>
                </div>

                <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto" style={{ animationDelay: "100ms" }}>
                  <table className="w-full text-[12.5px] min-w-[820px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                        <th className="px-4 py-2.5 font-semibold">Bank / Product</th>
                        <th className="px-3 py-2.5 font-semibold">Verdict</th>
                        <th className="px-3 py-2.5 font-semibold">Max finance</th>
                        <th className="px-3 py-2.5 font-semibold">LTV</th>
                        <th className="px-3 py-2.5 font-semibold">DBR</th>
                        <th className="px-3 py-2.5 font-semibold">Rate</th>
                        <th className="px-3 py-2.5 font-semibold">Fees</th>
                        <th className="px-3 py-2.5 font-semibold">TAT</th>
                        <th className="px-3 py-2.5 font-semibold">Score</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {decisions.map((d) => {
                        const bank = state.banks.find((b) => b.id === d.bankId);
                        const open = expanded === d.productDefId;
                        return (
                          <FragmentRow key={d.productDefId} d={d} bankShort={bank?.short ?? d.bankId} open={open} onToggle={() => setExpanded(open ? null : d.productDefId)} />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="anim-up bg-card border border-mist rounded-lg px-6 py-16 text-center">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-pine-100 text-pine-700 mb-3"><Ic n="spark" size={24} /></span>
                <p className="font-display font-bold text-[16px]">Run the engine</p>
                <p className="text-[12.5px] text-ink-soft mt-1 max-w-sm mx-auto">Fill the client profile (or load from People) and evaluate — every product is judged against the bank rule engine, with each verdict fully explained.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "snapshots" && (
        <div className="anim-up space-y-3">
          {state.decisionSnapshots.length === 0 && (
            <div className="bg-card border border-mist rounded-lg px-6 py-14 text-center">
              <Ic n="lock" size={24} className="mx-auto text-ink-soft/50" />
              <p className="font-display font-bold text-[15px] mt-2">No snapshots yet</p>
              <p className="text-[12px] text-ink-soft mt-1">Evaluate a client and save the decision — the exact rule versions and EIBOR fix are frozen for replay.</p>
            </div>
          )}
          {state.decisionSnapshots.map((s) => (
            <div key={s.id} className="bg-card border border-mist rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-[14px]">{s.client.name || "Unnamed client"} <span className="num text-[11px] text-ink-soft font-normal">· {fmtDate(s.at.slice(0, 10))} · by {state.users.find((u) => u.id === s.by)?.name ?? s.by}</span></p>
                  <p className="num text-[11px] text-ink-soft mt-0.5">resolver v{s.resolverVersion} · EIBOR 3M {s.eiborFix.m3}% · {s.ruleVersions.length} rules pinned · {s.decisions.length} products</p>
                </div>
                <Btn size="sm" variant="outline" onClick={() => setReplayFor(replayFor?.id === s.id ? null : s)}><Ic n="refresh" size={13} /> {replayFor?.id === s.id ? "Hide replay" : "Replay vs today"}</Btn>
              </div>
              {replayFor?.id === s.id && (() => {
                const r = replayDecision(s, state.productDefs, state.rules, state.promos, todayISO());
                return (
                  <div className={cx("mt-3 rounded-lg px-4 py-3 border", r.changed ? "bg-amber-100/50 border-amber-500/40" : "bg-pine-100/50 border-pine-200")}>
                    <p className={cx("font-display font-bold text-[13px]", r.changed ? "text-amber-700" : "text-pine-800")}>
                      {r.changed ? `Rule drift detected — ${r.diffs.length} difference(s) since the snapshot` : "No drift — replaying with the snapshot's EIBOR fix reproduces the identical decision."}
                    </p>
                    {r.diffs.map((df, i) => {
                      const pd = state.productDefs.find((p) => p.id === df.productDefId);
                      return <p key={i} className="num text-[11.5px] mt-1.5">{pd?.name ?? df.productDefId}: {df.field} was <strong>{df.was}</strong>, now <strong>{df.now}</strong></p>;
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {tab === "golden" && goldenResults && (
        <div className="anim-up space-y-3">
          <div className="bg-card border border-mist rounded-lg p-4">
            <p className="font-display font-bold text-[14px] tracking-tight">Golden test gate</p>
            <p className="text-[12px] text-ink-soft mt-0.5">Known client → expected verdict pairs. Run before activating a new rule set — any unexpected change blocks the rollout.</p>
          </div>
          {goldenResults.map((g) => (
            <div key={g.caseId} className={cx("bg-card border rounded-lg p-4", g.pass ? "border-pine-200" : "border-rust-500/50")}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-[13.5px]">{g.caseName}</p>
                  <p className="num text-[10.5px] text-ink-soft mt-0.5">{g.caseId} · {state.goldenCases.find((c) => c.id === g.caseId)?.note ?? ""}</p>
                </div>
                <Pill tone={g.pass ? "pine" : "rust"} dot>{g.pass ? "PASS" : `FAIL — ${g.diffs.length} diff`}</Pill>
              </div>
              {!g.pass && g.diffs.map((df, i) => {
                const pd = state.productDefs.find((p) => p.id === df.productDefId);
                return (
                  <div key={i} className="mt-2.5 rounded-md bg-rust-100/40 border border-rust-500/30 px-3 py-2">
                    <p className="text-[12px]"><strong>{pd?.name}</strong>: expected <Pill tone="pine">{df.expected}</Pill> but got <Pill tone="rust">{df.actual}</Pill></p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- comparison row + explainable expansion ---------- */
function FragmentRow({ d, bankShort, open, onToggle }: { d: ProductDecision; bankShort: string; open: boolean; onToggle: () => void }) {
  const { state } = useStore();
  const m = VERDICT_META[d.verdict];
  return (
    <>
      <tr onClick={onToggle} className={cx("border-b border-mist/60 cursor-pointer transition-colors", open ? "bg-pine-50/60" : "hover:bg-pine-50/40", d.eligibleAmount <= 0 && "opacity-70")}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-ink text-paper font-display font-bold text-[11px] flex items-center justify-center shrink-0">{bankShort.slice(0, 3)}</span>
            <div>
              <p className="font-semibold text-[12.5px]">{d.productName}</p>
              <p className="num text-[10px] text-ink-soft">{bankShort} · v{d.productVersion}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3"><VerdictPill v={d.verdict} /></td>
        <td className="px-3 py-3 num font-bold text-pine-700">{d.eligibleAmount > 0 ? fmtAED(d.eligibleAmount) : "—"}</td>
        <td className="px-3 py-3 num">{d.ltvPct ? fmtPct(d.ltvPct, 0) : "—"}</td>
        <td className="px-3 py-3 num">{d.dbrPct ? fmtPct(d.dbrPct, 1) : "—"}</td>
        <td className="px-3 py-3 num">{d.ratePct != null ? fmtPct(d.ratePct, 2) : "—"}</td>
        <td className="px-3 py-3 num">{d.fees ? fmtAED(d.fees) : "—"}</td>
        <td className="px-3 py-3 num">{d.tatDays != null ? `${d.tatDays}d` : "—"}</td>
        <td className="px-3 py-3"><span className={cx("num font-bold", d.score >= 70 ? "text-pine-700" : d.score > 0 ? "text-ink" : "text-ink-soft")}>{d.score > 0 ? d.score : "—"}</span></td>
        <td className="px-3 py-3"><Ic n={open ? "chevD" : "chevR"} size={14} className="text-ink-soft" /></td>
      </tr>
      {open && (
        <tr className="border-b border-mist/60 bg-paper/50">
          <td colSpan={10} className="px-4 py-4">
            <div className="grid lg:grid-cols-3 gap-4 anim-tick">
              {/* why / why not */}
              <div className="bg-card border border-mist rounded-lg p-3.5">
                <p className="font-display font-bold text-[12.5px] mb-2 flex items-center gap-1.5"><Ic n={m.icon} size={14} /> {d.verdict === "NOT_ELIGIBLE" || d.verdict === "REFER" ? "Why not eligible" : "Why eligible"}</p>
                <div className="space-y-2">
                  {(d.headlineFindings.length ? d.headlineFindings : d.findings.slice(0, 3)).map((f, i) => (
                    <div key={i} className="border-l-2 pl-2.5 py-0.5" style={{ borderColor: f.severity === "BLOCK" ? "var(--color-rust-500)" : f.severity === "WARN" ? "var(--color-amber-500)" : "var(--color-pine-500)" }}>
                      <p className="text-[12px] font-medium">{f.message}</p>
                      {(f.previousValue || f.resultingValue) && <p className="num text-[10.5px] text-ink-soft">{f.previousValue ? `${f.previousValue} → ` : ""}{f.resultingValue ?? ""}</p>}
                      {(f.ruleId || f.source) && <p className="num text-[10px] text-ink-soft/70">rule: {f.ruleId ? `${state.rules.find((r) => r.id === f.ruleId)?.code ?? f.ruleId} v${f.ruleVersion}` : f.source}</p>}
                    </div>
                  ))}
                  {d.findings.length > 3 && (
                    <details className="text-[11px]">
                      <summary className="focusable cursor-pointer text-pine-700 font-display font-bold">All {d.findings.length} findings</summary>
                      <div className="mt-1.5 space-y-1.5">
                        {d.findings.slice(3).map((f, i) => (
                          <p key={i} className="text-[11px] text-ink-soft">· {f.message}{f.resultingValue ? ` (${f.resultingValue})` : ""}</p>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
              {/* remediations */}
              <div className="bg-card border border-mist rounded-lg p-3.5">
                <p className="font-display font-bold text-[12.5px] mb-2 flex items-center gap-1.5"><Ic n="target" size={14} /> What would make it eligible</p>
                {d.remediations.length ? (
                  <div className="space-y-2">
                    {d.remediations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={cx("num text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0 mt-0.5", r.effort === 1 ? "bg-pine-100 text-pine-800" : r.effort === 2 ? "bg-amber-100 text-amber-700" : "bg-rust-100 text-rust-700")}>effort {r.effort}</span>
                        <div>
                          <p className="text-[12px] font-medium">{r.message}</p>
                          <p className="num text-[10.5px] text-ink-soft">{r.current}{r.required ? ` → ${r.required}` : ""}{r.delta ? ` (Δ ${r.delta})` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[11.5px] text-ink-soft">No changes needed — this product fits the client as-is.</p>}
              </div>
              {/* fired rules */}
              <div className="bg-card border border-mist rounded-lg p-3.5">
                <p className="font-display font-bold text-[12.5px] mb-2 flex items-center gap-1.5"><Ic n="scale" size={14} /> Rules that decided this</p>
                {d.firedRules.length ? (
                  <div className="space-y-2.5">
                    {d.firedRules.map((r, i) => (
                      <div key={i}>
                        <p className="text-[12px]"><span className="font-bold text-pine-700">winner:</span> {r.winner.refLabel} = <span className="num font-semibold">{r.winner.value}</span> <span className="num text-[10px] text-ink-soft">({r.winner.source}, {r.winner.axesMatched} axis)</span></p>
                        {r.overridden.map((o, j) => (
                          <p key={j} className="text-[10.5px] text-ink-soft num pl-3">↳ {o.refLabel} = {o.value} lost — {o.reason}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[11.5px] text-ink-soft">Pricing came from the product grid; no global rule slot was contested.</p>}
                {d.conditions.length > 0 && (
                  <div className="mt-2.5 border-t border-mist pt-2">
                    {d.conditions.map((cnd, i) => <p key={i} className="text-[11px] text-amber-700">· {cnd}</p>)}
                  </div>
                )}
              </div>
            </div>
            <p className="num text-[10px] text-ink-soft mt-3">recipe: {d.rateRecipe} · resolved against today's EIBOR fix</p>
          </td>
        </tr>
      )}
    </>
  );
}
