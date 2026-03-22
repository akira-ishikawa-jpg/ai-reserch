"""
全専門エージェントの共通基底クラス

Claude API (claude-opus-4-6) を使ってメッセージを送受信する基本機能を提供する。
Adaptive Thinkingを有効化し、ストリーミングで応答を受信する。
"""

from __future__ import annotations

import os
from typing import Iterator, Optional

import anthropic

from schemas.task import AgentRole, TaskDirective, TaskResult, TaskStatus


class BaseAgent:
    """
    全専門エージェントの基底クラス

    各専門エージェントはこのクラスを継承し、
    system_promptとagent_roleをオーバーライドする。

    Usage:
        class MyAgent(BaseAgent):
            agent_role = AgentRole.GAME_DESIGN
            system_prompt = "あなたはゲームデザイナーです..."

        agent = MyAgent()
        response = agent.consult("バトルシステムについて教えて")
    """

    agent_role: AgentRole = AgentRole.ORCHESTRATOR
    system_prompt: str = "あなたはゲーム開発の専門家です。"

    def __init__(self, model: str = "claude-opus-4-6"):
        self.model = model
        self.client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        self._conversation: list[dict] = []

    def consult(
        self,
        user_message: str,
        context: Optional[dict] = None,
        use_thinking: bool = True,
        stream: bool = True,
    ) -> str:
        """
        エージェントに質問・依頼を送り、応答を受け取る

        Args:
            user_message: ユーザーまたはOrchestratorからのメッセージ
            context: 追加コンテキスト（設計決定事項など）
            use_thinking: Adaptive Thinkingを使用するか
            stream: ストリーミングで受信するか

        Returns:
            エージェントの応答テキスト
        """
        # コンテキスト情報を含むメッセージを組み立て
        full_message = user_message
        if context:
            context_str = "\n".join(f"  {k}: {v}" for k, v in context.items())
            full_message = f"【コンテキスト】\n{context_str}\n\n【質問/依頼】\n{user_message}"

        self._conversation.append({"role": "user", "content": full_message})

        params = {
            "model": self.model,
            "max_tokens": 8192,
            "system": self.system_prompt,
            "messages": self._conversation,
        }

        if use_thinking:
            params["thinking"] = {"type": "adaptive"}

        if stream:
            response_text = self._stream_response(params)
        else:
            response = self.client.messages.create(**params)
            response_text = self._extract_text(response.content)

        self._conversation.append({"role": "assistant", "content": response_text})
        return response_text

    def handle_task(self, directive: TaskDirective) -> TaskResult:
        """
        TaskDirectiveを受け取り、処理してTaskResultを返す

        Args:
            directive: Orchestratorからのタスク指示

        Returns:
            処理結果
        """
        prompt = self._build_task_prompt(directive)

        try:
            content = self.consult(
                prompt,
                context=directive.context,
                use_thinking=True,
                stream=False,
            )
            return TaskResult(
                task_id=directive.task_id,
                agent_role=self.agent_role,
                status=TaskStatus.COMPLETED,
                content=content,
                metadata={
                    "task_type": directive.task_type,
                    "title": directive.title,
                },
            )
        except Exception as e:
            return TaskResult(
                task_id=directive.task_id,
                agent_role=self.agent_role,
                status=TaskStatus.FAILED,
                content=f"エラーが発生しました: {e}",
            )

    def reset_conversation(self) -> None:
        """会話履歴をリセット"""
        self._conversation = []

    def _stream_response(self, params: dict) -> str:
        """ストリーミングで応答を受信し、テキストを結合して返す"""
        collected_text = []

        with self.client.messages.stream(**params) as stream:
            for event in stream:
                if (
                    event.type == "content_block_delta"
                    and event.delta.type == "text_delta"
                ):
                    collected_text.append(event.delta.text)

        return "".join(collected_text)

    def _extract_text(self, content: list) -> str:
        """レスポンスのcontentリストからテキストを抽出"""
        texts = []
        for block in content:
            if block.type == "text":
                texts.append(block.text)
        return "\n".join(texts)

    def _build_task_prompt(self, directive: TaskDirective) -> str:
        """TaskDirectiveからプロンプトを組み立て"""
        lines = [
            f"## タスク: {directive.title}",
            f"**タイプ**: {directive.task_type}",
            f"**優先度**: {directive.priority}",
            "",
            "### 依頼内容",
            directive.description,
        ]

        if directive.constraints:
            lines.append("\n### 制約条件")
            for c in directive.constraints:
                lines.append(f"  - {c}")

        return "\n".join(lines)
