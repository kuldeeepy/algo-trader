import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createChart, CandlestickSeries,
  ColorType, LineStyle, CrosshairMode, createSeriesMarkers,
} from "lightweight-charts";
import { api } from "../../lib/api";
import type { AdvancedTrade } from "../../lib/api";

interface Props {
  symbol:   string;
  date:     string;
  interval: string; // "auto" → resolved to "5m"
  trades:   AdvancedTrade[];
  height?:  number;
}

function toUnix(timeStr: string): number {
  // Handles "2024-01-15 09:30:00+05:30" → unix seconds
  return Math.floor(new Date(timeStr.replace(" ", "T")).getTime() / 1000);
}

export function DayChart({ symbol, date, interval, trades, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const effectiveInterval = interval === "auto" ? "5m" : interval;

  const { data: candles, isLoading, isError } = useQuery({
    queryKey: ["intraday", symbol, date, effectiveInterval],
    queryFn:  () => api.intraday({ symbol, date, interval: effectiveInterval }),
    staleTime: 600_000,
  });

  useEffect(() => {
    if (!containerRef.current || !candles?.length) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background:  { type: ColorType.Solid, color: "#111315" },
        textColor:   "#4a5568",
        fontFamily:  "'JetBrains Mono', monospace",
        fontSize:    10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)", style: LineStyle.Solid },
        horzLines: { color: "rgba(255,255,255,0.03)", style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.15)", style: LineStyle.Dashed, width: 1, labelBackgroundColor: "#1c2030" },
        horzLine: { color: "rgba(255,255,255,0.15)", style: LineStyle.Dashed, width: 1, labelBackgroundColor: "#1c2030" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      timeScale:       { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: false },
      width:  el.clientWidth,
      height: el.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:         "#6FB58C",
      downColor:       "#D17273",
      borderUpColor:   "#6FB58C",
      borderDownColor: "#D17273",
      wickUpColor:     "rgba(111,181,140,0.55)",
      wickDownColor:   "rgba(209,114,115,0.55)",
    });

    series.setData(candles.map(c => ({
      time:  c.time as unknown as string,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    })));

    // Trade markers for the selected day (only trades on the charted symbol)
    const dayTrades = trades.filter(t => t.date === date && t.symbol.replace(".NS", "") === symbol.replace(".NS", ""));
    const markers = dayTrades.flatMap(t => [
      {
        time:     toUnix(t.entry_time) as unknown as string,
        position: "belowBar" as const,
        color:    "#6FB58C",
        shape:    "arrowUp" as const,
        text:     `B ${t.entry_price.toFixed(0)}`,
        size:     1,
      },
      {
        time:     toUnix(t.exit_time) as unknown as string,
        position: "aboveBar" as const,
        color:    t.pnl >= 0 ? "#6FB58C" : "#D17273",
        shape:    "arrowDown" as const,
        text:     `S ${t.exit_price.toFixed(0)}`,
        size:     1,
      },
    ]).sort((a, b) => String(a.time).localeCompare(String(b.time)));

    if (markers.length) createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    return () => { chart.remove(); ro.disconnect(); };
  }, [candles, date, trades, symbol]);

  if (isLoading) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent)", animation: "pulse-dot 0.8s ease-in-out infinite", display: "inline-block", marginRight: 8 }} />
        Loading chart…
      </div>
    );
  }

  if (isError || !candles?.length) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 12 }}>
        No intraday data available for {date}
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
