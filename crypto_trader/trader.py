"""Main trading engine — run loop, logging, and performance reporting."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from rich.console import Console
from rich.table import Table
from rich import box

from .config import TradingConfig
from .exchange import ExchangeClient
from .strategy import Signal, evaluate

console = Console()
logger = logging.getLogger(__name__)


def _setup_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        level=level,
    )


def _print_status(client: ExchangeClient, cfg: TradingConfig, price: float, result) -> None:
    """Render a live status table with rich."""
    pos = client.position
    balance = client.balance
    unrealised = (price - pos.entry_price) * pos.size if pos else 0.0
    equity = balance + (pos.size * price if pos else 0.0)
    dd = client.drawdown(equity)

    table = Table(
        title=f"[bold cyan]{cfg.symbol}[/] — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        box=box.ROUNDED,
        show_header=True,
    )
    table.add_column("Field", style="bold")
    table.add_column("Value", justify="right")

    mode_label = "[yellow]PAPER[/]" if cfg.paper_trading else "[red]LIVE[/]"
    table.add_row("Mode", mode_label)
    table.add_row("Exchange", cfg.exchange.upper())
    table.add_row("Price", f"${price:,.2f}")
    table.add_row("Signal", f"[green]{result.signal.value}[/]" if result.signal == Signal.BUY
                  else f"[red]{result.signal.value}[/]" if result.signal == Signal.SELL
                  else result.signal.value)
    table.add_row("RSI", f"{result.rsi:.1f}")
    table.add_row("EMA fast/slow", f"{result.ema_fast:,.2f} / {result.ema_slow:,.2f}")
    table.add_row("Balance", f"${balance:,.2f}")
    table.add_row("Equity", f"${equity:,.2f}")

    if pos:
        color = "green" if unrealised >= 0 else "red"
        table.add_row("Position entry", f"${pos.entry_price:,.2f}")
        table.add_row("Stop loss", f"${pos.stop_loss:,.2f}")
        table.add_row("Take profit", f"${pos.take_profit:,.2f}")
        table.add_row("Unrealised PnL", f"[{color}]${unrealised:+,.2f}[/]")
    else:
        table.add_row("Position", "—")

    dd_color = "red" if dd > 0.10 else "yellow" if dd > 0.05 else "green"
    table.add_row("Drawdown", f"[{dd_color}]{dd*100:.1f}%[/]")
    table.add_row("Reason", result.reason)

    console.print(table)


def _print_summary(client: ExchangeClient, cfg: TradingConfig) -> None:
    trades = client.trades
    if not trades:
        console.print("[yellow]No trades executed.[/]")
        return

    sell_trades = [t for t in trades if t.side == "sell"]
    total_pnl = sum(t.pnl for t in sell_trades)
    wins = [t for t in sell_trades if t.pnl > 0]
    win_rate = len(wins) / len(sell_trades) * 100 if sell_trades else 0.0
    final_balance = client.balance
    pct_return = (final_balance - cfg.initial_balance) / cfg.initial_balance * 100

    table = Table(title="[bold]Trade Summary[/]", box=box.ROUNDED)
    table.add_column("Metric", style="bold")
    table.add_column("Value", justify="right")
    table.add_row("Total trades (round-trips)", str(len(sell_trades)))
    table.add_row("Win rate", f"{win_rate:.1f}%")
    table.add_row("Total realised PnL", f"${total_pnl:+,.2f}")
    table.add_row("Initial balance", f"${cfg.initial_balance:,.2f}")
    table.add_row("Final balance", f"${final_balance:,.2f}")
    table.add_row("Return", f"{pct_return:+.2f}%")
    console.print(table)


class AutoTrader:
    def __init__(self, cfg: TradingConfig) -> None:
        self.cfg = cfg
        self.client = ExchangeClient(cfg)
        self._running = False

    def run(self) -> None:
        _setup_logging()
        mode = "PAPER TRADING" if self.cfg.paper_trading else "LIVE TRADING"
        console.rule(f"[bold cyan]Crypto Auto Trader — {mode}[/]")
        console.print(f"  Symbol    : [bold]{self.cfg.symbol}[/]")
        console.print(f"  Exchange  : [bold]{self.cfg.exchange.upper()}[/]")
        console.print(f"  Timeframe : [bold]{self.cfg.timeframe}[/]")
        console.print(f"  Balance   : [bold]${self.cfg.initial_balance:,.2f} USDT[/]")
        console.print(f"  Interval  : [bold]{self.cfg.loop_interval_sec}s[/]")
        console.print()

        self._running = True
        try:
            while self._running:
                self._tick()
                time.sleep(self.cfg.loop_interval_sec)
        except KeyboardInterrupt:
            console.print("\n[yellow]Interrupted by user.[/]")
        finally:
            # Close open position at market price on shutdown
            if self.client.position is not None:
                try:
                    ticker = self.client.fetch_ticker(self.cfg.symbol)
                    price = float(ticker["last"])
                    self.client.sell(self.cfg.symbol, price, reason="shutdown")
                except Exception:
                    pass
            _print_summary(self.client, self.cfg)

    def _tick(self) -> None:
        try:
            df = self.client.fetch_ohlcv(
                self.cfg.symbol, self.cfg.timeframe, limit=self.cfg.lookback_candles
            )
        except Exception as exc:
            logger.error("Failed to fetch OHLCV: %s", exc)
            return

        if len(df) < max(self.cfg.slow_ema, self.cfg.rsi_period) + 10:
            logger.warning("Not enough candles (%d) — skipping.", len(df))
            return

        price = float(df["close"].iloc[-1])

        # --- Stop loss / take profit check ---
        exit_reason = self.client.check_stop_loss_take_profit(price)
        if exit_reason:
            self.client.sell(self.cfg.symbol, price, reason=exit_reason)

        # --- Max drawdown guard ---
        pos = self.client.position
        equity = self.client.balance + (pos.size * price if pos else 0.0)
        if self.client.drawdown(equity) >= self.cfg.max_drawdown_pct:
            console.print(
                f"[bold red]MAX DRAWDOWN {self.cfg.max_drawdown_pct*100:.0f}% reached — "
                "halting trading.[/]"
            )
            if pos:
                self.client.sell(self.cfg.symbol, price, reason="max_drawdown")
            self._running = False
            return

        # --- Strategy signal ---
        result = evaluate(df, self.cfg)
        _print_status(self.client, self.cfg, price, result)

        if result.signal == Signal.BUY and self.client.position is None:
            self.client.buy(self.cfg.symbol, price)
        elif result.signal == Signal.SELL and self.client.position is not None:
            self.client.sell(self.cfg.symbol, price, reason="signal")
