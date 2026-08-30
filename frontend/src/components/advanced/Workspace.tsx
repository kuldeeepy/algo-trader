import { useState, useMemo } from "react";
import type { AdvancedResult, AdvancedTrade, DayRegime } from "../../lib/api";
import { useAdvancedStore } from "../../store/advancedStore";
import { KpiTile } from "../KpiTile";
import { RegimeBadge, ExitBadge } from "../Badge";
import { Icon } from "../Icon";
import { RegimeStrip } from "../charts/RegimeStrip";
import { ProbabilityBar } from "../charts/ProbabilityBar";
import { EquityCurve, DrawdownChart } from "../charts/EquityCurve";
import { Sparkline } from "../charts/Sparkline";
import { MiniBar } from "../charts/MiniBar";
import { DayChart } from "../charts/DayChart";

const REGIME_COLOR: Record<string, string> = {
  trending: "var(--regime-trend)",
  sideways: "var(--regime-side)",
  high_vol: "var(--regime-vol)",
};

function inr(n: number, sign = false) {
  const abs = Math.abs(n);
  const s = abs >= 100000 ? `₹${(abs / 100000).toFixed(2)}L` : `₹${abs.toLocaleString("en-IN")}`;
  if (sign) return `${n >= 0 ? "+" : "−"}${s}`;
  return n < 0 ? `−${s}` : s;
}
function pct(n: number, sign = false) { return `${sign && n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }

// ── Regime timeline ───────────────────────────────────────────────────────────

function RegimeTimelineCard({ dayRegimes }: { dayRegimes: DayRegime[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hover = hoveredIdx != null ? dayRegimes[hoveredIdx] : null;

  const counts = useMemo(() => {
    return dayRegimes.reduce((a, d) => { a[d.regime] = (a[d.regime] || 0) + 1; return a; }, {} as Record<string, number>);
  }, [dayRegimes]);

  const avgConf = dayRegimes.length ? Math.round(dayRegimes.reduce((a, d) => a + d.confidence, 0) / dayRegimes.length) : 0;

  return (
    <div className="panel" style={{ padding: "14px 16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
        <div>
          <div className="caps" style={{ marginBottom: 4 }}>Regime Timeline · {dayRegimes.length} sessions</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
            {[
              { key: "trending", label: "trending",  color: "var(--regime-trend)" },
              { key: "sideways", label: "sideways",  color: "var(--regime-side)"  },
              { key: "high_vol", label: "high vol",  color: "var(--regime-vol)"   },
            ].map(r => (
              <span key={r.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span className="dot" style={{ background: r.color }} />
                <span className="num" style={{ color: "var(--text)" }}>{counts[r.key] || 0}</span> {r.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 200 }}>
          <div className="caps" style={{ marginBottom: 4 }}>Avg classification confidence</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <ProbabilityBar trending={counts["trending"] || 0} sideways={counts["sideways"] || 0} vol={counts["high_vol"] || 0} height={6} />
            <span className="num" style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
              {avgConf}<span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 1 }}>%</span>
            </span>
          </div>
        </div>
      </div>

      <RegimeStrip days={dayRegimes} hoveredIdx={hoveredIdx} onHover={setHoveredIdx} />

      <div style={{
        marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
        padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--border-soft)",
        borderRadius: 4, minHeight: 56,
      }}>
        {hover ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="num" style={{ fontSize: 11, color: "var(--text-dim)" }}>{hover.date}</div>
              <RegimeBadge regime={hover.regime} confidence={hover.confidence} />
              <span className="num" style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
              <span className="num" style={{ fontSize: 11, color: "var(--accent-hi)" }}>{hover.strategy}</span>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 11 }}>
              <FeatureChip label="ADX"      value={hover.adx}      threshold={25}  better="high" relevant={hover.regime === "trending"} />
              <FeatureChip label="ATR%"     value={hover.atr_pct}  threshold={2.0} better="low"  relevant={hover.regime === "high_vol"} />
              <FeatureChip label="VWAP dev" value={hover.vwap_dev} threshold={0.5} better="low"  relevant={hover.regime === "sideways"} />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 11 }}>
              <Icon name="info" size={11} color="var(--text-dim)" />
              Hover any day above to see classification reasoning
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11, color: "var(--text-dim)" }}>
              <span className="num">window: 09:15 — 09:45</span>
              <span>·</span>
              <span className="num">model: kmeans-v3.2</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FeatureChip({ label, value, threshold, better, relevant }: {
  label: string; value: number; threshold: number; better: "high" | "low"; relevant: boolean;
}) {
  const meets = better === "high" ? value >= threshold : value <= threshold;
  const color = relevant && meets ? "var(--profit)" : relevant && !meets ? "var(--warning)" : "var(--text-muted)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span className="caps" style={{ fontSize: 9 }}>{label}</span>
      <span className="num" style={{ color, fontWeight: relevant ? 600 : 400, fontSize: 11.5 }}>{value.toFixed(2)}</span>
      {relevant && (
        <span style={{ fontSize: 9, color }}>{better === "high" ? `≥${threshold}` : `≤${threshold}`}</span>
      )}
    </span>
  );
}

// ── KPI rows ─────────────────────────────────────────────────────────────────

function KpiRows({ result }: { result: AdvancedResult }) {
  const s = result.summary;
  const startEq = s.start_eq ?? (s.pnl && s.return_pct ? Math.round(s.pnl / s.return_pct * 100) : 0);
  const endEq   = s.end_eq ?? startEq + s.pnl;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        <KpiTile label="NET P&L"      value={inr(s.pnl, true)}           sub={`₹${(startEq/1000).toFixed(0)}k → ₹${(endEq/1000).toFixed(0)}k`} color={s.pnl >= 0 ? "profit" : "loss"} primary />
        <KpiTile label="RETURN"       value={pct(s.return_pct, true)}    sub="of deployed capital"   color={s.return_pct >= 0 ? "profit" : "loss"} primary />
        <KpiTile label="MAX DRAWDOWN" value={pct(s.max_drawdown ?? 0)}   sub="peak-to-trough"        color="loss"   primary hint="Largest peak-to-trough decline in equity." />
        <KpiTile label="PROFIT FACTOR" value={s.profit_factor >= 9999 ? "∞" : s.profit_factor.toFixed(2)} sub="gross win / gross loss" color={s.profit_factor >= 1.5 ? "profit" : s.profit_factor >= 1 ? "warn" : "loss"} primary hint="Total winnings / total losses. >1.5 is healthy." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
        <KpiTile label="SHARPE"      value={(s.sharpe ?? 0).toFixed(2)}     sub="risk-adjusted"      color={(s.sharpe ?? 0) >= 1 ? "profit" : "default"} />
        <KpiTile label="EXPECTANCY"  value={inr(s.expectancy ?? 0, true)}   sub="avg ₹ per trade after costs" color={(s.expectancy ?? 0) >= 0 ? "profit" : "loss"} hint="(Win rate × Avg win) − (Loss rate × Avg loss). Must be positive to be viable." />
        <KpiTile label="WIN RATE"    value={`${s.win_rate.toFixed(1)}%`}    sub={`${s.wins} of ${s.total_trades} trades`} />
        <KpiTile label="AVG WIN"     value={inr(s.avg_win ?? 0)}            color="profit" />
        <KpiTile label="AVG LOSS"    value={inr(s.avg_loss ?? 0)}           color="loss" />
      </div>
    </div>
  );
}

// ── Equity card ───────────────────────────────────────────────────────────────

function EquityCard({ result }: { result: AdvancedResult }) {
  const s = result.summary;
  const startEq = s.start_eq ?? 0;
  const endEq   = s.end_eq ?? startEq + s.pnl;
  return (
    <div className="panel" style={{ padding: "12px 12px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="caps">Equity Curve</span>
          <span className="num" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
            ₹{startEq.toLocaleString("en-IN")} → ₹{endEq.toLocaleString("en-IN")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn btn-ghost btn-sm" data-tip="Expand"><Icon name="expand" size={10} /></button>
          <button className="btn btn-ghost btn-sm" data-tip="Export"><Icon name="download" size={10} /></button>
        </div>
      </div>
      <EquityCurve data={result.equity} height={220} />
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-soft)" }}>
        <div className="caps" style={{ paddingLeft: 56, marginBottom: 2 }}>Drawdown</div>
        <DrawdownChart data={result.equity} height={72} />
      </div>
    </div>
  );
}

// ── Breakdown tables ──────────────────────────────────────────────────────────

function BreakdownRow({ result }: { result: AdvancedResult }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <PerStockCard result={result} />
      <PerRegimeCard result={result} />
    </div>
  );
}

function PerStockCard({ result }: { result: AdvancedResult }) {
  const stocks = result.per_stock ?? [];
  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border-soft)" }}>
        <span className="caps">By Symbol</span>
        <span className="num" style={{ fontSize: 10, color: "var(--text-dim)" }}>{stocks.length} symbols</span>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Symbol</th>
            <th style={{ textAlign: "right" }}>Trades</th>
            <th style={{ textAlign: "right" }}>Win%</th>
            <th>Equity</th>
            <th style={{ textAlign: "right" }}>P&L</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map(s => (
            <tr key={s.symbol}>
              <td>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span className="num" style={{ fontWeight: 600, fontSize: 11.5 }}>{s.symbol}</span>
                  <span style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{s.sector}</span>
                </div>
              </td>
              <td className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>{s.trades}</td>
              <td className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>{s.win_rate.toFixed(1)}%</td>
              <td><Sparkline values={s.sparkline} width={70} height={18} /></td>
              <td className={`num ${s.pnl >= 0 ? "profit" : "loss"}`} style={{ textAlign: "right", fontWeight: 600 }}>
                {inr(s.pnl, true)}
              </td>
            </tr>
          ))}
          {stocks.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-dim)", padding: 16 }}>No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PerRegimeCard({ result }: { result: AdvancedResult }) {
  const stats = result.regime_stats;
  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border-soft)" }}>
        <span className="caps">By Regime · Attribution</span>
        <span className="num" style={{ fontSize: 10, color: "var(--text-dim)" }}>3 classes</span>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Regime · Strategy</th>
            <th style={{ textAlign: "right" }}>Days</th>
            <th style={{ textAlign: "right" }}>Trades</th>
            <th style={{ textAlign: "right" }}>Win%</th>
            <th style={{ textAlign: "right" }}>P&L</th>
          </tr>
        </thead>
        <tbody>
          {(["trending", "sideways", "high_vol"] as const).map(r => {
            const s = stats[r] ?? { trades: 0, wins: 0, pnl: 0, win_rate: 0, days: 0 };
            const strat = r === "trending" ? "ORB" : r === "sideways" ? "VWAP Reversion" : "Skipped";
            return (
              <tr key={r}>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <RegimeBadge regime={r} />
                    <span style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>{strat}</span>
                  </div>
                </td>
                <td className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>{s.days ?? 0}</td>
                <td className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>{s.trades || "—"}</td>
                <td className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>{s.trades ? `${(s.win_rate ?? 0).toFixed(1)}%` : "—"}</td>
                <td className={`num ${(s.pnl ?? 0) >= 0 ? "profit" : "loss"}`} style={{ textAlign: "right", fontWeight: 600 }}>
                  {s.trades ? inr(s.pnl, true) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Trade log ─────────────────────────────────────────────────────────────────

function ConfidenceBar({ value, width = 36 }: { value: number; width?: number }) {
  const color = value >= 75 ? "var(--profit)" : value >= 60 ? "var(--accent)" : "var(--text-dim)";
  return (
    <span className="conf">
      <span className="conf-bar" style={{ width }}>
        <div style={{ width: `${value}%`, background: color }} />
      </span>
      <span className="num" style={{ fontSize: 10, color: "var(--text-muted)", width: 18 }}>{value}</span>
    </span>
  );
}

function TradeReasoningPanel({ trade }: { trade: AdvancedTrade }) {
  const regColor = REGIME_COLOR[trade.regime] ?? "var(--text-dim)";
  const f = trade.factors;
  const reasonMap: Record<string, { regime: string; entry: string; exit: string }> = {
    trending: {
      regime: `Day classified trending — ADX trended above 25 by 09:45 with consistent higher highs.`,
      entry:  `${trade.symbol} broke the opening range high at ${trade.entry_time} with above-average volume.`,
      exit:   trade.exit_reason === "take_profit" || trade.exit_reason === "Target Hit"
              ? `Reached 1.5R target at ₹${trade.exit_price.toFixed(2)}.`
              : trade.exit_reason === "stop_loss" || trade.exit_reason === "Stop Loss"
              ? `Hit 1R stop at ₹${trade.exit_price.toFixed(2)} — momentum failed.`
              : `Exited on ${trade.exit_reason}.`,
    },
    sideways: {
      regime: `Day classified sideways — ATR% below 1.2 and price oscillated tightly around VWAP.`,
      entry:  `${trade.symbol} extended 0.6σ from VWAP at ${trade.entry_time}, signalling reversion.`,
      exit:   `Reverted to VWAP at ₹${trade.exit_price.toFixed(2)}.`,
    },
  };
  const reason = reasonMap[trade.regime] ?? { regime: `Regime: ${trade.regime}`, entry: "Signal triggered.", exit: `Exit at ₹${trade.exit_price.toFixed(2)}.` };
  return (
    <div style={{ padding: "12px 16px", borderLeft: `2px solid ${regColor}`, background: "var(--surface-1)", borderRadius: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div>
          <div className="caps" style={{ marginBottom: 8 }}>Trade Reasoning</div>
          {[
            { icon: "brain",  label: "Regime fit",    text: reason.regime },
            { icon: "target", label: "Entry signal",  text: reason.entry  },
            { icon: "check",  label: "Exit",          text: reason.exit   },
          ].map(({ icon, label, text }) => (
            <div key={label} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <div style={{
                width: 22, height: 22, borderRadius: 3,
                background: "var(--surface-3)", border: "1px solid var(--border)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-hi)", flexShrink: 0, marginTop: 1,
              }}>
                <Icon name={icon} size={11} />
              </div>
              <div>
                <div className="caps" style={{ fontSize: 9, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.55 }}>{text}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="caps" style={{ marginBottom: 8 }}>Decision Factors</div>
          <Stat label="Regime fit"      value={f.regime_fit}      bar={<MiniBar value={f.regime_fit}      max={100} color={regColor}             width={80} />} />
          <Stat label="Signal strength" value={f.signal_strength} bar={<MiniBar value={f.signal_strength} max={100} color="var(--accent)"        width={80} />} />
          <Stat label="Risk/Reward"     value={`${f.risk_reward.toFixed(2)}R`} bar={<MiniBar value={f.risk_reward * 10} max={20} color="var(--info)" width={80} />} />
          <Stat label="Liquidity"       value={f.liquidity}       bar={<MiniBar value={f.liquidity}       max={100} color="var(--text-muted)"     width={80} />} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, bar }: { label: string; value: string | number; bar?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {bar}
        <span className="num tabular" style={{ fontSize: 11.5, fontWeight: 500 }}>{value}</span>
      </div>
    </div>
  );
}

function TradeLog({ result }: { result: AdvancedResult }) {
  const { hoveredTrade, expandedTradeId, tradeFilter, tradeSearch, selectedDay, setHoveredTrade, setExpandedTrade, setTradeFilter, setTradeSearch } = useAdvancedStore();
  const trades = result.trades;

  const filtered = useMemo(() => {
    let f = trades;
    if (selectedDay)                f = f.filter(t => t.date === selectedDay);
    if (tradeFilter === "wins")     f = f.filter(t => t.pnl > 0);
    if (tradeFilter === "losses")   f = f.filter(t => t.pnl <= 0);
    if (tradeFilter === "trending") f = f.filter(t => t.regime === "trending");
    if (tradeFilter === "sideways") f = f.filter(t => t.regime === "sideways");
    if (tradeSearch) {
      const q = tradeSearch.toLowerCase();
      f = f.filter(t => t.symbol.toLowerCase().includes(q) || t.date.includes(q));
    }
    return f;
  }, [tradeFilter, tradeSearch, selectedDay, trades]);

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="caps">Trade Log</span>
          <span className="num" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{filtered.length} of {trades.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="seg" style={{ padding: 1 }}>
            {(["all", "wins", "losses", "trending", "sideways"] as const).map(f => (
              <button
                key={f}
                className={tradeFilter === f ? "active" : ""}
                onClick={() => setTradeFilter(f)}
                style={{ height: 20, padding: "0 8px", fontSize: 10,
                  color: tradeFilter === f && f === "wins" ? "var(--profit)" : tradeFilter === f && f === "losses" ? "var(--loss)" : undefined
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>
              <Icon name="search" size={11} />
            </span>
            <input
              className="field"
              placeholder="filter…"
              value={tradeSearch}
              onChange={e => setTradeSearch(e.target.value)}
              style={{ height: 22, paddingLeft: 22, fontSize: 10.5, width: 110 }}
            />
          </div>
        </div>
      </div>

      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Symbol</th>
              <th>Date · Time</th>
              <th>Regime / Strategy</th>
              <th>Side</th>
              <th style={{ textAlign: "right" }}>Entry</th>
              <th style={{ textAlign: "right" }}>Exit</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th>Conf.</th>
              <th>Exit</th>
              <th style={{ textAlign: "right" }}>P&L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 80).map((t, idx) => {
              const isExpanded = expandedTradeId === t.id;
              const isSelected = hoveredTrade?.id === t.id;
              return (
                <tr
                  key={t.id}
                  className={isSelected ? "expanded" : ""}
                  style={{ background: isSelected ? "var(--surface-2)" : undefined, cursor: "pointer" }}
                  onMouseEnter={() => setHoveredTrade(t)}
                  onMouseLeave={() => setHoveredTrade(null)}
                  onClick={() => setExpandedTrade(isExpanded ? null : t.id)}
                >
                  <td className="num" style={{ color: "var(--text-dim)", fontSize: 10 }}>{String(idx + 1).padStart(3, "0")}</td>
                  <td><span className="num" style={{ fontWeight: 600, fontSize: 11.5 }}>{t.symbol}</span></td>
                  <td className="num" style={{ color: "var(--text-muted)", fontSize: 10.5, whiteSpace: "nowrap" }}>
                    {t.date.slice(5)} · {t.entry_time.slice(11, 16)}–{t.exit_time.slice(11, 16)}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <RegimeBadge regime={t.regime} />
                      <span className="num" style={{ fontSize: 9.5, color: "var(--accent-hi)", paddingLeft: 2 }}>{t.strategy}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: "transparent",
                      borderColor: t.side === "LONG" ? "var(--profit)" : "var(--loss)",
                      color: t.side === "LONG" ? "var(--profit)" : "var(--loss)",
                    }}>{t.side}</span>
                  </td>
                  <td className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>{t.entry_price.toFixed(2)}</td>
                  <td className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>{t.exit_price.toFixed(2)}</td>
                  <td className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>{t.shares}</td>
                  <td><ConfidenceBar value={t.confidence} /></td>
                  <td><ExitBadge reason={t.exit_reason} /></td>
                  <td className={`num ${t.pnl >= 0 ? "profit" : "loss"}`} style={{ textAlign: "right", fontWeight: 600, fontSize: 12 }}>
                    {inr(t.pnl, true)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="why-chip"
                      onClick={e => { e.stopPropagation(); setExpandedTrade(isExpanded ? null : t.id); }}
                    >
                      <Icon name="reasoning" size={9} />
                      WHY
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
            No trades match the current filter.
          </div>
        )}
      </div>

      {/* Expanded Why panel — rendered below the table when a row is expanded */}
      {expandedTradeId != null && (() => {
        const t = trades.find(tr => tr.id === expandedTradeId);
        if (!t) return null;
        return (
          <div className="fade-up" style={{ padding: "0 12px 12px 56px", background: "var(--surface-2)" }}>
            <TradeReasoningPanel trade={t} />
          </div>
        );
      })()}
    </div>
  );
}

// ── Day selector strip ────────────────────────────────────────────────────────

function DaySelector({ result }: { result: AdvancedResult }) {
  const { selectedDay, setSelectedDay } = useAdvancedStore();

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      overflowX: "auto", paddingBottom: 2,
      scrollbarWidth: "none",
    }}>
      {/* All pill */}
      <button
        onClick={() => setSelectedDay(null)}
        style={{
          flexShrink: 0,
          padding: "4px 10px", height: 30,
          background: !selectedDay ? "var(--surface-3)" : "var(--surface-1)",
          border: `1px solid ${!selectedDay ? "var(--border-strong)" : "var(--border-soft)"}`,
          borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
          color: !selectedDay ? "var(--text)" : "var(--text-muted)",
          fontSize: 10.5, fontWeight: 500,
          transition: "all 0.12s",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <Icon name="spark" size={10} color={!selectedDay ? "var(--accent-hi)" : "currentColor"} />
        All
      </button>

      {result.day_regimes.map(d => {
        const dayPnl = result.daily_pnl[d.date] ?? 0;
        const isActive = selectedDay === d.date;
        const regColor = REGIME_COLOR[d.regime] ?? "var(--text-muted)";
        return (
          <button
            key={`${d.date}-${d.symbol}`}
            onClick={() => setSelectedDay(isActive ? null : d.date)}
            style={{
              flexShrink: 0,
              padding: "3px 8px", height: 30,
              background: isActive ? "var(--surface-3)" : "var(--surface-1)",
              border: `1px solid ${isActive ? "var(--border-strong)" : "var(--border-soft)"}`,
              borderLeft: `2px solid ${regColor}`,
              borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.12s",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface-2)"; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "var(--surface-1)"; }}
          >
            <span className="num" style={{ fontSize: 9.5, color: isActive ? "var(--text)" : "var(--text-muted)", fontWeight: 600 }}>
              {d.date.slice(5)}
            </span>
            <span className="num" style={{ fontSize: 9, color: dayPnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
              {dayPnl >= 0 ? "+" : ""}₹{Math.abs(dayPnl) >= 1000 ? `${(Math.abs(dayPnl) / 1000).toFixed(1)}k` : Math.abs(dayPnl).toFixed(0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Day detail header (shown when a day is selected) ──────────────────────────

function DayDetailBar({ result }: { result: AdvancedResult }) {
  const { selectedDay, symbol } = useAdvancedStore();
  if (!selectedDay) return null;

  const activeSymbol = symbol.replace(".NS", "");
  const regime = result.day_regimes.find(d => d.date === selectedDay && d.symbol === activeSymbol)
    ?? result.day_regimes.find(d => d.date === selectedDay);
  const dayPnl = result.daily_pnl[selectedDay] ?? 0;
  const dayTrades = result.trades.filter(t => t.date === selectedDay);
  const wins = dayTrades.filter(t => t.pnl > 0).length;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, padding: "8px 12px",
      background: "var(--surface-1)", border: "1px solid var(--border-soft)",
      borderRadius: 4, fontSize: 11,
    }}>
      <span className="num" style={{ color: "var(--text-dim)", fontWeight: 600 }}>{selectedDay}</span>
      {regime && <RegimeBadge regime={regime.regime} confidence={regime.confidence} />}
      {regime && <span className="num" style={{ color: "var(--accent-hi)", fontSize: 10.5 }}>{regime.strategy}</span>}
      <span style={{ color: "var(--border-strong)", margin: "0 2px" }}>·</span>
      <span className="num" style={{ color: dayPnl >= 0 ? "var(--profit)" : "var(--loss)", fontWeight: 600 }}>
        {inr(dayPnl, true)}
      </span>
      <span style={{ color: "var(--border-strong)", margin: "0 2px" }}>·</span>
      <span style={{ color: "var(--text-muted)" }}>{dayTrades.length} trades</span>
      {dayTrades.length > 0 && (
        <span style={{ color: "var(--text-muted)" }}>{wins}/{dayTrades.length} wins</span>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyWorkspace() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <Icon name="brain" size={32} color="var(--text-faint)" />
        <div style={{ fontSize: 14, fontWeight: 500, marginTop: 12, marginBottom: 6 }}>Regime-aware backtester</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Engine classifies each session's regime from the opening window, then auto-selects the best-fit strategy. Configure your universe and hit Run.
        </div>
      </div>
    </div>
  );
}

// ── Main Workspace ────────────────────────────────────────────────────────────

export function Workspace({ result }: { result: AdvancedResult }) {
  const { symbol, symbols, interval, selectedDay, scanUniverse } = useAdvancedStore();
  const displaySymbol = scanUniverse
    ? "Universe Scan"
    : symbols.length > 1
      ? `${symbols.length} Stock Portfolio`
      : (symbol.replace(".NS", "") || "Backtest");

  return (
    <div style={{
      flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
      gap: 10, padding: 12, minWidth: 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 4, marginBottom: -2 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: "-0.015em", color: "var(--text)" }}>
            {displaySymbol}
          </h1>
          <span className="caps" style={{ color: "var(--text-dim)" }}>
            regime-aware · auto-strategy · {result.day_regimes.length} symbol-sessions
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm"><Icon name="download" size={11} /> Export</button>
        </div>
      </div>

      {/* Day selector */}
      {result.day_regimes.length > 0 && <DaySelector result={result} />}

      {/* Day detail bar when a day is selected */}
      <DayDetailBar result={result} />

      {result.day_regimes.length > 0 && !selectedDay && <RegimeTimelineCard dayRegimes={result.day_regimes} />}

      <KpiRows result={result} />

      {/* Day chart OR equity curve */}
      {selectedDay ? (
        <div className="panel" style={{ padding: "12px 12px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="caps">Intraday Chart · {selectedDay}</span>
            <span className="num" style={{ fontSize: 10, color: "var(--text-dim)" }}>{interval === "auto" ? "5m" : interval} bars</span>
          </div>
          <DayChart
            symbol={symbol}
            date={selectedDay}
            interval={interval}
            trades={result.trades}
            height={340}
          />
        </div>
      ) : (
        result.equity.length > 0 && <EquityCard result={result} />
      )}

      <BreakdownRow result={result} />
      <TradeLog result={result} />
    </div>
  );
}
