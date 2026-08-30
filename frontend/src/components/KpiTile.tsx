import { Icon } from "./Icon";

type Color = "default" | "profit" | "loss" | "accent" | "warn" | "muted";

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  color?: Color;
  primary?: boolean;
  hint?: string;
  // Legacy compat
  accent?: boolean;
}

const COLOR_MAP: Record<Color, string> = {
  default: "var(--text)",
  profit:  "var(--profit)",
  loss:    "var(--loss)",
  accent:  "var(--accent-hi)",
  warn:    "var(--warning)",
  muted:   "var(--text-muted)",
};

export function KpiTile({ label, value, sub, color = "default", primary = false, hint, accent }: KpiTileProps) {
  // Legacy: if accent=true, treat like primary with colored top bar
  const isPrimary = primary || accent;
  return (
    <div
      className="panel fade-up"
      style={{
        padding: isPrimary ? "14px 16px 12px" : "10px 12px",
        position: "relative",
        minHeight: isPrimary ? 80 : 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      {isPrimary && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: COLOR_MAP[color], opacity: 0.7,
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span className="caps" style={{ fontSize: isPrimary ? 9.5 : 9 }}>{label}</span>
        {hint && (
          <span data-tip={hint} style={{ cursor: "help", color: "var(--text-faint)" }}>
            <Icon name="info" size={11} />
          </span>
        )}
      </div>
      <div style={{ marginTop: isPrimary ? 6 : 4 }}>
        <span
          className="num tabular"
          style={{
            fontSize: isPrimary ? 22 : 15,
            fontWeight: 500,
            color: COLOR_MAP[color],
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
      </div>
      {sub && (
        <div className="num" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
