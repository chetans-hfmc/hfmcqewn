import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root")!;

/* Always-visible fallback so the preview can never be blank, even if the app
   module itself fails to load. Errors are shown in-page for diagnosis. */
function fatal(title: string, detail: string) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  rootEl.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#eef0e9;font-family:\'IBM Plex Sans\',sans-serif;">' +
    '<div style="max-width:560px;width:100%;background:#fbfbf7;border:1px solid #c0492f66;border-radius:10px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,.12);">' +
    '<div style="background:#a63a24;color:#fff;padding:14px 20px;font-weight:700;font-size:14px;">HFMC MOS — startup error</div>' +
    '<div style="padding:20px;">' +
    '<p style="margin:0 0 10px;font-size:13px;color:#4c564f;">' + esc(title) + ". Clearing the saved demo data usually fixes this.</p>" +
    '<pre style="background:#1a201c;color:#e6e8e2;border-radius:8px;padding:12px 14px;font-size:11px;line-height:1.5;overflow:auto;white-space:pre-wrap;margin:0 0 14px;">' + esc(detail) + "</pre>" +
    '<button onclick="try{localStorage.clear()}catch(e){};location.reload()" style="background:#146b4e;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;">Clear data &amp; reload</button>' +
    "</div></div></div>";
}

/* Capture errors that happen outside React (including module-load failures). */
window.addEventListener("error", (e) => {
  fatal("Runtime error", (e.error && (e.error.stack || e.error.message)) || e.message || "Unknown error");
});
window.addEventListener("unhandledrejection", (e) => {
  const r: any = e.reason;
  fatal("Unhandled promise rejection", (r && (r.stack || r.message)) || String(r));
});

/* Load the app module dynamically so an import-time crash is caught here. */
import("./App")
  .then(({ default: App }) => {
    ReactDOM.createRoot(rootEl).render(React.createElement(App));
  })
  .catch((err: any) => {
    fatal("Application module failed to load", (err && (err.stack || err.message)) || String(err));
  });
