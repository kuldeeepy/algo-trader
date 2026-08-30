#!/usr/bin/env python3
"""
index_research.py — Hypothesis 1 on INDEX: 50/200 MA Trend Following.

Instruments : Nifty 50 (^NSEI) and Bank Nifty (^NSEBANK) — daily candles.
Strategy    : IDENTICAL to the stock test — entry on SMA50 cross + SMA200 filter,
              exit on SMA50 cross back, hard stop at entry − 2×ATR(14).
Benchmark   : Buy-and-hold from period start to period end, net of one RT cost.
Split       : 70% in-sample (observation), 30% out-of-sample (verdict).
Costs       : Reported for BOTH 0.1% RT (optimistic) and 0.2% RT (realistic/pessimistic).
              Real NSE NIFTYBEES/BANKBEES ETF RT cost ≈ 0.15–0.20% (brokerage + STT + fees).

Position note: simulation uses index point values directly.
  1 "unit" = 1 index point of exposure.
  In practice → NIFTYBEES = Nifty/100, so 1 NIFTYBEES ≈ ₹220 at Nifty 22000.
  Position sizing math is equivalent either way — qty scales with stop distance.

Anti-self-deception:
  - Parameters fixed before writing (SMA50/200, ATR14, 2x mult — same as stock test).
  - OOS split computed from data after fetch; never peeked before coding.
  - If OOS PF < 1.3, verdict is "no edge." We do not re-tune.
"""

import sys
import yfinance as yf
import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple

# ── Instruments ───────────────────────────────────────────────────────────────
INSTRUMENTS = {
    "NIFTY": {
        "ticker":  "^NSEI",
        "name":    "Nifty 50",
    },
    "BANKNIFTY": {
        "ticker":  "^NSEBANK",
        "name":    "Bank Nifty",
    },
}

# ── Fixed parameters (same as stock test — do not change) ─────────────────────
CAPITAL    = 100_000.0
RISK_PCT   = 0.01       # 1% of capital risked per trade
MAX_POS    = 0.80       # max 80% of capital in one position (index is diversified)
MA_FAST    = 50
MA_SLOW    = 200
ATR_PERIOD = 14
ATR_MULT   = 2.0

COST_OPT   = 0.001      # 0.1% RT optimistic (ETF in/out)
COST_REAL  = 0.002      # 0.2% RT realistic / pessimistic

SPLIT_RATIO = 0.70      # first 70% = in-sample, last 30% = out-of-sample


# ── Data ──────────────────────────────────────────────────────────────────────
def fetch_max(ticker: str) -> Optional[pd.DataFrame]:
    """Fetch maximum available daily history from yfinance."""
    try:
        df = yf.Ticker(ticker).history(period="max", interval="1d", auto_adjust=True)
        if df.empty:
            return None
        df.columns = [c.lower() for c in df.columns]
        keep = [c for c in ["open", "high", "low", "close"] if c in df.columns]
        df = df[keep].dropna()
        # Drop rows with zero close (data artifact)
        df = df[df["close"] > 0]
        return df if len(df) >= 300 else None
    except Exception as e:
        print(f"  fetch error for {ticker}: {e}")
        return None


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["sma50"]  = df["close"].rolling(MA_FAST).mean()
    df["sma200"] = df["close"].rolling(MA_SLOW).mean()
    prev = df["close"].shift(1)
    tr   = pd.concat([
        df["high"] - df["low"],
        (df["high"] - prev).abs(),
        (df["low"]  - prev).abs(),
    ], axis=1).max(axis=1)
    df["atr"] = tr.ewm(alpha=1 / ATR_PERIOD, adjust=False).mean()
    return df.dropna()


# ── Trade record ──────────────────────────────────────────────────────────────
@dataclass
class Trade:
    period:      str    # "in_sample" | "oos"
    entry_date:  str
    exit_date:   str
    entry:       float
    exit_p:      float
    stop:        float
    qty:         float  # can be fractional in simulation
    gross_pnl:   float
    cost_opt:    float  # cost at 0.1% RT
    cost_real:   float  # cost at 0.2% RT
    net_opt:     float
    net_real:    float
    pct_opt:     float  # net % of position value
    pct_real:    float
    exit_reason: str    # "signal" | "stop"
    hold_days:   int


