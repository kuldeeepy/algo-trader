"""
SQLite storage layer — candle cache + trade log.

Two responsibilities:
  1. Cache fetched candles so we don't re-hit yfinance on every backtest run.
  2. Persist every trade with full context for analytics and future ML use.

DB file: data/cache.db (auto-created on first use).
"""

import sqlite3
import os
import pandas as pd
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "cache.db")


@contextmanager
def _conn():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db() -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    with _conn() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS candles (
                symbol    TEXT    NOT NULL,
                interval  TEXT    NOT NULL,
                timestamp TEXT    NOT NULL,
                open      REAL, high REAL, low REAL, close REAL,
                volume    INTEGER,
                PRIMARY KEY (symbol, interval, timestamp)
            );

            -- One row per simulated trade, fully self-describing
            CREATE TABLE IF NOT EXISTS trades (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                date          TEXT,
                symbol        TEXT,
                regime        TEXT,
                strategy      TEXT,
                entry_time    TEXT,
                exit_time     TEXT,
                entry_price   REAL,
                exit_price    REAL,
                sl_price      REAL,
                tp_price      REAL,
                shares        INTEGER,
                pnl           REAL,
                pnl_pct       REAL,
                exit_reason   TEXT,
                entry_reason  TEXT
            );

            -- Per-day summary for quick analytics queries
            CREATE TABLE IF NOT EXISTS daily_summary (
                date       TEXT NOT NULL,
                symbol     TEXT NOT NULL,
                regime     TEXT,
                strategy   TEXT,
                trades     INTEGER,
                wins       INTEGER,
                pnl        REAL,
                PRIMARY KEY (date, symbol)
            );
        """)


# ── Candle cache ──────────────────────────────────────────────────────────────

def load_candles(symbol: str, date: str, interval: str):
    """
    Try to load a day's candles from cache.
    Returns None if not cached yet.
    """
    with _conn() as con:
        rows = con.execute(
            "SELECT timestamp, open, high, low, close, volume "
            "FROM candles WHERE symbol=? AND interval=? AND timestamp LIKE ? "
            "ORDER BY timestamp",
            (symbol, interval, f"{date}%"),
        ).fetchall()

    if not rows:
        return None

    df = pd.DataFrame(rows, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.set_index("timestamp")
    return df


def save_candles(symbol: str, interval: str, df: pd.DataFrame) -> None:
    """Cache OHLCV rows. Ignores duplicates (INSERT OR IGNORE)."""
    rows = [
        (symbol, interval, str(ts), row.open, row.high, row.low, row.close, int(row.volume))
        for ts, row in df.iterrows()
    ]
    with _conn() as con:
        con.executemany(
            "INSERT OR IGNORE INTO candles "
            "(symbol, interval, timestamp, open, high, low, close, volume) "
            "VALUES (?,?,?,?,?,?,?,?)",
            rows,
        )


# ── Trade log ─────────────────────────────────────────────────────────────────

def save_trades(trades: list[dict]) -> None:
    """Append a list of trade dicts to the trades table."""
    if not trades:
        return
    with _conn() as con:
        con.executemany(
            "INSERT INTO trades "
            "(date, symbol, regime, strategy, entry_time, exit_time, "
            " entry_price, exit_price, sl_price, tp_price, shares, "
            " pnl, pnl_pct, exit_reason, entry_reason) "
            "VALUES (:date,:symbol,:regime,:strategy,:entry_time,:exit_time,"
            ":entry_price,:exit_price,:sl_price,:tp_price,:shares,"
            ":pnl,:pnl_pct,:exit_reason,:entry_reason)",
            trades,
        )


def save_daily_summary(rows: list[dict]) -> None:
    with _conn() as con:
        con.executemany(
            "INSERT OR REPLACE INTO daily_summary "
            "(date, symbol, regime, strategy, trades, wins, pnl) "
            "VALUES (:date,:symbol,:regime,:strategy,:trades,:wins,:pnl)",
            rows,
        )


def load_trades(symbol: str = None, date_from: str = None, date_to: str = None) -> pd.DataFrame:
    """Load trades from the log with optional filters. Returns a DataFrame."""
    query  = "SELECT * FROM trades WHERE 1=1"
    params = []
    if symbol:
        query += " AND symbol=?"; params.append(symbol)
    if date_from:
        query += " AND date>=?"; params.append(date_from)
    if date_to:
        query += " AND date<=?"; params.append(date_to)
    query += " ORDER BY entry_time"

    with _conn() as con:
        rows = con.execute(query, params).fetchall()

    if not rows:
        return pd.DataFrame()
    return pd.DataFrame([dict(r) for r in rows])
