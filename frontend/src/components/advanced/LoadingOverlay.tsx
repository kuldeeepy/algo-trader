import { useState, useEffect, useRef } from "react";
import { Icon } from "../Icon";

const EVAL_STEPS = [
  { label: "Fetching intraday data",        detail: "symbols · trading days · 5m bars"            },
  { label: "Computing market features",      detail: "ATR · ADX · VWAP deviation · volume profile" },
  { label: "Classifying regime per day",     detail: "k-means · 3 clusters · confidence scoring"   },
  { label: "Scoring strategies vs regimes",  detail: "ORB · VWAP-rev · risk-adjusted backtest"     },
  { label: "Simulating candidate trades",    detail: "slippage 4bps · brokerage ₹20/order"         },
  { label: "Compiling attribution & risk",   detail: "P&L decomposition · drawdown analysis"       },
];

const STEP_DURATION = [700, 900, 1100, 950, 1300, 600];

interface Props {
  onDone: () => void;
  waiting?: boolean; // animation finished, still waiting for API
}

export function LoadingOverlay({ onDone, waiting = false }: Props) {
  const [idx, setIdx]         = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [animDone, setAnimDone] = useState(false);
  // Stable ref so clock-driven parent re-renders don't reset timers
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (animDone) return;
    let t: ReturnType<typeof setTimeout>;
    if (idx < EVAL_STEPS.length) {
      t = setTimeout(() => {
        setElapsed(e => e + STEP_DURATION[idx]);
        setIdx(i => i + 1);
      }, STEP_DURATION[idx]);
    } else {
      // All steps done — notify parent after brief pause
      setAnimDone(true);
      t = setTimeout(() => onDoneRef.current(), 300);
    }
    return () => clearTimeout(t);
  }, [idx, animDone]); // onDone excluded — use ref

  const allDone = idx >= EVAL_STEPS.length;

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <Icon name="brain" size={16} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
            {waiting ? "Waiting for engine…" : "Engine evaluating"}
          </span>
          <span
            className="live-dot"
            style={{ background: "var(--accent)", marginLeft: "auto" }}
          />
        </div>

        {/* Steps */}
        <div className="panel" style={{ padding: 18, fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
          {EVAL_STEPS.map((s, i) => {
            const status = i < idx ? "done" : i === idx && !allDone ? "active" : "pending";
            const color  = status === "done"   ? "var(--profit)"
                         : status === "active" ? "var(--accent-hi)"
                         : "var(--text-faint)";
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0",
                  opacity: status === "pending" ? 0.4 : 1, transition: "opacity 0.3s",
                  borderBottom: i < EVAL_STEPS.length - 1 ? "1px solid var(--border-soft)" : "none",
                }}
              >
                <span style={{ width: 14, flexShrink: 0, marginTop: 2 }}>
                  {status === "done" && <Icon name="check" size={12} color="var(--profit)" />}
                  {status === "active" && (
                    <span style={{
                      width: 8, height: 8, borderRadius: 4,
                      background: "var(--accent)",
                      animation: "pulse-dot 0.8s ease-in-out infinite",
                      display: "inline-block", marginTop: 1,
                    }} />
                  )}
                  {status === "pending" && (
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--text-faint)", display: "inline-block", marginTop: 1 }} />
                  )}
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ color, fontWeight: status === "active" ? 600 : 500, letterSpacing: "0.01em" }}>
                    {s.label}{status === "active" ? "…" : ""}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{s.detail}</div>
                  {status === "active" && (
                    <div style={{ marginTop: 6, height: 2, borderRadius: 1, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", background: "var(--accent)", width: "100%",
                        animation: `progress-step-${i} ${STEP_DURATION[i]}ms linear forwards`,
                      }} />
                    </div>
                  )}
                </div>

                <span className="num" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                  {status === "done" ? `${(STEP_DURATION[i] / 1000).toFixed(1)}s` : ""}
                </span>
              </div>
            );
          })}

          {/* Waiting row — shown after animation when API hasn't returned yet */}
          {waiting && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              paddingTop: 10, marginTop: 4,
              borderTop: "1px solid var(--border-soft)",
            }}>
              <span style={{ width: 14, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: "var(--accent)",
                  animation: "pulse-dot 0.8s ease-in-out infinite",
                  display: "inline-block",
                }} />
              </span>
              <span style={{ fontSize: 11, color: "var(--accent-hi)", fontWeight: 500 }}>
                Processing results…
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 10.5, color: "var(--text-dim)" }}>
          <span>
            {waiting
              ? "analysis complete · awaiting data"
              : `step ${Math.min(idx + 1, EVAL_STEPS.length)} of ${EVAL_STEPS.length}`}
          </span>
          <span className="num">{(elapsed / 1000).toFixed(1)}s elapsed</span>
        </div>
      </div>

      <style>{
        EVAL_STEPS.map((_, i) =>
          `@keyframes progress-step-${i} { from { transform: translateX(-100%); } to { transform: translateX(0); } }`
        ).join("\n")
      }</style>
    </div>
  );
}
