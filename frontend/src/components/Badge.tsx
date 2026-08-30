import { Icon } from "./Icon";

type Regime = "trending" | "sideways" | "high_vol";

interface RegimeBadgeProps {
  regime: Regime | string;
  confidence?: number;
}

const REGIME_MAP: Record<string, { cls: string; label: string; icon: string }> = {
  trending: { cls: "trend", label: "Trending", icon: "trend" },
  sideways: { cls: "side",  label: "Sideways", icon: "wave"  },
  high_vol: { cls: "vol",   label: "High Vol", icon: "bolt"  },
};

const EXIT_MAP: Record<string, { cls: string; icon: string; label: string }> = {
  "Target Hit":     { cls: "profit", icon: "target", label: "Target Hit"     },
  "take_profit":    { cls: "profit", icon: "target", label: "Target Hit"     },
  "Trail Stop":     { cls: "profit", icon: "check",  label: "Trail Stop"     },
  "Time Exit":      { cls: "info",   icon: "clock",  label: "Time Exit"      },
  "eod":            { cls: "info",   icon: "clock",  label: "Time Exit"      },
  "Stop Loss":      { cls: "loss",   icon: "x",      label: "Stop Loss"      },
  "stop_loss":      { cls: "loss",   icon: "x",      label: "Stop Loss"      },
  "Reverse Signal": { cls: "loss",   icon: "alert",  label: "Reverse Signal" },
  "signal":         { cls: "loss",   icon: "alert",  label: "Reverse Signal" },
};

export function RegimeBadge({ regime, confidence }: RegimeBadgeProps) {
  const c = REGIME_MAP[regime] ?? { cls: "", label: regime?.replace(/_/g, " ") ?? "", icon: "info" };
  return (
    <span className={`badge ${c.cls}`}>
      <Icon name={c.icon} size={9} />
      {c.label}
      {confidence != null && (
        <span style={{ marginLeft: 3, opacity: 0.7, fontWeight: 400 }}>{confidence}</span>
      )}
    </span>
  );
}

export function ExitBadge({ reason }: { reason: string }) {
  const c = EXIT_MAP[reason] ?? { cls: "", icon: "x", label: reason };
  return (
    <span className={`badge ${c.cls}`}>
      <Icon name={c.icon} size={9} />
      {c.label}
    </span>
  );
}
