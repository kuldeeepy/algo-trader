import type { DayRegime } from "../../lib/api";

const REGIME_COLOR: Record<string, string> = {
  trending: "var(--regime-trend)",
  sideways: "var(--regime-side)",
  high_vol: "var(--regime-vol)",
};

interface RegimeStripProps {
  days: DayRegime[];
  hoveredIdx: number | null;
  onHover: (i: number | null) => void;
}

export function RegimeStrip({ days, hoveredIdx, onHover }: RegimeStripProps) {
  return (
    <div style={{ position: "relative", height: 56, width: "100%", marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 2, height: "100%" }}>
        {days.map((d, i) => {
          const color = REGIME_COLOR[d.regime] ?? "var(--text-dim)";
          const isHover = hoveredIdx === i;
          const opacity = 20 + d.confidence * 0.55;
          return (
            <div
              key={d.date}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              style={{
                flex: 1,
                background: `color-mix(in oklab, ${color} ${opacity}%, transparent)`,
                borderTop: `2px solid ${color}`,
                borderRadius: "2px 2px 0 0",
                position: "relative",
                cursor: "pointer",
                transition: "all 0.15s",
                transform: isHover ? "translateY(-2px)" : "none",
                outline: isHover ? `1px solid ${color}` : "none",
              }}
            >
              {i % 3 === 0 && (
                <div style={{
                  position: "absolute", bottom: -16, left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 8.5, color: "var(--text-dim)",
                  fontFamily: "JetBrains Mono, monospace",
                  whiteSpace: "nowrap",
                }}>
                  {d.date.slice(5)}
                </div>
              )}
              {d.confidence > 85 && (
                <div style={{
                  position: "absolute", top: 2, left: "50%",
                  transform: "translateX(-50%)",
                  width: 3, height: 3, borderRadius: 2,
                  background: color,
                  boxShadow: `0 0 4px ${color}`,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
