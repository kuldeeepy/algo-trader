# AlphaScope

An intraday backtester for NSE stocks. It classifies each trading session's
regime from the opening window, picks the strategy that historically suits that
regime, and simulates the day with real position sizing and costs.

**[Live demo →](https://algo-trader-six.vercel.app)**

## The idea

Most backtesters apply one strategy to every day, which hides the fact that a
strategy is usually only good in one kind of market. An opening range breakout
works on a trending morning and bleeds on a choppy one.

So this runs in two stages. It reads the 09:15–09:45 window, classifies the day
as trending, sideways or high volatility, then hands the day to the strategy
that scored best on that regime historically. You can also force one strategy
for every day and compare.

Every trade is costed — 4bps slippage and ₹20 per order — because a strategy
that only works before costs doesn't work.

## Running it

Backend:

```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cd backend && ../venv/bin/uvicorn api:app --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to port 8000, so both need to be running. First launch
downloads the NSE instrument list; candles are cached in `data/` after that.

Don't install with `--only-binary=:all:` — the Upstox SDK ships as an sdist and
pip will fail to resolve the whole file.

## Data

yfinance by default, which only goes back 60 days for intraday bars. Upstox
gives 1–2 years of 5-minute data and is used automatically when a token is
present:

```bash
./venv/bin/python backend/upstox_setup.py
```

Tokens expire daily at 3:30 AM IST. Without one, everything still runs on
yfinance — just over a shorter window.

## Layout

```
backend/
  api.py         FastAPI wrapper — the only thing the frontend talks to
  engine.py      candles, indicators, single-strategy backtest
  backtest.py    the regime-aware run
  selector.py    picks a strategy per day (gradient boosting + scoring)
  regime.py      classifies the session from its opening window
  strategies.py  ORB, VWAP reversion, gap fade, momentum
  risk.py        position sizing, daily loss cap
  store.py       sqlite candle cache
frontend/        Vite + React, lightweight-charts
```

Everything else in `backend/` is a CLI script with a `__main__` — validation
harnesses and research runs.

## Deploying

The frontend is static and builds with `VITE_API_BASE` pointing at the API host.
The backend needs a real server rather than serverless: a one-symbol, one-month
regime run takes about 30 seconds, well past a typical 10s function limit.

Set `ALGO_CORS_ORIGINS` on the API to the frontend's origin.

## Notes

All results are simulated on historical data. This is a research tool, not
advice, and it doesn't place orders.
