import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { StrategyMeta, StrategyParam } from "../lib/api";
import { Icon } from "../components/Icon";

const REGIME_COLOR: Record<string, string> = {
  trending: "var(--regime-trend)",
  sideways: "var(--regime-side)",
  high_vol: "var(--regime-vol)",
};
const REGIME_LABEL: Record<string, string> = {
  trending: "Trending",
  sideways: "Sideways",
  high_vol: "High Vol",
};

function ParamRow({ param, value, onChange }: {
  param: StrategyParam; value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{param.label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: 80, accentColor: "var(--accent)" }}
        />
        <span className="num" style={{ fontSize: 11, color: "var(--text)", width: 32, textAlign: "right" }}>{value}</span>
      </div>
    </div>
  );
}

function StrategyCard({ strategy }: { strategy: StrategyMeta }) {
  const storageKey = `strategy_params_${strategy.id}`;
  const stored     = JSON.parse(localStorage.getItem(storageKey) ?? "null");

  const [expanded, setExpanded] = useState(false);
  const [params, setParams]     = useState<Record<string, number>>(
    stored ?? Object.fromEntries(Object.entries(strategy.params).map(([k, p]) => [k, p.default]))
  );
  const [enabled, setEnabled]   = useState(() => {
    const v = localStorage.getItem(`strategy_enabled_${strategy.id}`);
    return v === null ? true : v === "true";
  });

  function updateParam(key: string, val: number) {
    const next = { ...params, [key]: val };
    setParams(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(`strategy_enabled_${strategy.id}`, String(next));
  }

  function reset() {
    const defaults = Object.fromEntries(Object.entries(strategy.params).map(([k, p]) => [k, p.default]));
    setParams(defaults);
    localStorage.removeItem(storageKey);
  }

  const regColor = REGIME_COLOR[strategy.regime] ?? "var(--text-muted)";
  const hasParams = Object.keys(strategy.params).length > 0;

  return (
    <div className="panel" style={{
      borderLeft: `2px solid ${enabled ? regColor : "var(--border)"}`,
      transition: "border-color 0.15s",
      opacity: enabled ? 1 : 0.55,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>{strategy.name}</span>
            <span style={{
              fontSize: 9.5, padding: "1px 6px", borderRadius: 2,
              background: `color-mix(in oklab, ${regColor} 18%, transparent)`,
              border: `1px solid color-mix(in oklab, ${regColor} 35%, transparent)`,
              color: regColor, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              {REGIME_LABEL[strategy.regime] ?? strategy.regime}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            {strategy.description}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Enabled toggle */}
          <button
            onClick={toggleEnabled}
            style={{
              width: 36, height: 20, borderRadius: 10, border: "none",
              background: enabled ? "var(--accent)" : "var(--surface-4)",
              cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 2, left: enabled ? 18 : 2,
              width: 16, height: 16, borderRadius: 8,
              background: enabled ? "#1A1308" : "var(--text-dim)",
              transition: "left 0.15s",
            }} />
          </button>

          {/* Expand params */}
          {hasParams && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 2 }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
            >
              <span style={{ transform: expanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", display: "inline-flex" }}>
                <Icon name="chevron" size={12} />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Params panel */}
      {expanded && hasParams && (
        <div style={{ padding: "0 14px 12px", borderTop: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 4px" }}>
            <span className="caps">Parameters</span>
            <button
              onClick={reset}
              className="why-chip"
              style={{ fontSize: 9 }}
            >
              <Icon name="refresh" size={9} /> Reset defaults
            </button>
          </div>
          {Object.entries(strategy.params).map(([key, param]) => (
            <ParamRow
              key={key}
              param={param}
              value={params[key] ?? param.default}
              onChange={v => updateParam(key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddStrategyCard() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [regime, setRegime] = useState("trending");

  function save() {
    if (!name.trim()) return;
    const custom = JSON.parse(localStorage.getItem("custom_strategies") ?? "[]");
    custom.push({ id: `custom_${Date.now()}`, name: name.trim(), description: desc.trim(), regime, params: {} });
    localStorage.setItem("custom_strategies", JSON.stringify(custom));
    setName(""); setDesc(""); setOpen(false);
    // Trigger a re-render by reloading the page state
    window.location.reload();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "16px", border: "1px dashed var(--border-strong)", borderRadius: 6,
          background: "transparent", color: "var(--text-dim)", cursor: "pointer",
          fontSize: 12, fontFamily: "inherit", width: "100%",
          transition: "all 0.12s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent-hi)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-dim)"; }}
      >
        <Icon name="plus" size={13} />
        Add custom strategy entry
      </button>
    );
  }

  return (
    <div className="panel" style={{ padding: 14, borderLeft: "2px solid var(--accent)" }}>
      <div className="caps" style={{ marginBottom: 10 }}>New Strategy</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div className="caps" style={{ marginBottom: 3 }}>NAME</div>
          <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 9 EMA Crossover" />
        </div>
        <div>
          <div className="caps" style={{ marginBottom: 3 }}>DESCRIPTION</div>
          <textarea
            className="field"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Describe entry and exit logic…"
            style={{ resize: "vertical", minHeight: 60, fontFamily: "inherit", fontSize: 11.5 }}
          />
        </div>
        <div>
          <div className="caps" style={{ marginBottom: 3 }}>BEST REGIME</div>
          <div className="seg" style={{ width: "100%" }}>
            {["trending", "sideways", "high_vol"].map(r => (
              <button key={r} className={regime === r ? "active" : ""} onClick={() => setRegime(r)} style={{ fontSize: 10 }}>
                {REGIME_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button className="btn btn-primary" onClick={save} style={{ flex: 1 }}>Save</button>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { data: strategies = [], isLoading } = useQuery({
    queryKey:  ["strategies"],
    queryFn:   api.strategies,
    staleTime: Infinity,
  });

  const customStrategies: StrategyMeta[] = JSON.parse(localStorage.getItem("custom_strategies") ?? "[]");

  const allStrategies = [...strategies, ...customStrategies];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24, maxWidth: 860, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 500, letterSpacing: "-0.015em" }}>Strategy Library</h1>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          {allStrategies.length} strategies · params saved locally · enable/disable controls which strategies the engine can auto-select
        </p>
      </div>

      {isLoading ? (
        <div style={{ color: "var(--text-dim)", fontSize: 12, padding: 32, textAlign: "center" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {allStrategies.map(s => (
            <StrategyCard key={s.id} strategy={s} />
          ))}
          <AddStrategyCard />
        </div>
      )}
    </div>
  );
}
