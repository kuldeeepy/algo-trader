"""
Bulk candle prefetch for the scan universe.

One ranged Upstox fetch per symbol (chunked internally) instead of the
per-day fetch path — turns ~25,000 API calls into ~1,300.

Usage:
    python prefetch.py [start] [end]      # defaults: 2025-06-01 → yesterday
"""

import sys
import time
from datetime import date, timedelta

from universe import SCAN_UNIVERSE
from upstox_data import fetch_upstox
from store import init_db, save_candles


def prefetch(start: str, end: str, symbols: list[str] = None) -> None:
    init_db()
    symbols = symbols or SCAN_UNIVERSE
    ok, failed = 0, []
    for i, sym in enumerate(symbols, 1):
        try:
            t0 = time.time()
            df = fetch_upstox(sym, start, end, interval="5m")
            if df.empty:
                failed.append(sym)
                print(f"[{i}/{len(symbols)}] {sym}: EMPTY", flush=True)
                continue
            save_candles(f"{sym}.NS", "5m", df)
            ok += 1
            print(f"[{i}/{len(symbols)}] {sym}: {len(df)} bars in {time.time()-t0:.1f}s", flush=True)
        except Exception as e:
            failed.append(sym)
            print(f"[{i}/{len(symbols)}] {sym}: FAILED {e}", flush=True)
    print(f"\nDone: {ok} ok, {len(failed)} failed: {failed}", flush=True)


if __name__ == "__main__":
    start = sys.argv[1] if len(sys.argv) > 1 else "2025-06-01"
    end   = sys.argv[2] if len(sys.argv) > 2 else (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    prefetch(start, end)
