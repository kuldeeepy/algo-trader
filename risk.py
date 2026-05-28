"""
Risk engine — enforces all trading rules before and after each trade.

Rules (from design doc):
  - 1% capital risk per trade
  - 2% max daily loss (hard stop — no more trades today)
  - Max 5 trades per day
  - Cooldown of 60 min after 2 consecutive losses
  - ATR-based SL/TP instead of fixed percentages

Usage:
    mgr = RiskManager(capital=100_000)
    mgr.reset_daily()                           # call at start of each day
    if mgr.can_trade(timestamp):
        sl = mgr.sl_price(entry, atr)
        tp = mgr.tp_price(entry, atr)
        qty = mgr.position_size(cash, entry, sl)
    mgr.record_trade(pnl, timestamp)            # call after each trade closes
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


@dataclass
class RiskConfig:
    risk_per_trade_pct:    float = 1.0   # % of capital to risk per trade
    max_daily_loss_pct:    float = 2.0   # halt trading after this daily loss
    max_trades_per_day:    int   = 5
    cooldown_after_losses: int   = 2     # consecutive losses before cooldown
    cooldown_minutes:      int   = 60
    sl_atr_mult:           float = 1.2   # stop loss = entry ± sl_mult * ATR
    tp_atr_mult:           float = 2.0   # take profit = entry ± tp_mult * ATR


class RiskManager:
    def __init__(self, capital: float, config: RiskConfig = None):
        self.capital = capital
        self.cfg     = config or RiskConfig()

        # State — reset each day via reset_daily()
        self.daily_pnl:         float         = 0.0
        self.trades_today:      int           = 0
        self.consec_losses:     int           = 0
        self.cooldown_until = None  # datetime or None

    def reset_daily(self) -> None:
        """Call at the start of each new trading day."""
        self.daily_pnl      = 0.0
        self.trades_today   = 0
        self.consec_losses  = 0
        self.cooldown_until = None

    # ── Pre-trade checks ──────────────────────────────────────────────────────

    def can_trade(self, ts: datetime) -> tuple[bool, str]:
        """
        Returns (allowed, reason).
        Check all rules before opening a new position.
        """
        max_loss = self.capital * (self.cfg.max_daily_loss_pct / 100)
        if self.daily_pnl <= -max_loss:
            return False, f"daily loss limit hit ({self.daily_pnl:.2f})"

        if self.trades_today >= self.cfg.max_trades_per_day:
            return False, f"max trades/day reached ({self.cfg.max_trades_per_day})"

        if self.cooldown_until and ts < self.cooldown_until:
            remaining = int((self.cooldown_until - ts).total_seconds() / 60)
            return False, f"cooldown active ({remaining} min remaining)"

        return True, "ok"

    # ── Sizing + levels ───────────────────────────────────────────────────────

    def position_size(self, cash: float, entry_price: float, sl_price: float) -> int:
        """
        ATR-based position sizing.
        shares = (capital * risk%) / stop_distance
        Capped by available cash.
        """
        stop_distance = abs(entry_price - sl_price)
        if stop_distance == 0:
            return 0
        risk_amount = self.capital * (self.cfg.risk_per_trade_pct / 100)
        shares = int(risk_amount / stop_distance)
        # Don't exceed available cash
        max_by_cash = int(cash // entry_price)
        return min(shares, max_by_cash)

    def sl_price(self, entry: float, atr: float, direction: int = 1) -> float:
        """Stop loss: entry minus (sl_mult * ATR) for longs."""
        return round(entry - direction * self.cfg.sl_atr_mult * atr, 2)

    def tp_price(self, entry: float, atr: float, direction: int = 1) -> float:
        """Take profit: entry plus (tp_mult * ATR) for longs."""
        return round(entry + direction * self.cfg.tp_atr_mult * atr, 2)

    # ── Post-trade update ─────────────────────────────────────────────────────

    def record_trade(self, pnl: float, ts: datetime) -> None:
        """Update state after a trade closes."""
        self.daily_pnl    += pnl
        self.trades_today += 1

        if pnl <= 0:
            self.consec_losses += 1
            # Trigger cooldown after N consecutive losses
            if self.consec_losses >= self.cfg.cooldown_after_losses:
                self.cooldown_until = ts + timedelta(minutes=self.cfg.cooldown_minutes)
                self.consec_losses  = 0   # reset so next block also gets a chance
        else:
            self.consec_losses = 0
