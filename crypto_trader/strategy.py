"""EMA-crossover + RSI filter strategy.

Signal logic
------------
BUY  : fast EMA crosses above slow EMA  AND  RSI < overbought threshold
SELL : fast EMA crosses below slow EMA  OR   RSI > overbought  (momentum gone)
HOLD : otherwise
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import pandas as pd

from .config import TradingConfig
from .indicators import add_indicators


class Signal(Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


@dataclass
class StrategyResult:
    signal: Signal
    price: float
    rsi: float
    ema_fast: float
    ema_slow: float
    macd_hist: float
    reason: str


def evaluate(df: pd.DataFrame, cfg: TradingConfig) -> StrategyResult:
    """Return the latest trading signal for the given OHLCV dataframe."""
    df = add_indicators(df, cfg)
    row = df.iloc[-1]
    prev = df.iloc[-2]

    price = float(row["close"])
    rsi_val = float(row["rsi"])
    ema_fast = float(row["ema_fast"])
    ema_slow = float(row["ema_slow"])
    macd_hist = float(row["macd_hist"])

    # --- BUY conditions ---
    buy_crossover = bool(row["cross_up"])
    buy_macd = float(prev["macd_hist"]) < 0 and macd_hist > 0   # MACD confirmation
    buy_rsi_ok = rsi_val < cfg.rsi_overbought

    if (buy_crossover or buy_macd) and buy_rsi_ok:
        reason = (
            f"EMA cross-up={buy_crossover}, MACD flip={buy_macd}, "
            f"RSI={rsi_val:.1f}<{cfg.rsi_overbought}"
        )
        return StrategyResult(Signal.BUY, price, rsi_val, ema_fast, ema_slow, macd_hist, reason)

    # --- SELL conditions ---
    sell_crossover = bool(row["cross_down"])
    sell_rsi = rsi_val > cfg.rsi_overbought
    sell_macd = float(prev["macd_hist"]) > 0 and macd_hist < 0   # MACD flip negative

    if sell_crossover or sell_rsi or sell_macd:
        parts = []
        if sell_crossover:
            parts.append("EMA cross-down")
        if sell_rsi:
            parts.append(f"RSI={rsi_val:.1f}>{cfg.rsi_overbought}")
        if sell_macd:
            parts.append("MACD flipped negative")
        return StrategyResult(
            Signal.SELL, price, rsi_val, ema_fast, ema_slow, macd_hist, ", ".join(parts)
        )

    return StrategyResult(
        Signal.HOLD, price, rsi_val, ema_fast, ema_slow, macd_hist,
        f"EMA fast={'>' if ema_fast>ema_slow else '<'} slow, RSI={rsi_val:.1f}"
    )
