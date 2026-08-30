import { create } from "zustand";
import type { AdvancedTrade } from "../lib/api";

const _fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const TODAY = _fmt(new Date());
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return _fmt(d); };

interface AdvancedConfig {
  symbol:         string;
  symbols:        string[];
  from:           string;
  to:             string;
  interval:       "auto" | "1m" | "5m" | "15m";
  capital:        number;
  riskPct:        number;
  maxLoss:        number;
  autoStrategy:   boolean;
  manualStrategy: string | null;
  scanUniverse:   boolean;
  maxPositions:   number;
}

interface AdvancedUI {
  hoveredTrade:    AdvancedTrade | null;
  expandedTradeId: number | null;
  tradeFilter:     "all" | "wins" | "losses" | "trending" | "sideways";
  tradeSearch:     string;
  selectedDay:     string | null;
}

interface AdvancedStore extends AdvancedConfig, AdvancedUI {
  setSymbol:         (s: string) => void;
  setChartSymbol:    (s: string) => void;
  addSymbol:         (s: string) => void;
  removeSymbol:      (s: string) => void;
  clearSymbols:      () => void;
  setFrom:           (v: string) => void;
  setTo:             (v: string) => void;
  setInterval:       (v: AdvancedConfig["interval"]) => void;
  setCapital:        (v: number) => void;
  setRiskPct:        (v: number) => void;
  setMaxLoss:        (v: number) => void;
  setAutoStrategy:   (v: boolean) => void;
  setManualStrategy: (v: string | null) => void;
  setScanUniverse:   (v: boolean) => void;
  setMaxPositions:   (v: number) => void;
  setHoveredTrade:   (t: AdvancedTrade | null) => void;
  setExpandedTrade:  (id: number | null) => void;
  setTradeFilter:    (f: AdvancedUI["tradeFilter"]) => void;
  setTradeSearch:    (s: string) => void;
  setSelectedDay:    (d: string | null) => void;
  reset:             () => void;
}

const DEFAULTS: AdvancedConfig & AdvancedUI = {
  symbol:          "",
  symbols:         [],
  from:            daysAgo(30),
  to:              TODAY,
  interval:        "auto",
  capital:         100000,
  riskPct:         1.0,
  maxLoss:         2.0,
  autoStrategy:    true,
  manualStrategy:  null,
  scanUniverse:    false,
  maxPositions:    3,
  hoveredTrade:    null,
  expandedTradeId: null,
  tradeFilter:     "all",
  tradeSearch:     "",
  selectedDay:     null,
};

export const useAdvancedStore = create<AdvancedStore>((set) => ({
  ...DEFAULTS,
  setSymbol:         (symbol)         => set(state => ({
    symbol,
    symbols: symbol && !state.symbols.includes(symbol) ? [...state.symbols, symbol] : state.symbols,
  })),
  setChartSymbol:    (symbol)         => set({ symbol }),
  addSymbol:         (symbol)         => set(state => {
    const next = state.symbols.includes(symbol) ? state.symbols : [...state.symbols, symbol];
    return { symbols: next, symbol: state.symbol || symbol };
  }),
  removeSymbol:      (symbol)         => set(state => {
    const next = state.symbols.filter(s => s !== symbol);
    return { symbols: next, symbol: state.symbol === symbol ? (next[0] ?? "") : state.symbol };
  }),
  clearSymbols:      ()               => set({ symbols: [], symbol: "" }),
  setFrom:           (from)           => set({ from }),
  setTo:             (to)             => set({ to }),
  setInterval:       (interval)       => set({ interval }),
  setCapital:        (capital)        => set({ capital }),
  setRiskPct:        (riskPct)        => set({ riskPct }),
  setMaxLoss:        (maxLoss)        => set({ maxLoss }),
  setAutoStrategy:   (autoStrategy)   => set({ autoStrategy }),
  setManualStrategy: (manualStrategy) => set({ manualStrategy }),
  setScanUniverse:   (scanUniverse)   => set({ scanUniverse }),
  setMaxPositions:   (maxPositions)   => set({ maxPositions }),
  setHoveredTrade:   (hoveredTrade)   => set({ hoveredTrade }),
  setExpandedTrade:  (expandedTradeId) => set({ expandedTradeId }),
  setTradeFilter:    (tradeFilter)    => set({ tradeFilter }),
  setTradeSearch:    (tradeSearch)    => set({ tradeSearch }),
  setSelectedDay:    (selectedDay)    => set({ selectedDay }),
  reset:             ()               => set(DEFAULTS),
}));
