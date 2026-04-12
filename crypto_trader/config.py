"""Trading configuration loaded from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass
class TradingConfig:
    # Exchange
    exchange: str = "binance"
    api_key: Optional[str] = None
    api_secret: Optional[str] = None

    # Market
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"

    # Strategy (EMA crossover + RSI filter)
    fast_ema: int = 12
    slow_ema: int = 26
    rsi_period: int = 14
    rsi_overbought: float = 70.0
    rsi_oversold: float = 30.0

    # Risk management
    paper_trading: bool = True
    initial_balance: float = 10_000.0   # USDT
    position_size_pct: float = 0.10     # 10% of balance per trade
    stop_loss_pct: float = 0.02         # 2% stop loss
    take_profit_pct: float = 0.04       # 4% take profit
    max_drawdown_pct: float = 0.20      # halt if drawdown > 20%

    # Execution
    lookback_candles: int = 200
    loop_interval_sec: int = 60         # check every 60 s

    @classmethod
    def from_env(cls) -> "TradingConfig":
        return cls(
            exchange=os.getenv("EXCHANGE", "binance"),
            api_key=os.getenv("EXCHANGE_API_KEY"),
            api_secret=os.getenv("EXCHANGE_API_SECRET"),
            symbol=os.getenv("TRADING_SYMBOL", "BTC/USDT"),
            timeframe=os.getenv("TIMEFRAME", "1h"),
            paper_trading=os.getenv("PAPER_TRADING", "true").lower() != "false",
            initial_balance=float(os.getenv("INITIAL_BALANCE", "10000")),
            position_size_pct=float(os.getenv("POSITION_SIZE_PCT", "0.10")),
            stop_loss_pct=float(os.getenv("STOP_LOSS_PCT", "0.02")),
            take_profit_pct=float(os.getenv("TAKE_PROFIT_PCT", "0.04")),
            max_drawdown_pct=float(os.getenv("MAX_DRAWDOWN_PCT", "0.20")),
            loop_interval_sec=int(os.getenv("LOOP_INTERVAL_SEC", "60")),
        )
