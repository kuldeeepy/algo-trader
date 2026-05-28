"""
Walk-forward backtesting engine.

For each day in the date range, for each symbol:
    1. Fetch 5m candles (cached in SQLite after first fetch)
    2. Compute all indicators
    3. Classify regime from first 30-min window (9:15–9:45)
    4. Select strategy based on regime (high_vol = skip)
    5. Simulate bar-by-bar with ATR-based SL/TP and risk rules
    6. Log every trade to SQLite

No lookahead: indicators are causal (ewm/rolling), regime is determined
before trading starts, signals only reference past bars.

Usage:
    from backtest import run
    results = run(["RELIANCE", "SBIN"], "2026-04-01", "2026-04-30", capital=100_000)
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

from engine import fetch
from indicators import compute_all
from regime import classify
from strategies import select_strategy
from risk import RiskManager, RiskConfig
from store import init_db, load_candles, save_candles, save_trades, save_daily_summary
from universe import get_ticker

IST = ZoneInfo("Asia/Kolkata")

# Market hours
_MARKET_OPEN   = (9, 15)
_OBS_END_TIME  = (9, 45)   # start trading only after this
_MARKET_CLOSE  = (15, 25)  # force-close any open position at this bar


@dataclass
class BacktestTrade:
    date:         str
    symbol:       str
    regime:       str
    strategy:     str
    entry_time:   str
    exit_time:    str
    entry_price:  float
    exit_price:   float
    sl_price:     float
    tp_price:     float
    shares:       int
    pnl:          float
    pnl_pct:      float
    exit_reason:  str
    entry_reason: str


# ── Daily simulation ──────────────────────────────────────────────────────────

def _simulate_day(
    df: pd.DataFrame,
    symbol: str,
    trade_date: str,
    regime_info: dict,
    strategy_fn,
    risk_mgr: RiskManager,
    capital: float,
) -> list[BacktestTrade]:
    """
    Simulate one trading day bar-by-bar.
    Returns a list of completed trades.
    """
    trades = []
    cash   = capital

    position    = 0
    entry_price = 0.0
    sl_price    = 0.0
    tp_price    = 0.0
    entry_time  = None

    regime   = regime_info["regime"]
    strategy = strategy_fn.__name__.replace("apply_", "")

    # Apply strategy signals to the full day's data
    df = strategy_fn(df)

    # Compute cutoff times in IST regardless of whether the index is UTC or IST
    # (cached candles come back as UTC; fresh yfinance data comes as IST)
    first_ist = df.index[0].astimezone(IST)
    obs_end   = first_ist.replace(hour=_OBS_END_TIME[0], minute=_OBS_END_TIME[1], second=0, microsecond=0)
    close_bar = first_ist.replace(hour=_MARKET_CLOSE[0], minute=_MARKET_CLOSE[1], second=0, microsecond=0)

    for ts, row in df.iterrows():
        if ts <= obs_end:
            continue

        price  = float(row["close"])
        signal = int(row.get("signal", 0))
        atr    = float(row["atr"])

        exit_reason = None

        # Check SL / TP / signal exit for open position
        if position > 0:
            if price <= sl_price:
                exit_reason = "stop_loss"
            elif price >= tp_price:
                exit_reason = "take_profit"
            elif signal == -1:
                exit_reason = "signal"
            elif ts >= close_bar:
                exit_reason = "eod"   # end-of-day force close

        if exit_reason:
            pnl    = round((price - entry_price) * position, 2)
            pnl_pct = round((price - entry_price) / entry_price * 100, 2)
            risk_mgr.record_trade(pnl, ts)
            trades.append(BacktestTrade(
                date=trade_date, symbol=symbol,
                regime=regime, strategy=strategy,
                entry_time=str(entry_time), exit_time=str(ts),
                entry_price=round(entry_price, 2), exit_price=round(price, 2),
                sl_price=sl_price, tp_price=tp_price,
                shares=position, pnl=pnl, pnl_pct=pnl_pct,
                exit_reason=exit_reason,
                entry_reason=f"regime={regime}",
            ))
            cash    += position * price
            position = 0

        # Enter new position if signal and risk allows
        if signal == 1 and position == 0 and exit_reason is None and ts < close_bar:
            allowed, reason = risk_mgr.can_trade(ts)
            if not allowed:
                continue

            sl  = risk_mgr.sl_price(price, atr)
            tp  = risk_mgr.tp_price(price, atr)
            qty = risk_mgr.position_size(cash, price, sl)

            if qty > 0 and cash >= qty * price:
                position    = qty
                entry_price = price
                sl_price    = sl
                tp_price    = tp
                entry_time  = ts
                cash       -= qty * price

    return trades


# ── Core runner ───────────────────────────────────────────────────────────────

def run(
    symbols:    list[str],
    start_date: str,
    end_date:   str,
    capital:    float = 100_000,
    risk_config: RiskConfig = None,
    interval:   str = "5m",
    save_to_db: bool = True,
) -> dict:
    """
    Walk-forward backtest over a date range and list of symbols.

    Args:
        symbols:     list of symbol names from universe (e.g. ["RELIANCE", "SBIN"])
        start_date:  "YYYY-MM-DD"
        end_date:    "YYYY-MM-DD"
        capital:     starting capital per symbol (each symbol gets its own allocation)
        risk_config: override default RiskConfig if needed
        interval:    bar size (default "5m")
        save_to_db:  persist trades to SQLite (default True)

    Returns dict with:
        trades:         list of BacktestTrade
        daily_pnl:      {date: pnl} aggregated across symbols
        regime_stats:   {regime: {trades, wins, pnl}}
        summary:        high-level metrics
    """
    if save_to_db:
        init_db()

    all_trades: list[BacktestTrade] = []
    regime_stats: dict = {"trending": {"trades":0,"wins":0,"pnl":0.0},
                          "sideways": {"trades":0,"wins":0,"pnl":0.0},
                          "high_vol": {"trades":0,"wins":0,"pnl":0.0}}
    daily_pnl: dict = {}

    trading_days = _trading_days(start_date, end_date)
    print(f"\n  Backtest: {len(symbols)} symbols × {len(trading_days)} days  [{start_date} → {end_date}]\n")

    for symbol in symbols:
        ticker   = get_ticker(symbol)
        risk_mgr = RiskManager(capital, risk_config)
        print(f"  {symbol}", end="", flush=True)

        for day in trading_days:
            risk_mgr.reset_daily()
            day_str = day.strftime("%Y-%m-%d")

            # Fetch candles — try cache first
            df = _fetch_day(ticker, symbol, day_str, interval)
            if df is None or len(df) < 10:
                print(".", end="", flush=True)
                continue

            # Compute all indicators
            try:
                df = compute_all(df)
            except Exception:
                print("x", end="", flush=True)
                continue

            # Classify regime from first 30 min — use IST hour regardless of index tz
            first_ist = df.index[0].astimezone(IST)
            obs_end    = first_ist.replace(hour=9, minute=45, second=0, microsecond=0)
            obs_window = df[df.index <= obs_end]
            if obs_window.empty:
                print(".", end="", flush=True)
                continue

            regime_info = classify(obs_window)
            regime      = regime_info["regime"]

            # high_vol → no trade in V1
            strategy_fn = select_strategy(regime)
            if strategy_fn is None:
                print("v", end="", flush=True)   # 'v' = high_vol skip
                continue

            # Simulate the day
            day_trades = _simulate_day(
                df, symbol, day_str, regime_info,
                strategy_fn, risk_mgr, capital,
            )
            all_trades.extend(day_trades)

            # Accumulate stats
            day_pnl = sum(t.pnl for t in day_trades)
            daily_pnl[day_str] = daily_pnl.get(day_str, 0.0) + day_pnl

            for t in day_trades:
                rs = regime_stats[t.regime]
                rs["trades"] += 1
                rs["pnl"]    += t.pnl
                if t.pnl > 0:
                    rs["wins"] += 1

            print("+" if day_pnl > 0 else ("-" if day_pnl < 0 else "."), end="", flush=True)

        print()   # newline after each symbol

    # Persist to DB
    if save_to_db and all_trades:
        save_trades([_trade_to_dict(t) for t in all_trades])

    return _build_summary(all_trades, daily_pnl, regime_stats, capital * len(symbols))


# ── Utilities ─────────────────────────────────────────────────────────────────

def _fetch_day(ticker: str, symbol: str, day_str: str, interval: str):
    """Try SQLite cache first; fall back to yfinance."""
    cached = load_candles(symbol, day_str, interval)
    if cached is not None:
        return cached

    try:
        end_buf = (datetime.strptime(day_str, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        df, _   = fetch(ticker, start=day_str, end=end_buf, interval=interval)
        if not df.empty:
            save_candles(symbol, interval, df)
        return df if not df.empty else None
    except Exception:
        return None


def _trading_days(start: str, end: str) -> list[date]:
    """Return weekdays between start and end (inclusive). Excludes NSE holidays approximately."""
    s = datetime.strptime(start, "%Y-%m-%d").date()
    e = datetime.strptime(end,   "%Y-%m-%d").date()
    days = []
    cur  = s
    while cur <= e:
        if cur.weekday() < 5:   # 0=Mon … 4=Fri
            days.append(cur)
        cur += timedelta(days=1)
    return days


def _trade_to_dict(t: BacktestTrade) -> dict:
    return {
        "date": t.date, "symbol": t.symbol,
        "regime": t.regime, "strategy": t.strategy,
        "entry_time": t.entry_time, "exit_time": t.exit_time,
        "entry_price": t.entry_price, "exit_price": t.exit_price,
        "sl_price": t.sl_price, "tp_price": t.tp_price,
        "shares": t.shares, "pnl": t.pnl, "pnl_pct": t.pnl_pct,
        "exit_reason": t.exit_reason, "entry_reason": t.entry_reason,
    }


def _build_summary(trades, daily_pnl, regime_stats, total_capital) -> dict:
    if not trades:
        return {"trades": [], "daily_pnl": {}, "regime_stats": regime_stats,
                "summary": {"total_trades": 0, "pnl": 0}}

    total_pnl  = sum(t.pnl for t in trades)
    wins       = [t for t in trades if t.pnl > 0]
    losses     = [t for t in trades if t.pnl <= 0]
    win_sum    = sum(t.pnl for t in wins)
    loss_sum   = abs(sum(t.pnl for t in losses))

    return {
        "trades":       trades,
        "daily_pnl":    daily_pnl,
        "regime_stats": regime_stats,
        "summary": {
            "total_trades":   len(trades),
            "wins":           len(wins),
            "losses":         len(losses),
            "win_rate":       round(len(wins) / len(trades) * 100, 1) if trades else 0,
            "pnl":            round(total_pnl, 2),
            "return_pct":     round(total_pnl / total_capital * 100, 2),
            "profit_factor":  round(win_sum / loss_sum, 2) if loss_sum else float("inf"),
            "avg_win":        round(np.mean([t.pnl for t in wins]),   2) if wins   else 0,
            "avg_loss":       round(np.mean([t.pnl for t in losses]), 2) if losses else 0,
        },
    }
