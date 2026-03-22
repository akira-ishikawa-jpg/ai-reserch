# スマホRPG開発 AIエージェントチーム アーキテクチャ

## 概要

ブレイブリーデフォルト × オクトパストラベラー風スマホRPGを
AIエージェントチームが協力して設計・開発するシステム。

## エージェントチーム構成

```
ユーザー
  │
  ▼
Grand Orchestrator（総監督）
  │  Tool Use（専門エージェントに相談）
  ├── GameDesignAgent    : GDD・コアループ・マネタイズ
  ├── JobSystemAgent     : ジョブシステム（核心）⭐
  ├── BattleSystemAgent  : バトル・数値設計
  ├── NarrativeAgent     : ストーリー・キャラクター
  ├── UIUXAgent          : スマホUI/UX
  ├── CodeGenAgent       : コード生成
  ├── QABalanceAgent     : バランス検証
  └── DevOpsAgent        : ビルド・CI/CD
```

## 使い方

```bash
# 環境設定
export ANTHROPIC_API_KEY="your-api-key"
pip install -r requirements.txt

# 対話モード（推奨）
python main.py

# 特定タスク実行
python main.py --task "ジョブシステムの詳細設計をして"

# 専門エージェントと直接対話
python main.py --agent job_system
```

## ジョブシステム設計方針

| 要素 | 採用元 | 内容 |
|---|---|---|
| ジョブ習熟・切替 | ブレイブリーデフォルト | JP・ジョブレベル制、全キャラが全ジョブ習得可能 |
| サポートアビリティ枠 | ブレイブリーデフォルト | 5スロットで任意ジョブのパッシブを自由装備 |
| BPシステム | オクトパストラベラー | 貯めて使うBPでアビリティ強化 |
| キャラ個性 | オクトパストラベラー | キャラ固有アビリティ |
| 隠しジョブ | オクトパストラベラー | 探索で発見するアドバンスドジョブ |

## ファイル構成

```
ai-reserch/
├── main.py                     # エントリポイント
├── requirements.txt
├── agents/
│   ├── base_agent.py           # 共通基底クラス
│   ├── orchestrator.py         # Grand Orchestrator（対話UI）
│   └── specialist_agents.py   # 専門エージェント8体
├── schemas/
│   ├── task.py                 # エージェント間通信モデル
│   └── job.py                  # ジョブシステムデータモデル
├── data/
│   └── jobs/                   # ジョブYAML定義（生成予定）
└── docs/
    ├── GDD.md                  # ゲームデザインドキュメント（生成予定）
    └── agent_architecture.md   # このファイル
```

## 技術スタック

- **AIエージェント**: Anthropic Claude claude-opus-4-6 + Adaptive Thinking
- **ゲームエンジン**: Godot 4 (GDScript) ※将来的に
- **プロトタイプ**: Python + Pygame-CE
- **データモデル**: Pydantic v2
- **ゲームデータ**: YAML + SQLite
