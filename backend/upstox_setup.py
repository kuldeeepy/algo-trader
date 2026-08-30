#!/usr/bin/env python3
"""
One-time Upstox access token setup.

Run this script once whenever your token expires (daily at 3:30 AM IST):
    python backend/upstox_setup.py

Steps:
    1. Go to https://developer.upstox.com → Your App → Get Token
    2. Complete the login flow and copy the access_token
    3. Paste it here when prompted
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from upstox_data import save_access_token, symbol_to_key, fetch_upstox
from datetime import date, timedelta


def main():
    print("\n=== Upstox Token Setup ===\n")
    print("Get your access token from:")
    print("  https://developer.upstox.com → Your App → Get Token\n")

    token = input("Paste access_token: ").strip()
    if not token:
        print("No token provided. Exiting.")
        sys.exit(1)

    save_access_token(token)
    print("\nToken saved. Testing connection...\n")

    # Test with a quick NIFTY 50 stock
    try:
        today     = date.today()
        from_date = (today - timedelta(days=5)).strftime("%Y-%m-%d")
        to_date   = today.strftime("%Y-%m-%d")

        df = fetch_upstox("HDFCBANK", from_date, to_date, interval="5m")
        if df.empty:
            print("WARNING: No data returned — market may have been closed or token issue.")
        else:
            print(f"OK — fetched {len(df)} bars for HDFCBANK ({from_date} → {to_date})")
            print(f"  Latest bar: {df.index[-1].strftime('%Y-%m-%d %H:%M IST')}  close={df['close'].iloc[-1]:.2f}")
            print("\nUpstox is ready to use!")
    except Exception as e:
        print(f"ERROR: {e}")
        print("\nToken may be wrong or expired. Try again with a fresh token.")
        sys.exit(1)


if __name__ == "__main__":
    main()
