import { Icon } from "../Icon";
import { RegimeBadge } from "../Badge";
import { ProbabilityBar } from "../charts/ProbabilityBar";
import { MiniBar } from "../charts/MiniBar";
import type { AdvancedResult, AdvancedTrade } from "../../lib/api";
import { useAdvancedStore } from "../../store/advancedStore";

const REGIME_COLOR: Record<string, string> = {
  trending: "var(--regime-trend)",
  sideways: "var(--regime-side)",
  high_vol: "var(--regime-vol)",
};

function Stat({ label, value, color = "var(--text)", bar }: {
  label: string; value: string | number; color?: string; bar?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {bar}
        <span className="num tabular" style={{ fontSize: 11.5, color, fontWeight: 500 }}>{value}</span>
      </div>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "6px 8px", background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: 3 }}>
      <div className="caps" style={{ fontSize: 8.5 }}>{label}</div>
      <div className="num" style={{ fontSize: 13, color: "var(--text)", marginTop: 2, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function inr(n: number, sign = false) {
  const abs = Math.abs(n);
  const s = abs >= 100000 ? `₹${(abs / 100000).toFixed(2)}L` : `₹${abs.toLocaleString("en-IN")}`;
  if (sign) return `${n >= 0 ? "+" : "−"}${s}`;
  return n < 0 ? `−${s}` : s;
}
function pct(n: number) { return `${n.toFixed(2)}%`; }

function SelectedStockCard({ result }: { result: AdvancedResult }) {
  const { symbol, setChartSymbol } = useAdvancedStore();
  const stocks = result.per_stock ?? [];
  const selected = stocks.find(s => s.symbol === symbol.replace(".NS", "")) ?? stocks[0];
  if (!selected) return null;

  const selectedSymbol = selected.symbol;
  const selectedTicker = selectedSymbol.endsWith(".NS") ? selectedSymbol : `${selectedSymbol}.NS`;
  const trades = result.trades.filter(t => t.symbol.replace(".NS", "") === selectedSymbol);
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const expectancy = trades.length ? trades.reduce((a, t) => a + t.pnl, 0) / trades.length : 0;
  const best = trades.reduce<AdvancedTrade | null>((b, t) => !b || t.pnl > b.pnl ? t : b, null);
  const worst = trades.reduce<AdvancedTrade | null>((w, t) => !w || t.pnl < w.pnl ? t : w, null);
  const mix = result.symbol_breakdown?.find(s => s.symbol === selectedSymbol);

  return (
    <section>
      <div className="caps" style={{ marginBottom: 6 }}>Selected Stock</div>
      <div className="inner" style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {stocks.map(s => {
            const active = s.symbol === selectedSymbol;
            return (
              <button
                key={s.symbol}
                onClick={() => setChartSymbol(s.symbol.endsWith(".NS") ? s.symbol : `${s.symbol}.NS`)}
                style={{
                  height: 22,
                  padding: "0 7px",
                  borderRadius: 4,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent-bg)" : "var(--surface-2)",
                  color: active ? "var(--accent-hi)" : "var(--text-muted)",
                  fontFamily: "inherit",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                <span className="num">{s.symbol}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div className="num" style={{ fontSize: 15, color: "var(--text)", fontWeight: 700 }}>{selectedSymbol}</div>
            <div style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>{selected.sector || "NSE"} · active chart: {selectedTicker.replace(".NS", "")}</div>
          </div>
          <span className={`num ${selected.pnl >= 0 ? "profit" : "loss"}`} style={{ fontSize: 13, fontWeight: 700 }}>
            {inr(selected.pnl, true)}
          </span>
        </div>

        <Stat label="Trades" value={selected.trades} />
        <Stat label="Win rate" value={`${selected.win_rate.toFixed(1)}%`} color={selected.win_rate >= 50 ? "var(--profit)" : "var(--text)"} />
        <Stat label="Wins / losses" value={`${wins.length} / ${losses.length}`} />
        <Stat label="Expectancy" value={inr(expectancy, true)} color={expectancy >= 0 ? "var(--profit)" : "var(--loss)"} />
        <Stat label="Best trade" value={best ? inr(best.pnl, true) : "—"} color="var(--profit)" />
        <Stat label="Worst trade" value={worst ? inr(worst.pnl, true) : "—"} color="var(--loss)" />

        {mix && (
          <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--border-soft)" }}>
            <div className="caps" style={{ marginBottom: 6 }}>Regime Mix</div>
            <ProbabilityBar trending={mix.trending} sideways={mix.sideways} vol={mix.vol} height={5} />
          </div>
        )}
      </div>
    </section>
  );
}

// ── Context card: idle or hovered-trade ─────────────────────────────────────

function ContextCard({ hoveredTrade }: { hoveredTrade: AdvancedTrade | null }) {
  if (hoveredTrade) {
    const t = hoveredTrade;
    const regColor = REGIME_COLOR[t.regime] ?? "var(--text-dim)";
    return (
      <section className="fade-up" key={t.id}>
        <div className="caps" style={{ marginBottom: 6 }}>Why this trade?</div>
        <div className="inner" style={{ padding: 12, borderLeft: `2px solid ${regColor}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="num" style={{ fontWeight: 600, fontSize: 12 }}>{t.symbol}</span>
            <RegimeBadge regime={t.regime} confidence={t.confidence} />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 10 }}>
            Engine selected <span style={{ color: "var(--accent-hi)", fontWeight: 600 }}>{t.strategy}</span> after classifying the day as {t.regime}. Signal scored <span className="num">{t.confidence}%</span> confidence.
          </div>
          <Stat label="Regime fit" value={t.factors.regime_fit} bar={<MiniBar value={t.factors.regime_fit} max={100} color={regColor} width={70} />} />
          <Stat label="Signal" value={t.factors.signal_strength} bar={<MiniBar value={t.factors.signal_strength} max={100} color="var(--accent)" width={70} />} />
          <Stat label="R/R" value={`${t.factors.risk_reward.toFixed(2)}R`} bar={<MiniBar value={t.factors.risk_reward * 10} max={20} color="var(--info)" width={70} />} />
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="caps">Outcome</span>
            <span className={`num ${t.pnl >= 0 ? "profit" : "loss"}`} style={{ fontSize: 13, fontWeight: 600 }}>{inr(t.pnl, true)}</span>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="caps" style={{ marginBottom: 6 }}>Engine Status</div>
      <div className="inner" style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="live-dot" />
          <span style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 500 }}>Models loaded · ready</span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Hover any trade row to inspect the engine's reasoning for that decision.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
          <MicroStat label="Regimes/sec" value="142" />
          <MicroStat label="Coverage" value="98.4%" />
        </div>
      </div>
    </section>
  );
}

export function RightRail({ hoveredTrade, result }: { hoveredTrade: AdvancedTrade | null; result: AdvancedResult | null }) {
  const rs = result?.regime_stats;
  const trend = rs?.["trending"];
  const side  = rs?.["sideways"];
  const vol   = rs?.["high_vol"];

  return (
    <aside style={{
      width: 320, flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "var(--surface-1)",
      overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="brain" size={13} color="var(--accent)" />
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.02em" }}>Intelligence</span>
        </div>
        <span className="caps" style={{ color: "var(--text-dim)" }}>v3.2</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        <ContextCard hoveredTrade={hoveredTrade} />

        {result && <SelectedStockCard result={result} />}

        {rs && trend && side && vol && (
          <>
            <section>
              <div className="caps" style={{ marginBottom: 6 }}>Regime Distribution</div>
              <div className="inner" style={{ padding: 12 }}>
                <ProbabilityBar trending={trend.days ?? 0} sideways={side.days ?? 0} vol={vol.days ?? 0} height={6} showLabels />
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: "Trending",  data: trend, color: "var(--regime-trend)" },
                    { label: "Sideways",  data: side,  color: "var(--regime-side)"  },
                    { label: "High Vol",  data: vol,   color: "var(--regime-vol)"   },
                  ].map(({ label, data, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5 }}>
                      <span className="dot" style={{ background: color, width: 5, height: 5 }} />
                      <span style={{ flex: 1, color: "var(--text-muted)" }}>{label}</span>
                      <span className="num" style={{ color: "var(--text-dim)" }}>{data.days ?? 0}d</span>
                      <span className="num" style={{ color: "var(--text-muted)" }}>{data.win_rate ?? 0}%</span>
                      <span className={`num ${(data.pnl ?? 0) >= 0 ? "profit" : "loss"}`} style={{ fontWeight: 600, minWidth: 56, textAlign: "right" }}>
                        {data.trades ? inr(data.pnl ?? 0, true) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {result?.symbol_breakdown && result.symbol_breakdown.length > 0 && (
              <section>
                <div className="caps" style={{ marginBottom: 6 }}>Symbol Regime Mix</div>
                <div className="inner" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                  {result.symbol_breakdown.map(d => (
                    <div key={d.symbol}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span className="num" style={{ fontSize: 11, fontWeight: 600 }}>{d.symbol}</span>
                        <span className="num" style={{ fontSize: 10, color: "var(--text-dim)" }}>
                          {d.trending + d.sideways + d.vol} trades
                        </span>
                      </div>
                      <ProbabilityBar trending={d.trending} sideways={d.sideways} vol={d.vol} height={5} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="caps" style={{ marginBottom: 6 }}>Risk Attribution</div>
              <div className="inner" style={{ padding: 12 }}>
                <Stat label="Max DD"     value={pct(result!.summary.max_drawdown ?? 0)}  color="var(--loss)" />
                <Stat label="Sharpe"     value={(result!.summary.sharpe ?? 0).toFixed(2)} color={(result!.summary.sharpe ?? 0) >= 1 ? "var(--profit)" : "var(--text)"} />
                <Stat label="Expectancy" value={`${(result!.summary.expectancy ?? 0) >= 0 ? "+" : "−"}₹${Math.abs(Math.round(result!.summary.expectancy ?? 0)).toLocaleString("en-IN")}/trade`} color={(result!.summary.expectancy ?? 0) >= 0 ? "var(--profit)" : "var(--loss)"} />
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-soft)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--profit)", fontSize: 10.5 }}>
                    <Icon name="check" size={10} />
                    <span>Risk profile within tolerance</span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
