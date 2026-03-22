"""
Grand Orchestrator Agent

ユーザーとの対話インターフェースを持つ総監督エージェント。
ユーザーのメッセージを分析し、必要に応じて専門エージェントに
相談しながら、ゲーム開発の方向性を共に決定していく。

主要機能:
  1. ユーザーとの自然な会話
  2. 専門エージェントへの相談（Tool Use）
  3. 合意された設計決定の記録
  4. エージェント構成の動的変更
"""

from __future__ import annotations

import json
import os
import uuid
from typing import Iterator

import anthropic

from agents.specialist_agents import AGENT_REGISTRY, create_agent
from schemas.task import (
    AgentRole,
    ProjectState,
    TaskDirective,
    TaskType,
)


# 専門エージェントへ相談するためのToolスキーマ定義
SPECIALIST_TOOLS = [
    {
        "name": "consult_specialist",
        "description": (
            "専門エージェントに相談する。ゲームデザインの特定トピックについて、"
            "担当専門エージェントの意見・提案・仕様を取得する。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_role": {
                    "type": "string",
                    "enum": [r.value for r in AgentRole if r != AgentRole.ORCHESTRATOR],
                    "description": "相談する専門エージェントのロール",
                },
                "question": {
                    "type": "string",
                    "description": "専門エージェントへの質問・依頼内容",
                },
                "context": {
                    "type": "object",
                    "description": "追加コンテキスト（これまでの設計決定など）",
                    "additionalProperties": True,
                },
            },
            "required": ["agent_role", "question"],
        },
    },
    {
        "name": "record_decision",
        "description": "ユーザーと合意した設計決定事項をプロジェクト状態に記録する",
        "input_schema": {
            "type": "object",
            "properties": {
                "decision_key": {
                    "type": "string",
                    "description": "決定事項のキー（例: 'job_system_style', 'battle_type'）",
                },
                "decision_value": {
                    "type": "string",
                    "description": "決定した内容の説明",
                },
            },
            "required": ["decision_key", "decision_value"],
        },
    },
    {
        "name": "show_team_status",
        "description": "現在のエージェントチーム構成と合意済み設計決定事項を表示する",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "add_agent",
        "description": "エージェントチームに新しいエージェントを追加する",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_role": {
                    "type": "string",
                    "enum": [r.value for r in AgentRole if r != AgentRole.ORCHESTRATOR],
                    "description": "追加するエージェントのロール",
                },
            },
            "required": ["agent_role"],
        },
    },
    {
        "name": "remove_agent",
        "description": "エージェントチームからエージェントを外す",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_role": {
                    "type": "string",
                    "enum": [r.value for r in AgentRole if r != AgentRole.ORCHESTRATOR],
                    "description": "外すエージェントのロール",
                },
            },
            "required": ["agent_role"],
        },
    },
]

ORCHESTRATOR_SYSTEM_PROMPT = """\
あなたは「Grand Orchestrator」という名のAIゲームディレクターです。
ユーザーと協力して、ブレイブリーデフォルト・オクトパストラベラーから
インスパイアされたスマホRPGを開発します。

あなたには専門エージェントチームがいます:
- game_design: ゲームデザイン全般・GDD
- job_system: ジョブシステム設計（このゲームの核心）
- battle_system: バトルシステム・戦闘メカニクス
- narrative: ストーリー・キャラクター・世界観
- ui_ux: スマホUI/UX設計
- code_gen: コード生成・実装
- qa_balance: バランス検証・テスト
- devops: ビルド・デプロイ

あなたの役割:
1. ユーザーのアイデアや要望をしっかり聞く
2. 必要に応じて専門エージェントに相談し、専門的な提案を取得する
3. 複数の選択肢を提示してユーザーに決定を委ねる
4. 合意された決定事項を記録する
5. エージェントチームの構成をユーザーの要望に合わせて調整する

対話スタイル:
- フレンドリーで熱意があり、ゲームに情熱を持って接する
- 専門的すぎない言葉でわかりやすく説明する
- ユーザーの意見を尊重し、押し付けない
- 具体的な例や比較を使って説明する
- 「ブレイブリーデフォルトだと...」「オクトパストラベラーだと...」のような参照を活用する

重要: ユーザーが何か設計について決めたら、必ずrecord_decisionツールで記録すること。
また、複雑なトピックは専門エージェントに相談してから回答すること。

日本語で回答する。
"""


