interface ProbabilityBarProps {
  trending: number;
  sideways: number;
  vol: number;
  height?: number;
  showLabels?: boolean;
}

export function ProbabilityBar({ trending, sideways, vol, height = 4, showLabels = false }: ProbabilityBarProps) {
  const total = trending + sideways + vol || 1;
  const tw = (trending / total) * 100;
  const sw = (sideways / total) * 100;
  const vw = (vol     / total) * 100;
  return (
    <div style={{ width: "100%" }}>
      <div style={{
        display: "flex", width: "100%", height,
        borderRadius: height / 2, overflow: "hidden",
        background: "var(--surface-3)",
      }}>
        <div style={{ width: `${tw}%`, background: "var(--regime-trend)" }} />
        <div style={{ width: `${sw}%`, background: "var(--regime-side)"  }} />
        <div style={{ width: `${vw}%`, background: "var(--regime-vol)"   }} />
      </div>
      {showLabels && (
        <div className="num" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-dim)", marginTop: 3 }}>
          <span style={{ color: "var(--regime-trend)" }}>{Math.round(tw)}%</span>
          <span style={{ color: "var(--regime-side)"  }}>{Math.round(sw)}%</span>
          <span style={{ color: "var(--regime-vol)"   }}>{Math.round(vw)}%</span>
        </div>
      )}
    </div>
  );
}
