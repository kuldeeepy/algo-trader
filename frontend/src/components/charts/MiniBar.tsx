interface MiniBarProps {
  value: number;
  max: number;
  color?: string;
  width?: number | string;
  height?: number;
}

export function MiniBar({ value, max, color = "var(--accent)", width = "100%", height = 4 }: MiniBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ width, height, background: "var(--surface-3)", borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color,
        transition: "width 0.4s cubic-bezier(0.16,1,0.3,1)",
      }} />
    </div>
  );
}
