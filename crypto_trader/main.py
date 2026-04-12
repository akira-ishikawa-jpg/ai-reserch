"""CLI entry point.

Usage (paper trading — safe default):
    python -m crypto_trader

Usage (live trading — requires API keys in .env):
    PAPER_TRADING=false python -m crypto_trader

Options via environment variables (see .env.example):
    EXCHANGE          binance / bybit / kraken / coinbase / ...  (default: binance)
    TRADING_SYMBOL    BTC/USDT  (default)
    TIMEFRAME         1h  (default)
    INITIAL_BALANCE   10000
    POSITION_SIZE_PCT 0.10
    STOP_LOSS_PCT     0.02
    TAKE_PROFIT_PCT   0.04
    MAX_DRAWDOWN_PCT  0.20
    LOOP_INTERVAL_SEC 60
    EXCHANGE_API_KEY  <your key>    (required for live trading)
    EXCHANGE_API_SECRET <your secret> (required for live trading)
"""
from __future__ import annotations

import sys

from rich.console import Console

from .config import TradingConfig
from .trader import AutoTrader

console = Console()


def main() -> None:
    cfg = TradingConfig.from_env()

    if not cfg.paper_trading:
        if not cfg.api_key or not cfg.api_secret:
            console.print(
                "[bold red]ERROR:[/] LIVE trading requires EXCHANGE_API_KEY and "
                "EXCHANGE_API_SECRET to be set in your .env file."
            )
            sys.exit(1)
        console.print(
            "[bold red]WARNING:[/] LIVE trading mode is active — real money will be used!\n"
            "Press Ctrl+C within 5 seconds to abort."
        )
        import time
        time.sleep(5)

    trader = AutoTrader(cfg)
    trader.run()


if __name__ == "__main__":
    main()
