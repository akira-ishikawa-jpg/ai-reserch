"""
スマホRPG開発 AIエージェントチーム - エントリポイント

使い方:
    python main.py                    # 対話モード（Orchestratorと話す）
    python main.py --task "..."       # 特定タスクを実行
    python main.py --agent job_system # 特定エージェントと直接話す

環境変数:
    ANTHROPIC_API_KEY: AnthropicのAPIキー（必須）
"""

from __future__ import annotations

import argparse
import os
import sys


def check_api_key() -> None:
    """APIキーの確認"""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("エラー: ANTHROPIC_API_KEY が設定されていません。")
        print("  export ANTHROPIC_API_KEY='your-api-key'")
        sys.exit(1)


def run_interactive_mode() -> None:
    """Grand Orchestratorとの対話モードを起動"""
    from agents.orchestrator import GrandOrchestrator

    orchestrator = GrandOrchestrator()
    orchestrator.start_conversation()


def run_task_mode(task_description: str) -> None:
    """特定タスクをOrchestratorに実行させる"""
    from agents.orchestrator import GrandOrchestrator

    orchestrator = GrandOrchestrator()
    print(f"\nタスクを実行します: {task_description}\n")
    print("Orchestrator> ", end="", flush=True)
    response = orchestrator.chat(task_description)
    print(response)


def run_direct_agent_mode(agent_role_str: str) -> None:
    """特定の専門エージェントと直接対話する"""
    from agents.specialist_agents import AGENT_REGISTRY
    from schemas.task import AgentRole

    try:
        role = AgentRole(agent_role_str)
    except ValueError:
        print(f"エラー: 不明なエージェントロール '{agent_role_str}'")
        print(f"利用可能: {[r.value for r in AgentRole if r != AgentRole.ORCHESTRATOR]}")
        sys.exit(1)

    if role not in AGENT_REGISTRY:
        print(f"エラー: {agent_role_str}エージェントは利用できません")
        sys.exit(1)

    agent_class = AGENT_REGISTRY[role]
    agent = agent_class()

    print(f"\n{agent_role_str}エージェントと直接対話します。")
    print("'quit' で終了\n")

    while True:
        try:
            user_input = input(f"[{agent_role_str}]> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n終了します。")
            break

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit"):
            break

        print("\n回答> ", end="", flush=True)
        response = agent.consult(user_input, stream=True)
        if not response:
            # streamがFalseの場合はconsultが直接返す
            pass
        print(response)
        print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="スマホRPG開発 AIエージェントチーム",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使い方の例:
  python main.py                          # 対話モード（推奨）
  python main.py --task "ジョブシステムを設計して"  # タスク実行
  python main.py --agent job_system       # ジョブシステムエージェントと直接対話
  python main.py --agent game_design      # ゲームデザインエージェントと直接対話
        """,
    )

    parser.add_argument(
        "--task",
        type=str,
        help="実行するタスクの説明（Orchestratorが処理する）",
    )
    parser.add_argument(
        "--agent",
        type=str,
        help="直接対話する専門エージェントのロール",
        choices=[
            "game_design", "job_system", "battle_system",
            "narrative", "ui_ux", "code_gen", "qa_balance", "devops",
        ],
    )
    parser.add_argument(
        "--model",
        type=str,
        default="claude-opus-4-6",
        help="使用するClaudeモデル（デフォルト: claude-opus-4-6）",
    )

    args = parser.parse_args()

    check_api_key()

    if args.task:
        run_task_mode(args.task)
    elif args.agent:
        run_direct_agent_mode(args.agent)
    else:
        run_interactive_mode()


if __name__ == "__main__":
    main()
