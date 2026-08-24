import { useMemo, useState } from "react";
import type { Case } from "../types";
import { ESC_LEVELS, escalationEmail, tatFor } from "../calc";
import { useNav, useStore } from "../store";
import { Avatar, Btn, Ic, Pill, Select, TextInput, cx, fmtDate, todayISO } from "../ui";

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
}

function LevelChip({ level, pulse }: { level: 0 | 1 | 2 | 3; pulse?: boolean }) {
  const m = ESC_LEVELS[level];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[10px] font-display font-bold tracking-[0.08em]", m.chip)}>
      <span className={cx("w-1.5 h-1.5 rounded-full", m.dot, pulse && level >= 2 && "pulse-dot")} />
      {m.tag}
    </span>
  );
}

export default function TatView() {
  const { state } = useStore();
  const nav = useNav();
  const [q, setQ] = useState("");
  const [lvl, setLvl] = useState("ALL");
  const [copied, setCopied] = useState("");
  const today = todayISO();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.cases
      .filter((c) => c.status === "OPEN")
      .map((c) => {
        const t = tatFor(c, c.stage, state.stages, today);
        return { c, t };
      })
      .filter(({ c, t }) => (lvl === "ALL" ? true : String(t.level) === lvl))
      .filter(({ c }) => {
        if (!needle) return true;
        const p = state.persons.find((x) => x.id === c.personId);
        return [p?.name, c.ref, c.bankRm].join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) => (b.t.level - a.t.level) || (b.t.daysOver - a.t.daysOver) || a.c.ref.localeCompare(b.c.ref));
  }, [state.cases, state.persons, state.stages, q, lvl, today]);

  const counts = useMemo(() => {
    const base = state.cases.filter((c) => c.status === "OPEN").map((c) => tatFor(c, c.stage, state.stages, today).level);
    return [0, 1, 2, 3].map((l) => base.filter((x) => x === l).length);
  }, [state.cases, state.stages, today]);

  const doCopy = async (c: Case, level: 1 | 2 | 3, stageName: string, daysOver: number) => {
    const client = state.persons.find((p) => p.id === c.personId)?.name ?? "";
    const bank = state.banks.find((b) => b.id === c.bankId)?.short ?? "";
    const em = escalationEmail(level, client, bank, stageName, c.ref, daysOver);
    await copyText(`Subject: ${em.subject}\n\n${em.body}`);
    setCopied(c.id + level);
    setTimeout(() => setCopied(""), 1600);
  };

  return (
    <div className="space-y-4">
      {/* header + live rule legend */}
      <div className="anim-up">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-pine-700">Transaction TAT Tracker · {fmtDate(today)}</p>
            <h1 className="font-display font-bold text-[26px] tracking-tight text-ink mt-0.5">Escalation Monitor</h1>
            <p className="text-[12.5px] text-ink-soft mt-1">Trigger date is set when a stage starts · target deadline = trigger + stage SLA · escalation rises automatically with each day overdue.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3.5">
          {ESC_LEVELS.map((m, i) => (
            <button key={m.level} onClick={() => setLvl(lvl === String(m.level) ? "ALL" : String(m.level))}
              className={cx("focusable text-left rounded-lg border px-3.5 py-3 transition-all anim-up",
                lvl === String(m.level) ? "border-ink shadow-md -translate-y-px" : "border-mist bg-card hover:border-ink/30 hover:-translate-y-px")}
              style={{ animationDelay: `${i * 55}ms` }}>
              <div className="flex items-center justify-between">
                <span className={cx("inline-flex items-center gap-1.5 text-[10px] font-display font-bold tracking-[0.09em] px-2 py-[3px] rounded", m.chip)}>
                  <span className={cx("w-1.5 h-1.5 rounded-full", m.dot)} />{m.tag}
                </span>
                <span className="num text-[22px] font-semibold leading-none">{counts[m.level]}</span>
              </div>
              <p className="text-[11.5px] font-semibold mt-2">{m.label}</p>
              <p className="text-[10.5px] text-ink-soft leading-snug mt-0.5">{m.who}{m.copied !== "—" ? ` → cc ${m.copied}` : ""}</p>
            </button>
          ))}
        </div>
      </div>

      {/* escalation quick reference */}
      <details className="anim-up group bg-card border border-mist rounded-lg overflow-hidden">
        <summary className="cursor-pointer select-none px-4 py-2.5 flex items-center justify-between hover:bg-paper/60 transition-colors">
          <span className="font-display font-bold text-[13px] tracking-tight">Escalation quick reference — who to contact at each level</span>
          <Ic n="chevD" size={15} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-mist overflow-x-auto">
          <table className="w-full text-[12px] min-w-[860px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft bg-paper/60">
              <th className="px-4 py-2 font-semibold">Level</th><th className="px-3 py-2 font-semibold">Triggered when</th><th className="px-3 py-2 font-semibold">Action</th><th className="px-3 py-2 font-semibold">Who sends</th><th className="px-3 py-2 font-semibold">Who is copied</th><th className="px-3 py-2 font-semibold">Purpose</th>
            </tr></thead>
            <tbody>
              {[
                { ...ESC_LEVELS[0], purpose: "Routine chasing — document in the audit trail" },
                { ...ESC_LEVELS[1], purpose: "Ensure the Team Leader is aware before it escalates further" },
                { ...ESC_LEVELS[2], purpose: "Department-head visibility — agree a recovery plan" },
                { ...ESC_LEVELS[3], purpose: "Ownership-level intervention to protect the transaction" },
              ].map((r) => (
                <tr key={r.level} className="border-t border-mist/70">
                  <td className="px-4 py-2.5"><LevelChip level={r.level} /></td>
                  <td className="px-3 py-2.5">{r.label}</td>
                  <td className="px-3 py-2.5">{r.action}</td>
                  <td className="px-3 py-2.5 font-medium">{r.who}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{r.copied}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{r.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-[11px] text-ink-soft bg-paper/50 border-t border-mist/70">
            Email wording is generated per case from the guide templates — use “Copy email” on any escalated row below.
          </p>
        </div>
      </details>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 anim-up">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"><Ic n="search" size={14} /></span>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client, ref, RM…" className="pl-8 w-[230px]" />
        </div>
        <Select value={lvl} onChange={setLvl} className="w-[170px]" options={[{ v: "ALL", l: "All levels" }, ...ESC_LEVELS.map((m) => ({ v: String(m.level), l: m.tag }))]} />
        <span className="text-[11.5px] text-ink-soft ml-auto"><strong className="num text-ink">{rows.length}</strong> open files in view · {counts[1] + counts[2] + counts[3]} escalated</span>
      </div>

      {/* board */}
      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[12.5px] min-w-[1060px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">File / Client</th>
              <th className="px-3 py-2.5 font-semibold">Stage</th>
              <th className="px-3 py-2.5 font-semibold">Trigger</th>
              <th className="px-3 py-2.5 font-semibold">Target deadline</th>
              <th className="px-3 py-2.5 font-semibold">Elapsed</th>
              <th className="px-3 py-2.5 font-semibold">Escalation</th>
              <th className="px-3 py-2.5 font-semibold">Conditions</th>
              <th className="px-3 py-2.5 font-semibold">Owner</th>
              <th className="px-3 py-2.5 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, t }, i) => {
              const person = state.persons.find((p) => p.id === c.personId);
              const bank = state.banks.find((b) => b.id === c.bankId);
              const stDef = state.stages.find((s) => s.id === c.stage);
              const owner = state.users.find((u) => u.id === c.ownerId);
              const conds = stDef?.conditions ?? [];
              const done = conds.filter((_, ci) => c.conditionsDone?.[`${c.stage}:${ci}`]).length;
              return (
                <tr key={c.id} className={cx("border-b border-mist/60 last:border-0 hover:bg-pine-50/40 cursor-pointer transition-colors anim-up",
                  t.level === 3 && "bg-rust-100/25")} style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}
                  onClick={() => nav.go("cases", { caseId: c.id, params: { tab: "tat" } })}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={person?.name ?? "?"} size={28} />
                      <div>
                        <p className="font-semibold leading-tight">{person?.name}{c.deal ? <span className="text-ink-soft font-medium"> · {c.deal}</span> : null}</p>
                        <p className="num text-[10.5px] text-pine-700 font-semibold">{c.ref} · {bank?.short}{c.bankRm ? ` · RM ${c.bankRm}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium">{stDef?.name}</td>
                  <td className="px-3 py-2.5 num">{t.trigger ? fmtDate(t.trigger) : <span className="text-rust-600 font-semibold">not set</span>}</td>
                  <td className="px-3 py-2.5 num">{t.target ? fmtDate(t.target) : "—"}</td>
                  <td className="px-3 py-2.5 num">
                    {!t.trigger ? "—" : t.daysOver > 0
                      ? <><strong>{t.elapsed}d</strong> <span className="text-rust-600 font-semibold">+{t.daysOver} over</span></>
                      : <><strong>{t.elapsed}d</strong> <span className="text-pine-700 font-semibold">in SLA</span></>}
                  </td>
                  <td className="px-3 py-2.5"><LevelChip level={t.level} pulse /></td>
                  <td className="px-3 py-2.5">
                    {conds.length
                      ? <span className={cx("num text-[11px] font-semibold px-1.5 py-0.5 rounded", done === conds.length ? "bg-pine-100 text-pine-800" : "bg-amber-100 text-amber-700")}>{done}/{conds.length}</span>
                      : <span className="text-ink-soft/60">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[11.5px]">{owner?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {t.level >= 1 && (
                      <Btn size="sm" variant={t.level >= 2 ? "dark" : "outline"} onClick={() => doCopy(c, t.level as 1 | 2 | 3, stDef?.name ?? c.stage, t.daysOver)}>
                        <Ic n={copied === c.id + t.level ? "check" : "copy"} size={12} />
                        {copied === c.id + t.level ? "Copied" : `L${t.level} email`}
                      </Btn>
                    )}
                    {t.level === 0 && <Pill tone="pine">on track</Pill>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-ink-soft">No files at this escalation level — good news.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
