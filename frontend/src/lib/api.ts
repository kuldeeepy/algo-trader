const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Candle {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
  signal: -1 | 0 | 1;
}

export interface Trade {
  entry_date:  string;
  exit_date:   string;
  entry_price: number;
  exit_price:  number;
  pnl:         number;
  pnl_pct:     number;
  exit_reason: "stop_loss" | "take_profit" | "signal" | "eod";
  shares:      number;
}

export interface BacktestSummary {
  pnl:               number;
  return_pct:        number;
  total_trades:      number;
  win_rate:          number;
  profit_factor:     number;
  max_drawdown:      number;
  sharpe:            number;
  max_consec_losses: number;
  initial_capital:   number;
}

export interface BacktestResult {
  interval:      string;
  auto_adjusted: boolean;
  candles:       Candle[];
  equity:        { time: number; value: number }[];
  trades:        Trade[];
  summary:       BacktestSummary;
}

// ── Advanced types ─────────────────────────────────────────────────────────────

export type Regime = "trending" | "sideways" | "high_vol";

export interface DayRegime {
  date:       string;
  symbol:     string;
  regime:     Regime;
  confidence: number;
  adx:        number;
  atr_pct:    number;
  vwap_dev:   number;
  strategy:   string;
  expectancy?: Record<string, number>;
  score?:      Record<string, number>;
  risk?:       Record<string, unknown>;
  decision_reason?: string;
}

export interface TradeFactors {
  regime_fit:      number;
  signal_strength: number;
  risk_reward:     number;
  liquidity:       number;
}

export interface AdvancedTrade {
  id:          number;
  date:        string;
  symbol:      string;
  sector?:     string;
  regime:      Regime;
  strategy:    string;
  side:        "LONG" | "SHORT";
  entry_time:  string;
  exit_time:   string;
  entry_price: number;
  exit_price:  number;
  sl_price:    number;
  tp_price:    number;
  shares:      number;
  pnl:         number;
  pnl_pct:     number;
  exit_reason: string;
  confidence:  number;
  factors:     TradeFactors;
}

export interface RegimeStat {
  trades:   number;
  wins:     number;
  pnl:      number;
  win_rate: number;
  days:     number;
}

export interface EquityPoint {
  date:    string;
  value:   number;
  dd:      number;
  dayPnL:  number;
}

export interface PerStockStat {
  symbol:    string;
  sector:    string;
  trades:    number;
  wins:      number;
  win_rate:  number;
  pnl:       number;
  sparkline: number[];
}

export interface SymbolRegimeMix {
  symbol:   string;
  trending: number;
  sideways: number;
  vol:      number;
}

export interface AdvancedSummary {
  total_trades:  number;
  wins:          number;
  losses:        number;
  win_rate:      number;
  pnl:           number;
  return_pct:    number;
  profit_factor: number;
  expectancy:    number;
  avg_win:       number;
  avg_loss:      number;
  max_drawdown:  number;
  sharpe:        number;
  start_eq:      number;
  end_eq:        number;
}

export interface AdvancedResult {
  summary:          AdvancedSummary;
  regime_stats:     Record<string, RegimeStat>;
  day_regimes:      DayRegime[];
  daily_pnl:        Record<string, number>;
  trades:           AdvancedTrade[];
  equity:           EquityPoint[];
  per_stock:        PerStockStat[];
  symbol_breakdown: SymbolRegimeMix[];
}

export interface IntradayCandle {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface MarketStatus {
  label:  string;
  color:  string;
  time:   string;
  detail: string;
}

export interface StockSuggestion {
  symbol:   string;
  name:     string;
  exchange: string;
}

export interface UniverseStock {
  symbol: string;
  name?:  string;
  sector: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  marketStatus: () => get<MarketStatus>("/market-status"),

  search: (q: string) => get<StockSuggestion[]>(`/search?q=${encodeURIComponent(q)}`),

  universe: () => get<UniverseStock[]>("/universe"),

  price: (ticker: string) =>
    get<{ ticker: string; price: number; change: number; change_pct: number }>(`/price/${ticker}`),

  backtest: (params: {
    ticker:   string;
    start:    string;
    end:      string;
    strategy: string;
    sl_pct:   number;
    tp_pct:   number;
    capital:  number;
    interval: string | null;
  }) => post<BacktestResult>("/backtest", params),

  advancedBacktest: (params: {
    symbols:             string[];
    start:               string;
    end:                 string;
    capital:             number;
    interval:            string;
    risk_pct:            number;
    max_loss_pct:        number;
    strategy:            string | null;
    enabled_strategies:  string[];
    scan_universe:       boolean;
    max_positions:       number;
  }) => post<AdvancedResult>("/advanced-backtest", params),

  intraday: (params: { symbol: string; date: string; interval: string }) =>
    get<IntradayCandle[]>(`/intraday?symbol=${encodeURIComponent(params.symbol)}&date=${params.date}&interval=${params.interval}`),

  strategies: () => get<StrategyMeta[]>("/strategies"),
};

export interface StrategyParam {
  label:   string;
  default: number;
  min:     number;
  max:     number;
  step:    number;
}

export interface StrategyMeta {
  id:          string;
  name:        string;
  description: string;
  regime:      string;
  params:      Record<string, StrategyParam>;
}
