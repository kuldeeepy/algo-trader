import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdvancedPage } from "./pages/AdvancedPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Icon } from "./components/Icon";
import { api } from "./lib/api";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

type Page = "backtest" | "live" | "settings";

const NAV: { id: Page; icon: string; label: string }[] = [
  { id: "backtest", icon: "spark",   label: "Backtest"   },
  { id: "live",     icon: "live",    label: "Live Sim"   },
  { id: "settings", icon: "sliders", label: "Settings"   },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const [expanded, setExpanded] = useState(false);
  const W = expanded ? 180 : 48;

  return (
    <aside style={{
      width: W, flexShrink: 0,
      background: "var(--surface-1)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      transition: "width 0.2s cubic-bezier(0.4,0,0.2,1)",
    }}>
      {/* Nav items */}
      <nav style={{ flex: 1, padding: "8px 0" }}>
        {NAV.map(n => {
          const active = page === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              title={!expanded ? n.label : undefined}
              style={{
                display: "flex", alignItems: "center",
                gap: 10, width: "100%",
                padding: expanded ? "0 14px" : "0",
                justifyContent: expanded ? "flex-start" : "center",
                height: 40,
                background: active ? "var(--surface-3)" : "transparent",
                borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                border: "none",
                color: active ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: 500,
                transition: "all 0.12s",
                whiteSpace: "nowrap", overflow: "hidden",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <Icon
                name={n.icon}
                size={15}
                color={active ? "var(--accent-hi)" : "currentColor"}
              />
              {expanded && (
                <span style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.15s" }}>
                  {n.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Toggle expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        title={expanded ? "Collapse" : "Expand"}
        style={{
          display: "flex", alignItems: "center",
          justifyContent: expanded ? "flex-end" : "center",
          gap: 8, padding: expanded ? "0 12px" : "0",
          height: 40,
          background: "transparent", border: "none",
          borderTop: "1px solid var(--border-soft)",
          color: "var(--text-faint)", cursor: "pointer",
          transition: "all 0.12s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--text-muted)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-faint)")}
      >
        <span style={{ transform: expanded ? "rotate(90deg)" : "rotate(-90deg)", transition: "transform 0.2s", display: "inline-flex" }}>
          <Icon name="chevron-r" size={12} />
        </span>
      </button>
    </aside>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  const [time, setTime]   = useState(() => new Date());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.marketStatus().then(s => setIsOpen(s.label === "Open")).catch(() => {});
  }, []);

  return (
    <header style={{
      height: 46, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 14px 0 16px",
      background: "var(--surface-1)",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4,
          background: "var(--accent)", color: "#1A1308",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 11,
          fontFamily: "JetBrains Mono, monospace",
          letterSpacing: "-0.02em",
          boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset",
        }}>α</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "-0.005em" }}>ALPHASCOPE</span>
          <span className="caps" style={{ fontSize: 8, marginTop: 1 }}>nse · intraday research</span>
        </div>
      </div>

      {/* Market status + clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, color: "var(--text-muted)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="live-dot" style={{ background: isOpen ? "var(--profit)" : "var(--text-dim)" }} />
          <span className="caps" style={{ color: isOpen ? "var(--profit)" : "var(--text-dim)" }}>
            {isOpen ? "NSE · OPEN" : "NSE · CLOSED"}
          </span>
        </div>
        <span className="num tabular">
          {time.toLocaleTimeString("en-IN", { hour12: false })}
        </span>
      </div>
    </header>
  );
}

// ── Live stub ─────────────────────────────────────────────────────────────────

function LiveStub() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 40 }}>
      <Icon name="live" size={28} color="var(--text-faint)" />
      <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>Live Simulation</div>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)", textAlign: "center", maxWidth: 380, lineHeight: 1.7 }}>
        Live simulation uses real-time tick data to validate strategies before going live. Coming soon.
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("backtest");

  return (
    <QueryClientProvider client={qc}>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", color: "var(--text)", overflow: "hidden" }}>
        <Header />
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <Sidebar page={page} setPage={setPage} />
          <main style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0 }}>
            {page === "backtest"  && <AdvancedPage />}
            {page === "live"      && <LiveStub />}
            {page === "settings"  && <SettingsPage />}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