# ── Simulation ────────────────────────────────────────────────────────────────
def simulate(df: pd.DataFrame, split_date: str) -> Tuple[List[Trade], pd.Series]:
    """
    Returns (trades, equity_curve_optimal_cost).
    equity_curve: daily mark-to-market equity (cash + open position MTM).
    Uses 0.1% cost for the equity curve; we recompute 0.2% in stats separately.
    """
    trades: List[Trade] = []
    in_pos     = False
    entry_val  = stop_val = qty_val = entry_idx = 0.0
    entry_date = ""
    cap        = CAPITAL

    closes = df["close"].values
    sma50  = df["sma50"].values
    sma200 = df["sma200"].values
    atrs   = df["atr"].values
    dates  = df.index

    equity_curve = []

    for i in range(1, len(df)):
        price   = closes[i]
        s50     = sma50[i]
        s200    = sma200[i]
        atr_val = atrs[i]
        p_close = closes[i - 1]
        p_s50   = sma50[i - 1]
        date_s  = str(dates[i].date())

        period = "in_sample" if date_s <= split_date else "oos"

        # Daily mark-to-market equity (for drawdown)
        mtm = cap + (qty_val * price if in_pos else 0)
        equity_curve.append((date_s, mtm))

        # ── Exit ─────────────────────────────────────────────────────────────
        if in_pos:
            reason = fill = None
            if price <= stop_val:
                reason = "stop"
                fill   = stop_val
            elif price < s50 and p_close >= p_s50:
                reason = "signal"
                fill   = price

            if reason:
                gross     = (fill - entry_val) * qty_val
                pos_cost  = entry_val * qty_val
                c_opt     = pos_cost * COST_OPT
                c_real    = pos_cost * COST_REAL
                n_opt     = round(gross - c_opt,  2)
                n_real    = round(gross - c_real, 2)
                p_opt     = round(n_opt  / pos_cost * 100, 3)
                p_real    = round(n_real / pos_cost * 100, 3)
                hold      = (dates[i] - dates[int(entry_idx)]).days
                trades.append(Trade(
                    period=period,
                    entry_date=entry_date, exit_date=date_s,
                    entry=round(entry_val, 2), exit_p=round(fill, 2),
                    stop=round(stop_val, 2), qty=round(qty_val, 4),
                    gross_pnl=round(gross, 2),
                    cost_opt=round(c_opt, 2), cost_real=round(c_real, 2),
                    net_opt=n_opt, net_real=n_real,
                    pct_opt=p_opt, pct_real=p_real,
                    exit_reason=reason, hold_days=hold,
                ))
                cap    += entry_val * qty_val + n_opt   # use 0.1% cost for equity tracking
                in_pos  = False
                qty_val = 0.0

        # ── Entry ─────────────────────────────────────────────────────────────
        if not in_pos:
            crossed = (price > s50) and (p_close <= p_s50)
            above_200 = price > s200
            if crossed and above_200:
                sl_dist  = ATR_MULT * atr_val
                risk_amt = cap * RISK_PCT
                q        = risk_amt / sl_dist                      # allow fractional (research)
                q        = min(q, cap * MAX_POS / price)           # position cap
                if q > 0 and cap >= q * price:
                    entry_val  = price
                    stop_val   = price - sl_dist
                    entry_date = date_s
                    entry_idx  = i
                    qty_val    = q
                    in_pos     = True
                    cap       -= q * price

    # Build equity series
    eq_series = pd.Series(
        [v for _, v in equity_curve],
        index=pd.to_datetime([d for d, _ in equity_curve]),
    )
    return trades, eq_series


