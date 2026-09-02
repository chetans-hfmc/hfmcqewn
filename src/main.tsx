import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/* Root error boundary — any rendering crash is caught here, shown with the
   exact message, and recoverable — the app never dies with a blank screen. */
class RootBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("HFMC MOS crash:", error, info.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef0e9", fontFamily: "'IBM Plex Sans', sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 620, background: "#fbfbf7", border: "1px solid #dfe3d8", borderRadius: 12, padding: 32, boxShadow: "0 20px 60px rgba(26,32,28,0.12)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#c0492f" }} />
              <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, letterSpacing: -0.3 }}>Something went wrong</h1>
            </div>
            <p style={{ margin: "0 0 14px", color: "#4c564f", fontSize: 13 }}>
              The app hit an unexpected error and recovered safely. Your data in this browser is untouched.
            </p>
            <pre style={{ background: "#20261f", color: "#dfe3d8", borderRadius: 8, padding: 14, fontSize: 11.5, lineHeight: 1.6, overflow: "auto", maxHeight: 180, whiteSpace: "pre-wrap" }}>
              {this.state.error.name}: {this.state.error.message}
            </pre>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                onClick={() => this.setState({ error: null })}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", background: "#0f553e", color: "#fbfbf7", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Try again
              </button>
              <button
                onClick={() => { try { localStorage.removeItem("hfmc-mos-state"); } catch { /* ignore */ } window.location.reload(); }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid #dfe3d8", background: "#fbfbf7", color: "#1a201c", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Reset data & reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <RootBoundary><App /></RootBoundary>
);
