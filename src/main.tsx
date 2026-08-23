/* Entry hardening — the preview must never go blank.
 * - Fatal (app failed to load/boot): blocking diagnostic panel with "Clear data & reload".
 * - Harmless infra noise (Vite HMR / WebSocket in the sandboxed preview): ignored.
 * - Stray runtime errors after a good boot: small toast, app stays mounted. */

import "./index.css";

const ignorable = (msg: string) =>
  /@vite\/client|WebSocket|HMR|hot update|vite\.io|networkerror/i.test(msg);

const PANEL_CSS = `position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#eef0e9;font-family:'IBM Plex Sans',system-ui,sans-serif;padding:24px;z-index:9999`;
const CARD_CSS = `max-width:560px;width:100%;background:#fbfbf7;border:1px solid rgba(192,73,47,.45);border-radius:10px;box-shadow:0 18px 50px rgba(26,32,28,.16);overflow:hidden`;
const HEAD_CSS = `background:#a63a24;color:#fff;padding:14px 20px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;letter-spacing:-.01em`;
const BODY_CSS = `padding:20px;font-size:13px;line-height:1.55;color:#4c564f`;
const CODE_CSS = `display:block;margin:12px 0;background:#1a201c;color:#e6e8e3;border-radius:6px;padding:12px 14px;font-family:'IBM Plex Mono',monospace;font-size:11.5px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto`;
const BTN_CSS = `border:0;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:12.5px;border-radius:7px;padding:9px 16px;transition:transform .12s ease,box-shadow .12s ease`;

function fatalPanel(title: string, message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML =
    `<div style="${PANEL_CSS}"><div style="${CARD_CSS}">` +
    `<div style="${HEAD_CSS}">⚠ ${title}</div>` +
    `<div style="${BODY_CSS}">` +
    `<p>This screen replaces a blank preview so you can always see what happened. Clearing the saved demo data almost always fixes it.</p>` +
    `<code style="${CODE_CSS}"></code>` +
    `<div style="display:flex;gap:10px">` +
    `<button id="__hfmc_reset" style="${BTN_CSS};background:#1a201c;color:#fbfbf7">Clear data &amp; reload</button>` +
    `<button id="__hfmc_reload" style="${BTN_CSS};background:transparent;color:#4c564f;border:1px solid #dfe3d8">Just reload</button>` +
    `</div></div></div></div>`;
  root.querySelector("code")!.textContent = message;
  const clear = () => { try { localStorage.removeItem("hfmc-mos-state"); } catch { /* ignore */ } window.location.reload(); };
  root.querySelector("#__hfmc_reset")!.addEventListener("click", clear);
  root.querySelector("#__hfmc_reload")!.addEventListener("click", () => window.location.reload());
}

/* Non-blocking toast for stray errors after the app is alive */
let booted = false;
function toast(msg: string) {
  if (!booted) return;
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:9998;max-width:380px;background:#1a201c;color:#e6e8e3;border-left:3px solid #c07d12;border-radius:8px;padding:10px 14px;font:12px/1.5 'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 10px 30px rgba(26,32,28,.28);cursor:pointer;animation:hfmcIn .25s ease both";
  el.title = "Click to dismiss";
  el.innerHTML = `<strong style="font-family:'Space Grotesk',sans-serif">Runtime note</strong><br><span style="color:#b9bfb8"></span>`;
  el.querySelector("span")!.textContent = msg.slice(0, 160);
  el.onclick = () => el.remove();
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 9000);
}

window.addEventListener("error", (e) => {
  const msg = `${e.message ?? ""} ${e.filename ?? ""}`;
  if (ignorable(msg)) return; // Vite HMR / WebSocket noise in the preview sandbox
  if (!booted) fatalPanel("HFMC MOS failed to start", `${e.message}\n${e.filename}:${e.lineno}`);
  else toast(e.message ?? "Unknown error");
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e.reason && (e.reason as Error).message) ?? e.reason ?? "");
  if (ignorable(msg)) return;
  if (!booted) fatalPanel("HFMC MOS failed to start", msg);
  else toast(msg);
});

const style = document.createElement("style");
style.textContent = "@keyframes hfmcIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}";
document.head.appendChild(style);

Promise.all([import("./App"), import("react"), import("react-dom/client")])
  .then(([app, React, ReactDOM]) => {
    const root = ReactDOM.createRoot(document.getElementById("root")!);
    root.render(React.createElement(app.default));
    booted = true;
  })
  .catch((err: unknown) => {
    const e = err as Error;
    fatalPanel("HFMC MOS failed to load", `${e?.name ?? "Error"}: ${e?.message ?? err}`);
  });