# ── Buy-and-hold benchmark ────────────────────────────────────────────────────
def buy_and_hold(df: pd.DataFrame, start_date: str, end_date: str, cost_rt: float) -> dict:
    sub = df[(df.index >= pd.Timestamp(start_date, tz=df.index.tz))
             & (df.index <= pd.Timestamp(end_date,   tz=df.index.tz))]
    if len(sub) < 2:
        return {}
    start_price = float(sub["close"].iloc[0])
    end_price   = float(sub["close"].iloc[-1])
    years       = (sub.index[-1] - sub.index[0]).days / 365.25
    gross_ret   = (end_price / start_price - 1) * 100
    net_ret     = gross_ret - cost_rt * 100
    cagr        = round(((1 + net_ret / 100) ** (1 / years) - 1) * 100, 2) if years > 0 else 0.0
    # B&H drawdown from price series
    prices = sub["close"]
    dd     = ((prices - prices.cummax()) / prices.cummax() * 100).min()
    return {
        "start":      start_date,
        "end":        end_date,
        "years":      round(years, 1),
        "gross_ret":  round(gross_ret, 2),
        "net_ret":    round(net_ret, 2),
        "cagr":       cagr,
        "max_dd":     round(dd, 2),
    }


# ── Statistics ────────────────────────────────────────────────────────────────
def stats(trades: List[Trade], label: str, eq: pd.Series,
          start_date: str, end_date: str, use_real_cost: bool = False) -> dict:
    n = len(trades)
    net_field  = "net_real"  if use_real_cost else "net_opt"
    pct_field  = "pct_real"  if use_real_cost else "pct_opt"

    if n == 0:
        return {"label": label, "trades": 0}

    nets   = [getattr(t, net_field) for t in trades]
    pcts   = [getattr(t, pct_field) for t in trades]
    wins   = [t for t in trades if getattr(t, net_field) > 0]
    losses = [t for t in trades if getattr(t, net_field) <= 0]
    wsum   = sum(getattr(t, net_field) for t in wins)
    lsum   = abs(sum(getattr(t, net_field) for t in losses))
    total  = sum(nets)

    # Max drawdown from equity curve slice
    if eq is not None and not eq.empty:
        try:
            eq_s = eq.loc[
                (eq.index >= pd.Timestamp(start_date)) &
                (eq.index <= pd.Timestamp(end_date))
            ]
            if len(eq_s) > 1:
                peak  = eq_s.cummax()
                dd    = ((eq_s - peak) / peak * 100).min()
            else:
                dd = 0.0
        except Exception:
            dd = 0.0
    else:
        dd = 0.0

    years = max((pd.Timestamp(end_date) - pd.Timestamp(start_date)).days / 365.25, 0.1)
    end_eq = CAPITAL + total
    cagr   = round(((end_eq / CAPITAL) ** (1 / years) - 1) * 100, 2)

    avg_hold = round(sum(t.hold_days for t in trades) / n, 1)
    avg_wp   = round(sum(getattr(t, pct_field) for t in wins)   / len(wins),   2) if wins   else 0.0
    avg_lp   = round(sum(getattr(t, pct_field) for t in losses) / len(losses), 2) if losses else 0.0

    return {
        "label":        label,
        "trades":       n,
        "win_rate":     round(len(wins) / n * 100, 1),
        "avg_win_pct":  avg_wp,
        "avg_loss_pct": avg_lp,
        "avg_hold_d":   avg_hold,
        "pf":           round(wsum / lsum, 2) if lsum else 99.99,
        "net_pnl":      round(total, 0),
        "total_ret":    round(total / CAPITAL * 100, 2),
        "cagr":         cagr,
        "max_dd":       round(dd, 2),
    }


def year_stats(trades: List[Trade], eq: pd.Series, use_real: bool = False) -> List[dict]:
    by_yr: Dict[str, List[Trade]] = {}
    for t in trades:
        yr = t.exit_date[:4]
        by_yr.setdefault(yr, []).append(t)
    rows = []
    for yr in sorted(by_yr):
        s = stats(by_yr[yr], yr, eq, f"{yr}-01-01", f"{yr}-12-31", use_real)
        rows.append(s)
    return rows


# ── Printing ──────────────────────────────────────────────────────────────────
def print_table(rows: List[dict], keys: List[str]):
    if not rows:
        print("  (no data)")
        return
    valid = [r for r in rows if r.get("trades", 0) > 0]
    if not valid:
        print("  (no trades)")
        return
    widths = {k: max(len(k), max(len(str(r.get(k, ""))) for r in rows)) for k in keys}
    hdr = "  ".join(k.ljust(widths[k]) for k in keys)
    print(hdr)
    print("-" * len(hdr))
    for r in rows:
        print("  ".join(str(r.get(k, "")).ljust(widths[k]) for k in keys))


