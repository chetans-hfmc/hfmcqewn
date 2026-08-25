import { useState } from "react";
import { BATCHES, type GBlock } from "../guideData";
import { Ic, cx } from "../ui";

const CALLOUT: Record<string, string> = {
  control: "border-l-ink bg-ink/[0.04]",
  source: "border-l-amber-500 bg-amber-100/40",
  rule: "border-l-pine-600 bg-pine-50/70",
  security: "border-l-rust-600 bg-rust-100/40",
  important: "border-l-rust-600 bg-rust-100/40",
};

function Block({ b }: { b: GBlock }) {
  switch (b.t) {
    case "p":
      return <p className="text-[13px] leading-relaxed text-ink/90 my-2.5">{b.x}</p>;
    case "table":
      return (
        <div className="overflow-x-auto border border-mist rounded-md my-3">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft bg-paper/70 border-b border-mist">
              {b.head.map((h) => <th key={h} className="px-3.5 py-2 font-semibold whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-b border-mist/60 last:border-0 align-top hover:bg-pine-50/30 transition-colors">
                  {r.map((c, j) => <td key={j} className={cx("px-3.5 py-2.5", j === 0 && "font-semibold")}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <div className={cx("border border-mist border-l-[3px] rounded-r-lg px-4 py-3 my-3.5", CALLOUT[b.kind])}>
          <p className="font-display font-bold text-[10.5px] uppercase tracking-[0.13em] text-ink-soft mb-1">{b.title}</p>
          <p className="text-[12.5px] leading-relaxed text-ink">{b.x}</p>
        </div>
      );
    case "steps":
      return (
        <ol className="my-3 space-y-1.5">
          {b.items.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink/90">
              <span className="num shrink-0 w-5 h-5 rounded-full bg-pine-700 text-paper text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      );
    case "checklist":
      return (
        <ul className="my-3 grid sm:grid-cols-2 gap-x-5 gap-y-1.5">
          {b.items.map((s, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-ink/90">
              <span className="shrink-0 mt-0.5 w-3.5 h-3.5 rounded-sm border border-pine-500 flex items-center justify-center"><Ic n="check" size={9} className="text-pine-600" /></span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      );
    case "cards":
      return (
        <div className="grid sm:grid-cols-2 gap-3 my-3">
          {b.items.map((c) => (
            <div key={c.t} className="border border-mist rounded-lg p-3.5 hover:border-pine-400 hover:shadow-sm transition-all">
              <p className="font-display font-bold text-[12.5px] tracking-tight text-pine-700">{c.t}</p>
              <p className="text-[11.5px] text-ink-soft leading-relaxed mt-1">{c.d}</p>
            </div>
          ))}
        </div>
      );
    case "flow":
      return (
        <div className="my-3 ml-1">
          {b.items.map((s, i, arr) => (
            <div key={s}>
              <div className={cx("inline-flex items-center gap-2.5 border rounded-md px-3.5 py-1.5 hover:shadow-sm transition-all",
                i === arr.length - 1 ? "bg-pine-700 border-pine-700 text-paper" : "bg-card border-mist")}>
                <span className={cx("num text-[9.5px] font-bold", i === arr.length - 1 ? "text-paper/70" : "text-pine-700")}>{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display font-bold text-[11px] tracking-[0.04em]">{s}</span>
              </div>
              {i < arr.length - 1 && <div className="ml-5 w-px h-3 bg-pine-400" />}
            </div>
          ))}
        </div>
      );
  }
}

export default function GuideView() {
  const [batch, setBatch] = useState(1);
  const active = BATCHES.find((b) => b.n === batch)!;
  return (
    <div className="max-w-[1080px] mx-auto">
      {/* cover */}
      <div className="bg-ink text-paper rounded-lg px-7 py-6 mb-4 anim-up relative overflow-hidden sidebar-texture">
        <div className="flex flex-wrap items-start justify-between gap-4 relative">
          <div>
            <p className="text-[10.5px] font-display font-semibold uppercase tracking-[0.16em] text-pine-300">HFMC · Document Control</p>
            <h1 className="font-display font-bold text-[28px] tracking-tight mt-1.5 leading-tight">Mortgage Operations Guide Book</h1>
            <p className="text-[13px] text-paper/70 mt-2 max-w-[560px]">8-batch operating manual. All 8 batches are live; every chapter also activates controls in the case engine, Rule Centre, Bank Matrix, QC checklists, TAT monitor and Desk Tools.</p>
            <div className="flex flex-wrap gap-1.5 mt-3.5">
              {["Complete", "Foundation → Transfer", "FOL, signing & liability", "Final transfer & Title Deed QC", "Master appendix & desk tools"].map((t) => (
                <span key={t} className="text-[10px] font-display font-semibold tracking-wide uppercase border border-paper/25 rounded-full px-2.5 py-1 text-paper/80">{t}</span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <Ic n="book" size={54} className="text-pine-300/80" />
            <p className="num text-[11px] text-paper/60 mt-2">Design standard retained<br />across all 8 batches</p>
          </div>
        </div>
      </div>

      <div className="border border-amber-500/40 border-l-[3px] bg-amber-100/40 rounded-r-lg px-4 py-3 mb-4 anim-up">
        <p className="font-display font-bold text-[10.5px] uppercase tracking-[0.13em] text-amber-700 mb-1">Source control</p>
        <p className="text-[12.5px] leading-relaxed text-ink">This guide consolidates supplied information. Bank-specific or historical requirements are <strong>source-derived controls</strong> — confirm them against the bank / current internal instruction before live use.</p>
      </div>

      {/* batch tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
        {BATCHES.map((b) => (
          <button key={b.n} onClick={() => setBatch(b.n)}
            className={cx("focusable shrink-0 text-[11.5px] font-display font-semibold px-3.5 py-2 rounded-md border transition-all flex items-center gap-2",
              batch === b.n ? "bg-pine-700 border-pine-700 text-paper shadow-sm" : "bg-card border-mist text-ink-soft hover:border-pine-400")}>
            <span className="num text-[10px] opacity-70">B{b.n}</span>
            <span className="max-w-[220px] truncate">{b.title}</span>
            <span className={cx("w-1.5 h-1.5 rounded-full", b.status === "current" ? "bg-pine-400" : "bg-gr-300")} />
          </button>
        ))}
      </div>

      {active.chapters.length === 0 ? (
        <div className="bg-card border border-mist rounded-lg px-7 py-12 text-center anim-up">
          <Ic n="book" size={40} className="text-gr-300 mx-auto" />
          <p className="font-display font-bold text-[16px] tracking-tight mt-3">Batch {active.n} — {active.title}</p>
          <p className="text-[13px] text-ink-soft mt-1.5 max-w-md mx-auto">Planned. When this batch is supplied, its chapters will render here and its controls will activate in the case engine, Rule Centre and Bank Matrix.</p>
        </div>
      ) : (
        <>
          {/* ToC */}
          <div className="bg-card border border-mist rounded-lg px-5 py-4 mb-4 anim-up">
            <p className="font-display font-bold text-[13px] tracking-tight mb-2.5">Table of Contents — Batch {active.n}</p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {active.chapters.map((c) => (
                <a key={c.num} href={`#ch${c.num}`} className="focusable flex gap-2 text-[12.5px] text-ink-soft hover:text-pine-700 transition-colors py-0.5">
                  <span className="num text-pine-700 font-semibold w-6 shrink-0">{c.num}.</span><span>{c.title}</span>
                </a>
              ))}
            </div>
          </div>

          {/* chapters */}
          {active.chapters.map((c) => (
            <section key={c.num} id={`ch${c.num}`} className="bg-card border border-mist rounded-lg px-6 py-5 mb-4 anim-up scroll-mt-24">
              <div className="flex items-baseline gap-3.5 mb-3">
                <span className="font-display font-bold text-[30px] leading-none text-pine-700/90 num">{c.num}</span>
                <h2 className="font-display font-bold text-[19px] tracking-tight">{c.title}</h2>
              </div>
              {c.blocks.map((b, i) => <Block key={i} b={b} />)}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
