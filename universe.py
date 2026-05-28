"""
Stock universe for the trading engine.
Top 20 liquid NSE stocks — NIFTY50 large-caps + high-volume F&O names.
Selected by: F&O availability, avg daily turnover, tight bid-ask spreads.
"""

# symbol → yfinance ticker
UNIVERSE: dict[str, str] = {
    # Banking & Finance (most liquid, highest F&O OI)
    "HDFCBANK":   "HDFCBANK.NS",
    "ICICIBANK":  "ICICIBANK.NS",
    "SBIN":       "SBIN.NS",
    "AXISBANK":   "AXISBANK.NS",
    "KOTAKBANK":  "KOTAKBANK.NS",
    "BAJFINANCE": "BAJFINANCE.NS",

    # IT (high volume, trend-friendly)
    "TCS":        "TCS.NS",
    "INFY":       "INFY.NS",
    "HCLTECH":    "HCLTECH.NS",
    "WIPRO":      "WIPRO.NS",

    # Large-cap diversified
    "RELIANCE":   "RELIANCE.NS",
    "LT":         "LT.NS",
    "BHARTIARTL": "BHARTIARTL.NS",

    # Auto & Metal (volatile, good for breakouts)
    "TATAMOTORS": "TATAMOTORS.NS",
    "TATASTEEL":  "TATASTEEL.NS",
    "JSWSTEEL":   "JSWSTEEL.NS",

    # Energy & Infra
    "ONGC":       "ONGC.NS",
    "NTPC":       "NTPC.NS",
    "POWERGRID":  "POWERGRID.NS",

    # Pharma
    "SUNPHARMA":  "SUNPHARMA.NS",
}

# Sector mapping — used for sector-strength scoring in Phase 2
SECTORS: dict[str, list[str]] = {
    "BANKING":  ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK"],
    "FINANCE":  ["BAJFINANCE"],
    "IT":       ["TCS", "INFY", "HCLTECH", "WIPRO"],
    "ENERGY":   ["RELIANCE", "ONGC", "NTPC", "POWERGRID"],
    "AUTO":     ["TATAMOTORS"],
    "METALS":   ["TATASTEEL", "JSWSTEEL"],
    "INFRA":    ["LT"],
    "TELECOM":  ["BHARTIARTL"],
    "PHARMA":   ["SUNPHARMA"],
}

# Reverse map: symbol → sector (derived from SECTORS above)
SYMBOL_SECTOR: dict[str, str] = {
    sym: sector
    for sector, symbols in SECTORS.items()
    for sym in symbols
}

# Scoring weights for daily stock ranking (Phase 2)
# Must sum to 1.0
RANKING_WEIGHTS: dict[str, float] = {
    "relative_volume": 0.25,  # today's volume vs 20-day avg
    "atr_volatility":  0.20,  # ATR/price — how much it moves
    "gap":             0.20,  # open vs prev close
    "sector_strength": 0.15,  # how strong the sector is today
    "trend_strength":  0.20,  # ADX-based trend score
}


def get_ticker(symbol: str) -> str:
    """Return yfinance ticker. Falls back to symbol itself for non-universe stocks (e.g. IOC.NS from search)."""
    return UNIVERSE.get(symbol.upper(), symbol)


def all_tickers() -> list[str]:
    return list(UNIVERSE.values())


def all_symbols() -> list[str]:
    return list(UNIVERSE.keys())