def print_stats(s: dict, bah: dict, cost_label: str):
    if s.get("trades", 0) == 0:
        print("  No trades.")
        return
    print(f"  [{cost_label}]")
    print(f"  Trades        : {s['trades']}  (avg hold {s.get('avg_hold_d','?')} days)")
    print(f"  Win rate      : {s['win_rate']}%")
    print(f"  Avg win       : {s['avg_win_pct']:+.2f}%   Avg loss: {s['avg_loss_pct']:+.2f}%")
    print(f"  Profit factor : {s['pf']}")
    print(f"  CAGR          : {s['cagr']:+.2f}%   |  Max DD: {s['max_dd']:.2f}%")
    if bah:
        print(f"  B&H CAGR      : {bah['cagr']:+.2f}%   |  Max DD: {bah['max_dd']:.2f}%")
        edge_cagr = round(s['cagr'] - bah['cagr'], 2)
        edge_dd   = round(bah['max_dd'] - s['max_dd'], 2)   # positive = strategy has less DD
        print(f"  Edge vs B&H   : CAGR {edge_cagr:+.2f}pp  |  DD {edge_dd:+.2f}pp (+ = less pain)")


# ── Main ──────────────────────────────────────────────────────────────────────
def run_instrument(name: str, ticker: str):
    print(f"\n{'='*70}")
    print(f"  {name}  ({ticker})")
    print(f"{'='*70}")

    df = fetch_max(ticker)
    if df is None:
        print("  No data available. Skipping.")
        return

    df = add_indicators(df)
    first_date = str(df.index[0].date())
    last_date  = str(df.index[-1].date())
    n_bars     = len(df)
    split_idx  = int(n_bars * SPLIT_RATIO)
    split_date = str(df.index[split_idx].date())

    is_start = first_date
    is_end   = split_date
    oos_start= str((pd.Timestamp(split_date) + pd.Timedelta(days=1)).date())
    oos_end  = last_date

    print(f"  Data      : {first_date} → {last_date}  ({n_bars} bars, {round(n_bars/252,1)} yrs)")
    print(f"  In-sample : {is_start} → {is_end}  (70%)")
    print(f"  OOS       : {oos_start} → {oos_end}  (30%)  ← the number that counts")

    trades, eq = simulate(df, split_date)
    in_s_t = [t for t in trades if t.period == "in_sample"]
    oos_t  = [t for t in trades if t.period == "oos"]

    bah_is_opt  = buy_and_hold(df, is_start,  is_end,   COST_OPT)
    bah_is_real = buy_and_hold(df, is_start,  is_end,   COST_REAL)
    bah_oos_opt  = buy_and_hold(df, oos_start, oos_end, COST_OPT)
    bah_oos_real = buy_and_hold(df, oos_start, oos_end, COST_REAL)
    bah_all_opt  = buy_and_hold(df, is_start,  oos_end, COST_OPT)
    bah_all_real = buy_and_hold(df, is_start,  oos_end, COST_REAL)

    # ── Period summaries ──────────────────────────────────────────────────────
    for label, t_list, sd, ed, bah_opt, bah_real in [
        ("IN-SAMPLE",    in_s_t, is_start,  is_end,  bah_is_opt,  bah_is_real),
        ("OUT-OF-SAMPLE (verdict)", oos_t,  oos_start, oos_end, bah_oos_opt, bah_oos_real),
        ("COMBINED",     trades, is_start,  oos_end, bah_all_opt, bah_all_real),
    ]:
        print(f"\n  --- {label} ---")
        s_opt  = stats(t_list, label, eq, sd, ed, use_real_cost=False)
        s_real = stats(t_list, label, eq, sd, ed, use_real_cost=True)
        print_stats(s_opt,  bah_opt,  "0.1% RT cost")
        print()
        print_stats(s_real, bah_real, "0.2% RT cost")

    # ── Per-year table ────────────────────────────────────────────────────────
    print(f"\n  --- PER-YEAR (0.1% cost) ---")
    yr_keys = ["label", "trades", "win_rate", "avg_win_pct", "avg_loss_pct",
               "pf", "total_ret", "cagr", "max_dd"]
    print_table(year_stats(trades, eq, use_real=False), yr_keys)

    print(f"\n  --- PER-YEAR (0.2% cost) ---")
    print_table(year_stats(trades, eq, use_real=True), yr_keys)

    # ── Verdict ───────────────────────────────────────────────────────────────
    oos_opt  = stats(oos_t, "oos", eq, oos_start, oos_end, use_real_cost=False)
    oos_real = stats(oos_t, "oos", eq, oos_start, oos_end, use_real_cost=True)

    print(f"\n  {'='*60}")
    print(f"  VERDICT — {name}")
    print(f"  {'='*60}")
    if oos_opt.get("trades", 0) < 10:
        print(f"  WARNING: only {oos_opt.get('trades',0)} OOS trades — very low sample. Interpret with caution.")

    pf_opt  = oos_opt.get("pf", 0)
    pf_real = oos_real.get("pf", 0)
    cagr_strat_opt  = oos_opt.get("cagr", 0)
    cagr_strat_real = oos_real.get("cagr", 0)
    cagr_bah_opt    = bah_oos_opt.get("cagr", 0)
    cagr_bah_real   = bah_oos_real.get("cagr", 0)
    dd_strat = oos_opt.get("max_dd", 0)
    dd_bah   = bah_oos_opt.get("max_dd", 0)

    print(f"  OOS PF         : {pf_opt} (0.1% cost)  |  {pf_real} (0.2% cost)")
    print(f"  OOS CAGR       : {cagr_strat_opt:+.2f}% (0.1%)  |  {cagr_strat_real:+.2f}% (0.2%)")
    print(f"  OOS B&H CAGR   : {cagr_bah_opt:+.2f}% (0.1%)  |  {cagr_bah_real:+.2f}% (0.2%)")
    print(f"  OOS Max DD     : Strategy {dd_strat:.2f}%  vs  B&H {dd_bah:.2f}%")

    beats_return = cagr_strat_opt > cagr_bah_opt
    less_dd      = dd_strat > dd_bah      # dd is negative; less negative = less pain
    pf_ok        = pf_opt >= 1.3

    # Count losing years OOS
    oos_yrs = [y for y in year_stats(oos_t, eq, use_real=False) if y.get("trades", 0) > 0]
    losing_yrs = [y for y in oos_yrs if y.get("total_ret", 0) <= 0]
    print(f"  Losing OOS yrs : {len(losing_yrs)} of {len(oos_yrs)}")

    print()
    if pf_ok and beats_return:
        print("  DECISION: Real candidate edge — beats B&H in return AND has acceptable PF.")
        print("  Next step: paper trade. Do NOT go live yet.")
    elif pf_ok and less_dd:
        print("  DECISION: Marginal edge — lower drawdown than B&H but similar/lower return.")
        print("  'Less pain for same gain' can be valid for real users. Paper trade to verify.")
    elif pf_ok:
        print("  DECISION: PF okay but does NOT beat buy-and-hold return after costs.")
        print("  The strategy adds effort without adding return. Consider just holding the index.")
    else:
        print("  DECISION: No edge. OOS PF < 1.3. Underperforms B&H.")
        print("  Do NOT tune. Discard or rethink the approach.")

    print(f"  Cost caveat: 0.2% RT is more realistic for NIFTYBEES/BANKBEES ETF trades.")


def main():
    print("\n" + "=" * 70)
    print("  INDEX RESEARCH — Hypothesis 1: 50/200 MA Trend Following")
    print("  Entry: close crosses above SMA50 AND close > SMA200")
    print("  Exit:  close crosses below SMA50 OR hard stop (entry - 2×ATR14)")
    print("  Risk:  1% capital per trade")
    print("  Costs: 0.1% RT (optimistic) and 0.2% RT (realistic) — both reported")
    print("  Split: 70% in-sample (observe), 30% OOS (verdict)")
    print("  Benchmark: buy-and-hold from period start to end, net of 1 RT cost")
    print("=" * 70)

    for inst_name, inst_data in INSTRUMENTS.items():
        run_instrument(inst_name, inst_data["ticker"])

    print("\n\nDone. OOS numbers are the only ones that count.")
    print("If OOS PF < 1.3 on both indices → no reliable edge. Say so and stop.")


if __name__ == "__main__":
    main()
