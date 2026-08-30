import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, ColorType, LineStyle, CrosshairMode, createSeriesMarkers } from "lightweight-charts";
import type { Candle } from "../lib/api";

export function CandleChart({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !candles.length) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#151821" },
        textColor: "#4a4f63",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)", style: LineStyle.Solid },
        horzLines: { color: "rgba(255,255,255,0.04)", style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.18)", style: LineStyle.Dashed, width: 1, labelBackgroundColor: "#1c1f2a" },
        horzLine: { color: "rgba(255,255,255,0.18)", style: LineStyle.Dashed, width: 1, labelBackgroundColor: "#1c1f2a" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.07)" },
      timeScale:       { borderColor: "rgba(255,255,255,0.07)", timeVisible: true, secondsVisible: false },
      width:  el.clientWidth,
      height: el.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:         "#22c55e",
      downColor:       "#ef4444",
      borderUpColor:   "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor:     "rgba(34,197,94,0.5)",
      wickDownColor:   "rgba(239,68,68,0.5)",
    });

    series.setData(candles.map(c => ({
      time:  c.time as unknown as string,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    })));

    const markers = [
      ...candles.filter(c => c.signal === 1).map(c => ({
        time:     c.time as unknown as string,
        position: "belowBar" as const,
        color:    "#22c55e",
        shape:    "arrowUp" as const,
        text:     "B",
        size:     1,
      })),
      ...candles.filter(c => c.signal === -1).map(c => ({
        time:     c.time as unknown as string,
        position: "aboveBar" as const,
        color:    "#ef4444",
        shape:    "arrowDown" as const,
        text:     "S",
        size:     1,
      })),
    ].sort((a, b) => String(a.time).localeCompare(String(b.time)));

    if (markers.length) createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    return () => { chart.remove(); ro.disconnect(); };
  }, [candles]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
