import { useEffect, useRef, useState } from "react";

interface EquityPoint {
  date: string;
  value: number;
  dd?: number;
  dayPnL?: number;
}

interface EquityCurveProps {
  data: EquityPoint[];
  height?: number;
}

interface DrawdownChartProps {
  data: EquityPoint[];
  height?: number;
}

export function EquityCurve({ data, height = 220 }: EquityCurveProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  if (!data.length) return null;

  const pad = { l: 56, r: 16, t: 16, b: 24 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const ys = data.map(d => d.value);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - ((v - minY) / range) * innerH;
  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`;
  const ticks = Array.from({ length: 5 }, (_, i) => minY + (range * i) / 4);

  function onMove(e: React.MouseEvent<SVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.round(((px - pad.l) / innerW) * (data.length - 1));
    if (idx >= 0 && idx < data.length) setHover(idx);
  }

  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: "block" }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid-line)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(t) + 3} fill="var(--text-dim)" fontSize="9.5" textAnchor="end" fontFamily="JetBrains Mono, monospace">
              {t >= 100000 ? `${(t/100000).toFixed(1)}L` : `${(t/1000).toFixed(0)}k`}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={width - pad.r} y1={y(data[0].value)} y2={y(data[0].value)} stroke="var(--text-faint)" strokeWidth="1" strokeDasharray="2 4" />
        <path d={areaPath} fill="url(#eqGrad)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => i % 6 === 0 ? (
          <text key={i} x={x(i)} y={height - 6} fill="var(--text-dim)" fontSize="9.5" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
            {d.date.slice(5)}
          </text>
        ) : null)}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="3.5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div style={{
          position: "absolute", top: 8, right: 12,
          background: "var(--surface-3)", border: "1px solid var(--border-strong)",
          borderRadius: 4, padding: "6px 10px", fontSize: 11,
          pointerEvents: "none", boxShadow: "var(--shadow-pop)", minWidth: 140,
        }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--text-dim)", fontSize: 9.5, marginBottom: 3 }}>
            {data[hover].date}
          </div>
          <div className="num" style={{ color: "var(--text)", fontWeight: 500, fontSize: 13 }}>
            ₹{data[hover].value.toLocaleString("en-IN")}
          </div>
          {data[hover].dayPnL != null && (
            <div className="num" style={{ color: (data[hover].dayPnL ?? 0) >= 0 ? "var(--profit)" : "var(--loss)", fontSize: 10.5, marginTop: 2 }}>
              {(data[hover].dayPnL ?? 0) >= 0 ? "+" : ""}₹{(data[hover].dayPnL ?? 0).toLocaleString("en-IN")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DrawdownChart({ data, height = 72 }: DrawdownChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setWidth(Math.max(200, e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  if (!data.length) return null;
  const pad = { l: 56, r: 16, t: 6, b: 16 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const ddVals = data.map(d => d.dd ?? 0);
  const minY = Math.min(...ddVals, -0.5);
  const x = (i: number) => pad.l + (i / (data.length - 1)) * innerW;
  const y = (v: number) => pad.t + (v / minY) * innerH;
  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.dd ?? 0)}`).join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1)} ${pad.t} L ${x(0)} ${pad.t} Z`;
  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        <defs>
          <linearGradient id="ddGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="var(--loss)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--loss)" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <line x1={pad.l} x2={width - pad.r} y1={pad.t} y2={pad.t} stroke="var(--text-faint)" strokeDasharray="2 3" />
        <text x={pad.l - 8} y={pad.t + 3} fill="var(--text-dim)" fontSize="9.5" textAnchor="end" fontFamily="JetBrains Mono, monospace">0%</text>
        <text x={pad.l - 8} y={pad.t + innerH + 3} fill="var(--text-dim)" fontSize="9.5" textAnchor="end" fontFamily="JetBrains Mono, monospace">
          {minY.toFixed(1)}%
        </text>
        <path d={areaPath} fill="url(#ddGrad)" />
        <path d={linePath} fill="none" stroke="var(--loss)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