class GrandOrchestrator:
    """
    Grand Orchestrator Agent

    ユーザーとの対話を管理し、専門エージェントチームを調整する。

    Usage:
        orchestrator = GrandOrchestrator()
        orchestrator.start_conversation()  # 対話ループ開始
    """

    def __init__(self, model: str = "claude-opus-4-6"):
        self.model = model
        self.client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        self.project_state = ProjectState()
        self._conversation: list[dict] = []
        # 専門エージェントインスタンスのキャッシュ
        self._agents: dict[AgentRole, object] = {}

    def chat(self, user_message: str, print_stream: bool = True) -> str:
        """
        ユーザーメッセージを受け取り、応答を返す

        内部でtool_useループを実行し、必要に応じて専門エージェントに相談する。

        Args:
            user_message: ユーザーのメッセージ
            print_stream: ストリーミング出力するか

        Returns:
            Orchestratorの最終応答テキスト
        """
        self._conversation.append({"role": "user", "content": user_message})
        self.project_state.add_turn("user", user_message)

        final_response = ""

        # tool_useループ
        while True:
            params = {
                "model": self.model,
                "max_tokens": 8192,
                "system": ORCHESTRATOR_SYSTEM_PROMPT,
                "messages": self._conversation,
                "tools": SPECIALIST_TOOLS,
                "thinking": {"type": "adaptive"},
            }

            response = self.client.messages.create(**params)

            # アシスタントのターンを履歴に追加
            self._conversation.append({"role": "assistant", "content": response.content})

            # tool_useがない場合 → 最終応答
            if response.stop_reason == "end_turn":
                for block in response.content:
                    if block.type == "text":
                        final_response += block.text
                break

            # tool_useを処理
            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = self._execute_tool(block.name, block.input)
                        if print_stream and block.name == "consult_specialist":
                            print(f"\n  [→ {block.input.get('agent_role', '?')}エージェントに相談中...]\n")
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        })

                self._conversation.append({"role": "user", "content": tool_results})
            else:
                # その他の停止理由
                for block in response.content:
                    if block.type == "text":
                        final_response += block.text
                break

        self.project_state.add_turn("assistant", final_response)
        return final_response

    def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        """ツールを実行して結果を返す"""
        try:
            if tool_name == "consult_specialist":
                return self._consult_specialist(
                    role_str=tool_input["agent_role"],
                    question=tool_input["question"],
                    context=tool_input.get("context", {}),
                )
            elif tool_name == "record_decision":
                return self._record_decision(
                    key=tool_input["decision_key"],
                    value=tool_input["decision_value"],
                )
            elif tool_name == "show_team_status":
                return self._show_team_status()
            elif tool_name == "add_agent":
                return self._add_agent(tool_input["agent_role"])
            elif tool_name == "remove_agent":
                return self._remove_agent(tool_input["agent_role"])
            else:
                return f"エラー: 不明なツール '{tool_name}'"
        except Exception as e:
            return f"ツール実行エラー ({tool_name}): {e}"

    def _consult_specialist(
        self, role_str: str, question: str, context: dict
    ) -> str:
        """専門エージェントに相談し、回答を返す"""
        try:
            role = AgentRole(role_str)
        except ValueError:
            return f"エラー: 不明なエージェントロール '{role_str}'"

        if role not in self.project_state.active_agents:
            return f"エラー: {role_str}エージェントはチームにいません"

        # エージェントをキャッシュから取得（なければ作成）
        if role not in self._agents:
            self._agents[role] = create_agent(role, model=self.model)

        agent = self._agents[role]

        # 現在の設計決定コンテキストを追加
        full_context = {
            "プロジェクト名": self.project_state.project_name,
            **self.project_state.agreed_decisions,
            **context,
        }

        response = agent.consult(
            user_message=question,
            context=full_context,
            use_thinking=True,
            stream=False,
        )
        return f"【{role_str}エージェントの回答】\n{response}"

    def _record_decision(self, key: str, value: str) -> str:
        """設計決定を記録する"""
        self.project_state.add_decision(key, value)
        return f"✓ 設計決定を記録しました: {key} = {value}"

    def _show_team_status(self) -> str:
        """チーム状態を返す"""
        active = [r.value for r in self.project_state.active_agents]
        decisions = self.project_state.get_decisions_summary()
        return (
            f"【現在のエージェントチーム】\n"
            f"{', '.join(active)}\n\n"
            f"{decisions}"
        )

    def _add_agent(self, role_str: str) -> str:
        """エージェントを追加する"""
        try:
            role = AgentRole(role_str)
        except ValueError:
            return f"エラー: 不明なロール '{role_str}'"

        if role in self.project_state.active_agents:
            return f"{role_str}エージェントは既にチームにいます"

        self.project_state.active_agents.append(role)
        return f"✓ {role_str}エージェントをチームに追加しました"

    def _remove_agent(self, role_str: str) -> str:
        """エージェントを外す"""
        try:
            role = AgentRole(role_str)
        except ValueError:
            return f"エラー: 不明なロール '{role_str}'"

        if role not in self.project_state.active_agents:
            return f"{role_str}エージェントはチームにいません"

        self.project_state.active_agents.remove(role)
        # キャッシュからも削除
        self._agents.pop(role, None)
        return f"✓ {role_str}エージェントをチームから外しました"

    def start_conversation(self) -> None:
        """
        インタラクティブな対話ループを開始する

        ユーザーが 'quit' か 'exit' を入力するまで継続する。
        """
        print("\n" + "="*60)
        print("  Grand Orchestrator - スマホRPG開発 AIエージェントチーム")
        print("="*60)
        print("ブレイブリーデフォルト × オクトパストラベラー風の")
        print("最高のスマホRPGを一緒に作りましょう！")
        print("\nコマンド:")
        print("  'status' - チーム状態と合意済み決定を表示")
        print("  'quit' または 'exit' - 終了")
        print("="*60 + "\n")

        while True:
            try:
                user_input = input("あなた> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\nさようなら！素晴らしいゲームを作りましょう！")
                break

            if not user_input:
                continue

            if user_input.lower() in ("quit", "exit", "終了"):
                print("\nさようなら！素晴らしいゲームを作りましょう！")
                break

            if user_input.lower() == "status":
                print("\n" + self._show_team_status() + "\n")
                continue

            print("\nOrchestrator> ", end="", flush=True)
            response = self.chat(user_input, print_stream=True)
            print(response)
            print()
