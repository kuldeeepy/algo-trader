"""
V1 strategy implementations for the regime-aware engine.

Two strategies:
    ORB  (Opening Range Breakout) — for trending regime
    VWAP (VWAP Mean Reversion)   — for sideways regime

Both follow the same contract as engine.py strategies:
    input:  enriched OHLCV DataFrame (columns from indicators.compute_all)
    output: same DataFrame with a 'signal' column  (1=buy, -1=sell, 0=hold)

The backtest engine then handles execution, SL/TP, and position sizing.
"""

import pandas as pd
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

# Volume confirmation: require 1.5x average volume on breakout
_VOL_CONFIRM = 1.5

# ORB observation window: first 30 min = 6 bars of 5m data
_ORB_BARS = 6

# VWAP reversion: only enter if price is within this many ATRs of VWAP
# Prevents chasing a stock that has already run far from VWAP
_MAX_VWAP_DIST_ATR = 1.0


def apply_orb(df: pd.DataFrame) -> pd.DataFrame:
    """
    Opening Range Breakout.

    Setup:
        9:15–9:45 AM → establish opening range (high + low of first 6 bars).
        After 9:45   → buy when close breaks above OR high with volume surge.
                       exit when close falls back below OR high (signal reversal).

    Best in: trending regime with strong gap or momentum.
    """
    df = df.copy()
    df["signal"] = 0

    if len(df) <= _ORB_BARS:
        return df

    obs     = df.iloc[:_ORB_BARS]
    or_high = obs["high"].max()
    or_low  = obs["low"].min()
    avg_vol = df["volume"].rolling(20).mean()

    # Compute masks on the full df so the index always aligns
    in_trade_window = pd.Series(False, index=df.index)
    in_trade_window.iloc[_ORB_BARS:] = True

    breakout_up = (
        in_trade_window &
        (df["close"] > or_high) &
        (df["volume"] > avg_vol * _VOL_CONFIRM)
    )
    breakdown = in_trade_window & (df["close"] < or_high)

    df.loc[breakout_up & ~breakout_up.shift(1, fill_value=False), "signal"] =  1
    df.loc[breakdown   & ~breakdown.shift(1,   fill_value=False), "signal"] = -1

    # Also tag with the opening range for charting
    df["or_high"] = or_high
    df["or_low"]  = or_low

    return df


def apply_vwap_reversion(df: pd.DataFrame) -> pd.DataFrame:
    """
    VWAP Mean Reversion.

    Setup:
        Buy  when price crosses ABOVE VWAP from below.
        Sell when price crosses BACK BELOW VWAP.

    Filter:
        Only enter if price is within _MAX_VWAP_DIST_ATR of VWAP — avoids
        chasing after a big move already happened.
        Only enter if ADX < 25 — don't mean-revert into a strong trend.

    Best in: sideways regime with repeated VWAP oscillations.
    """
    df = df.copy()
    df["signal"] = 0

    if "vwap" not in df.columns:
        raise ValueError("DataFrame must have 'vwap' column — run indicators.compute_all first.")

    close      = df["close"]
    vwap_s     = df["vwap"]
    atr_s      = df["atr"]
    adx_s      = df["adx"]

    above_vwap = close > vwap_s
    prev_above = above_vwap.shift(1, fill_value=False)

    # Price distance from VWAP in ATR units
    vwap_dist_atr = (close - vwap_s).abs() / atr_s.replace(0, float("nan"))

    # Conditions for entry
    close_enough = vwap_dist_atr < _MAX_VWAP_DIST_ATR
    not_trending = adx_s < 25

    # Buy: crossed above VWAP + within range + not trending
    buy  = above_vwap  & ~prev_above & close_enough & not_trending
    # Sell: crossed below VWAP (exit long)
    sell = ~above_vwap & prev_above

    df.loc[buy,  "signal"] =  1
    df.loc[sell, "signal"] = -1

    return df


# ── Strategy selector ─────────────────────────────────────────────────────────

STRATEGY_MAP = {
    "trending": apply_orb,
    "sideways": apply_vwap_reversion,
    # high_vol → no trade (too risky for V1)
}


def select_strategy(regime: str):
    """
    Return the strategy function for the given regime.
    Returns None for high_vol — the backtest engine will skip trading.
    """
    return STRATEGY_MAP.get(regime, None)
