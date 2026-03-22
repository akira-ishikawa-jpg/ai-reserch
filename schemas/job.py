"""
ジョブシステムのデータモデル定義

ブレイブリーデフォルト × オクトパストラベラーの
「いいとこ取り」ジョブシステムのスキーマ。

設計方針:
  - 全キャラが全ジョブを習得可能（ブレイブリーデフォルト式）
  - サポートアビリティを5スロットで自由装備（BD式）
  - BP（ブーストポイント）でアビリティを強化（OT式）
  - キャラ固有アビリティあり（OT式）
  - 隠しアドバンスドジョブ（OT式）
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class JobType(str, Enum):
    """ジョブの種別"""
    PRIMARY = "primary"       # 基本ジョブ（最初から解放可能）
    SECONDARY = "secondary"   # セカンダリジョブ（習得で解放）
    ADVANCED = "advanced"     # アドバンスドジョブ（秘境・ボスで解放）


class AbilityType(str, Enum):
    """アビリティの種別"""
    ATTACK = "attack"         # 攻撃
    HEAL = "heal"             # 回復
    BUFF = "buff"             # 強化
    DEBUFF = "debuff"         # 弱体
    UTILITY = "utility"       # ユーティリティ
    SPECIAL = "special"       # 特殊


class CostType(str, Enum):
    """コストの種別"""
    MP = "mp"                 # マジックポイント
    BP = "bp"                 # ブーストポイント（OT式）
    JP = "jp"                 # ジョブポイント（習得コスト）
    HP = "hp"                 # HPコスト


class StatBonuses(BaseModel):
    """ジョブによるステータスボーナス"""
    hp: int = 0
    mp: int = 0
    strength: int = 0       # 物理攻撃
    magic: int = 0          # 魔法攻撃
    endurance: int = 0      # 防御
    agility: int = 0        # 素早さ
    spirit: int = 0         # 精神（回復力）
    accuracy: int = 0       # 命中
    evasion: int = 0        # 回避


class Ability(BaseModel):
    """
    アクティブアビリティの定義

    Attributes:
        id: ユニークID（例: "warrior_slash"）
        name: 表示名
        description: アビリティの説明
        ability_type: 攻撃/回復/etc
        cost_type: MP/BP
        cost_amount: コスト量
        unlock_job_level: 解放に必要なジョブレベル
        bp_boost_multiplier: BPブーストごとの倍率
        animation_key: アニメーションキー（Godot用）
    """
    id: str
    name: str
    description: str
    ability_type: AbilityType
    cost_type: CostType = CostType.MP
    cost_amount: int = 10
    unlock_job_level: int = 1
    bp_boost_multiplier: float = 1.5  # BP1つで1.5倍
    max_bp_boost: int = 3             # 最大3回ブースト可能
    animation_key: str = "default"
    target: str = "single_enemy"      # "single_enemy", "all_enemies", "single_ally", "all_allies", "self"


class PassiveAbility(BaseModel):
    """
    パッシブアビリティの定義（ブレイブリーデフォルト式サポートアビリティ）

    Attributes:
        id: ユニークID
        name: 表示名
        description: 効果説明
        slot_cost: 装備に必要なスロット数（1〜3）
        unlock_job_level: 解放に必要なジョブレベル
        stat_modifiers: ステータス修正値
        special_effect: 特殊効果の識別子
    """
    id: str
    name: str
    description: str
    slot_cost: int = Field(default=1, ge=1, le=3)
    unlock_job_level: int = 1
    stat_modifiers: StatBonuses = Field(default_factory=StatBonuses)
    special_effect: Optional[str] = None  # "counter_attack", "hp_regen", etc.


class JobSpecialty(BaseModel):
    """
    ジョブ固有スペシャルティ（ブレイブリーデフォルト式）

    Attributes:
        name: 名称
        description: 効果説明
        is_mastered_version: True=熟練スペシャルティ（Lv14習得）
    """
    name: str
    description: str
    is_mastered_version: bool = False


class UnlockCondition(BaseModel):
    """ジョブ・アビリティの解放条件"""
    type: str  # "story", "job_level", "shrine", "boss_defeated", "free"
    requirement: Any = None  # 条件の詳細（ジョブレベル数値、ボスID等）


class JobDefinition(BaseModel):
    """
    ジョブ定義スキーマ

    ブレイブリーデフォルト × オクトパストラベラーの融合設計。

    Example:
        warrior = JobDefinition(
            id="warrior",
            name="戦士",
            job_type=JobType.PRIMARY,
            stat_bonuses=StatBonuses(hp=150, strength=20, endurance=15),
            ...
        )
    """
    id: str
    name: str
    description: str
    job_type: JobType = JobType.PRIMARY
    icon_key: str = "job_default"

    # ステータスボーナス
    stat_bonuses: StatBonuses = Field(default_factory=StatBonuses)

    # アビリティ一覧
    active_abilities: list[Ability] = Field(default_factory=list)
    passive_abilities: list[PassiveAbility] = Field(default_factory=list)

    # ジョブ習熟システム（ブレイブリーデフォルト式）
    max_level: int = 14
    jp_per_level: list[int] = Field(
        default_factory=lambda: [100, 200, 400, 700, 1100, 1600, 2200, 2900, 3700, 4600, 5600, 6700, 7900, 9200]
    )

    # スペシャルティ（Lv1取得・Lv14熟練）
    base_specialty: Optional[JobSpecialty] = None
    mastered_specialty: Optional[JobSpecialty] = None

    # 解放条件
    unlock_condition: UnlockCondition = Field(
        default_factory=lambda: UnlockCondition(type="free")
    )

    # 装備可能な武器種
    weapon_types: list[str] = Field(default_factory=list)

    def get_ability_at_level(self, level: int) -> list[Ability]:
        """指定レベルで解放されているアビリティを返す"""
        return [a for a in self.active_abilities if a.unlock_job_level <= level]

    def get_passive_at_level(self, level: int) -> list[PassiveAbility]:
        """指定レベルで解放されているパッシブを返す"""
        return [p for p in self.passive_abilities if p.unlock_job_level <= level]


class CharacterJobState(BaseModel):
    """
    キャラクターのジョブ状態

    1キャラクターが保持するジョブ習熟状況と
    現在の装備設定を管理する。
    """
    character_id: str

    # メインジョブ（習得・切替可能）
    primary_job_id: str
    primary_job_level: int = 1
    primary_job_jp: int = 0

    # サブジョブ（セカンダリジョブ、任意）
    secondary_job_id: Optional[str] = None
    secondary_job_level: int = 1
    secondary_job_jp: int = 0

    # 解放済みジョブ
    unlocked_jobs: list[str] = Field(default_factory=list)

    # 習得済みアビリティ（ジョブID -> アビリティIDリスト）
    learned_abilities: dict[str, list[str]] = Field(default_factory=dict)

    # 装備中アクティブアビリティ（最大4スロット）
    equipped_active: list[Optional[str]] = Field(
        default_factory=lambda: [None, None, None, None]
    )

    # 装備中パッシブアビリティ（最大5スロット、各スロットコスト合計<=5）
    equipped_passives: list[Optional[str]] = Field(
        default_factory=lambda: [None, None, None, None, None]
    )
    passive_slot_capacity: int = 5

    # BP（ブーストポイント）状態
    current_bp: int = 0
    max_bp: int = 3

    def can_equip_passive(self, passive: PassiveAbility) -> bool:
        """パッシブの装備が可能か確認"""
        equipped_cost = sum(
            0 for p in self.equipped_passives if p is not None
            # 実際はPassiveAbilityのslot_costを参照
        )
        return equipped_cost + passive.slot_cost <= self.passive_slot_capacity


class JobTeamComposition(BaseModel):
    """
    パーティ全体のジョブ構成

    4キャラ編成でのジョブ組み合わせを管理。
    """
    characters: list[CharacterJobState] = Field(default_factory=list)
    battle_formation: str = "default"  # "default", "front_back"
