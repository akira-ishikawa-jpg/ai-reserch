"""Exchange client wrapping ccxt.

Paper trading mode uses real market data but simulates all order execution.
Live trading mode sends real orders — requires valid API credentials.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import ccxt
import pandas as pd

from .config import TradingConfig

logger = logging.getLogger(__name__)


@dataclass
class Position:
    symbol: str
    side: str           # "long"
    entry_price: float
    size: float         # base currency amount
    stop_loss: float
    take_profit: float
    opened_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Trade:
    symbol: str
    side: str           # "buy" | "sell"
    price: float
    size: float
    pnl: float          # realised PnL in quote currency
    timestamp: datetime = field(default_factory=datetime.utcnow)


class ExchangeClient:
    """Unified interface for paper trading and live trading."""

    def __init__(self, cfg: TradingConfig) -> None:
        self.cfg = cfg
        self.paper = cfg.paper_trading

        # Balance tracking (paper mode only)
        self._balance: float = cfg.initial_balance
        self._position: Optional[Position] = None
        self._trades: list[Trade] = []
        self._peak_balance: float = cfg.initial_balance

        # ccxt exchange (always created for market data, even in paper mode)
        exchange_cls = getattr(ccxt, cfg.exchange)
        exchange_kwargs: dict = {"enableRateLimit": True}
        if cfg.api_key and cfg.api_secret and not self.paper:
            exchange_kwargs["apiKey"] = cfg.api_key
            exchange_kwargs["secret"] = cfg.api_secret
        self._exchange: ccxt.Exchange = exchange_cls(exchange_kwargs)

    # ------------------------------------------------------------------
    # Market data (always real)
    # ------------------------------------------------------------------

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 200) -> pd.DataFrame:
        raw = self._exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        df = pd.DataFrame(raw, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
        df.set_index("timestamp", inplace=True)
        return df

    def fetch_ticker(self, symbol: str) -> dict:
        return self._exchange.fetch_ticker(symbol)

    # ------------------------------------------------------------------
    # Order execution
    # ------------------------------------------------------------------

    def buy(self, symbol: str, price: float) -> Optional[Trade]:
        """Open a long position sized by config."""
        if self._position is not None:
            logger.debug("buy() skipped — already in position")
            return None

        size = (self._balance * self.cfg.position_size_pct) / price
        cost = size * price

        if self.paper:
            self._balance -= cost
            sl = price * (1 - self.cfg.stop_loss_pct)
            tp = price * (1 + self.cfg.take_profit_pct)
            self._position = Position(symbol, "long", price, size, sl, tp)
            trade = Trade(symbol, "buy", price, size, pnl=0.0)
            self._trades.append(trade)
            logger.info("PAPER BUY  %.6f %s @ %.4f  SL=%.4f  TP=%.4f",
                        size, symbol, price, sl, tp)
            return trade
        else:
            order = self._exchange.create_market_buy_order(symbol, size)
            fill_price = order.get("average") or price
            sl = fill_price * (1 - self.cfg.stop_loss_pct)
            tp = fill_price * (1 + self.cfg.take_profit_pct)
            self._position = Position(symbol, "long", fill_price, size, sl, tp)
            trade = Trade(symbol, "buy", fill_price, size, pnl=0.0)
            self._trades.append(trade)
            logger.info("LIVE BUY  %.6f %s @ %.4f", size, symbol, fill_price)
            return trade

    def sell(self, symbol: str, price: float, reason: str = "") -> Optional[Trade]:
        """Close an open long position."""
        if self._position is None:
            logger.debug("sell() skipped — no open position")
            return None

        pos = self._position
        pnl = (price - pos.entry_price) * pos.size

        if self.paper:
            proceeds = pos.size * price
            self._balance += proceeds
            self._peak_balance = max(self._peak_balance, self._balance)
            trade = Trade(symbol, "sell", price, pos.size, pnl=pnl)
            self._trades.append(trade)
            self._position = None
            logger.info(
                "PAPER SELL %.6f %s @ %.4f  PnL=%+.2f USDT  [%s]",
                pos.size, symbol, price, pnl, reason,
            )
            return trade
        else:
            order = self._exchange.create_market_sell_order(symbol, pos.size)
            fill_price = order.get("average") or price
            pnl = (fill_price - pos.entry_price) * pos.size
            trade = Trade(symbol, "sell", fill_price, pos.size, pnl=pnl)
            self._trades.append(trade)
            self._position = None
            logger.info("LIVE SELL %.6f %s @ %.4f  PnL=%+.2f", pos.size, symbol, fill_price, pnl)
            return trade

    # ------------------------------------------------------------------
    # Position / balance access
    # ------------------------------------------------------------------

    @property
    def position(self) -> Optional[Position]:
        return self._position

    @property
    def balance(self) -> float:
        if self.paper:
            return self._balance
        bal = self._exchange.fetch_balance()
        return float(bal["USDT"]["free"])

    @property
    def equity(self) -> float:
        """Balance + unrealised P&L."""
        if self._position is None:
            return self._balance
        # For paper mode only; live mode would need ticker price
        return self._balance  # caller adds mark-to-market

    @property
    def trades(self) -> list[Trade]:
        return list(self._trades)

    @property
    def peak_balance(self) -> float:
        return self._peak_balance

    def drawdown(self, current_equity: float) -> float:
        """Current drawdown from peak (0.0 – 1.0)."""
        if self._peak_balance <= 0:
            return 0.0
        return max(0.0, 1.0 - current_equity / self._peak_balance)

    def check_stop_loss_take_profit(self, current_price: float) -> Optional[str]:
        """Return 'stop_loss' | 'take_profit' | None."""
        if self._position is None:
            return None
        pos = self._position
        if current_price <= pos.stop_loss:
            return "stop_loss"
        if current_price >= pos.take_profit:
            return "take_profit"
        return None
