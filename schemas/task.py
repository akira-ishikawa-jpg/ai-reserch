"""
エージェント間通信のためのPydanticモデル定義

Grand OrchestratorとSpecialist Agentsの間でやり取りされる
タスク指示・結果・会話ログを型安全に管理する。
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class TaskType(str, Enum):
    """タスクの種類"""
    DESIGN = "design"           # ゲームデザイン・仕様策定
    IMPLEMENT = "implement"     # コード生成・実装
    REVIEW = "review"           # レビュー・フィードバック
    TEST = "test"               # テスト・バランス検証
    ADVISE = "advise"           # アドバイス・提案


class AgentRole(str, Enum):
    """エージェントの役割"""
    ORCHESTRATOR = "orchestrator"
    GAME_DESIGN = "game_design"
    JOB_SYSTEM = "job_system"
    BATTLE_SYSTEM = "battle_system"
    NARRATIVE = "narrative"
    UI_UX = "ui_ux"
    CODE_GEN = "code_gen"
    QA_BALANCE = "qa_balance"
    DEVOPS = "devops"


class TaskStatus(str, Enum):
    """タスクの状態"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    FAILED = "failed"


class TaskDirective(BaseModel):
    """
    Orchestratorから専門エージェントへのタスク指示

    Attributes:
        task_id: ユニークなタスクID
        target_agent: 担当エージェントの役割
        task_type: タスクの種類
        title: タスクの短いタイトル
        description: タスクの詳細な説明
        context: 関連する設計情報・依存成果物
        constraints: 制約条件のリスト
        priority: 優先度 (1=最高, 5=最低)
    """
    task_id: str
    target_agent: AgentRole
    task_type: TaskType
    title: str
    description: str
    context: dict[str, Any] = Field(default_factory=dict)
    constraints: list[str] = Field(default_factory=list)
    priority: int = Field(default=3, ge=1, le=5)
    created_at: datetime = Field(default_factory=datetime.now)


class TaskResult(BaseModel):
    """
    専門エージェントからOrchestratorへの結果報告

    Attributes:
        task_id: 対応するTaskDirectiveのID
        agent_role: 回答したエージェントの役割
        status: タスクの完了状態
        content: エージェントの回答・成果物内容
        artifacts: 生成されたファイルパスのリスト
        suggestions: 他エージェントへの連携提案
        metadata: 追加メタデータ
    """
    task_id: str
    agent_role: AgentRole
    status: TaskStatus
    content: str
    artifacts: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    completed_at: datetime = Field(default_factory=datetime.now)


class ConversationTurn(BaseModel):
    """会話の1ターン"""
    role: str  # "user" | "assistant" | "agent"
    content: str
    agent_role: Optional[AgentRole] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class ProjectState(BaseModel):
    """
    ゲーム開発プロジェクトの現在の状態

    Orchestratorが管理するグローバル状態。
    合意済みの設計決定事項を蓄積していく。
    """
    project_name: str = "Untitled RPG"
    conversation_history: list[ConversationTurn] = Field(default_factory=list)

    # 合意済みの設計決定
    agreed_decisions: dict[str, Any] = Field(default_factory=dict)

    # エージェント構成（動的に変更可能）
    active_agents: list[AgentRole] = Field(
        default_factory=lambda: [
            AgentRole.GAME_DESIGN,
            AgentRole.JOB_SYSTEM,
            AgentRole.BATTLE_SYSTEM,
            AgentRole.NARRATIVE,
            AgentRole.UI_UX,
            AgentRole.CODE_GEN,
            AgentRole.QA_BALANCE,
            AgentRole.DEVOPS,
        ]
    )

    # 完了タスク
    completed_tasks: list[str] = Field(default_factory=list)

    def add_decision(self, key: str, value: Any) -> None:
        """設計決定を追記"""
        self.agreed_decisions[key] = value

    def add_turn(self, role: str, content: str, agent_role: Optional[AgentRole] = None) -> None:
        """会話ターンを追記"""
        self.conversation_history.append(
            ConversationTurn(role=role, content=content, agent_role=agent_role)
        )

    def get_decisions_summary(self) -> str:
        """合意済み決定事項のサマリーを返す"""
        if not self.agreed_decisions:
            return "まだ設計決定事項はありません。"
        lines = ["【合意済みの設計決定】"]
        for key, value in self.agreed_decisions.items():
            lines.append(f"  - {key}: {value}")
        return "\n".join(lines)
