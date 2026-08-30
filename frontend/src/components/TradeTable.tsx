import type { Trade } from "../lib/api";
import { inr, pct, clr } from "../lib/fmt";
import { ExitBadge } from "./Badge";

export function TradeTable({ trades }: { trades: Trade[] }) {
  if (!trades.length) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--color-dim)", fontSize: 12 }}>
        No trades triggered in this period.
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
          {["Entry → Exit", "Exit", "Entry", "Close", "P&L", "%"].map(h => (
            <th key={h} className="caps" style={{ padding: "8px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {trades.map((t, i) => (
          <tr
            key={i}
            className="row-hover"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <td className="num-sm muted" style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>
              {t.entry_date}&nbsp;→&nbsp;{t.exit_date}
            </td>
            <td style={{ padding: "7px 12px" }}>
              <ExitBadge reason={t.exit_reason} />
            </td>
            <td className="num-sm" style={{ padding: "7px 12px" }}>
              ₹{t.entry_price.toFixed(2)}
            </td>
            <td className="num-sm" style={{ padding: "7px 12px" }}>
              ₹{t.exit_price.toFixed(2)}
            </td>
            <td className={`num-sm ${clr(t.pnl)}`} style={{ padding: "7px 12px", fontWeight: 600 }}>
              {inr(t.pnl, true)}
            </td>
            <td className={`num-sm ${clr(t.pnl_pct)}`} style={{ padding: "7px 12px" }}>
              {pct(t.pnl_pct, true)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
