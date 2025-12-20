# AIサービス認知・提案計測システム（MVP）

## 概要
AIが特定サービス（例：SalesNow）をどのような課題に対して提案するかを計測・探索するWebアプリ（MVP）です。

- Python（FastAPI＋Streamlit）構成
- OpenAI API連携
- データ保存：JSON/CSV（必要に応じてSQLiteも検討）
- 最低限のWebフォーム＋結果表示

## ディレクトリ構成

```
app/         # FastAPI バックエンド
frontend/    # Streamlit フロントエンド
data/        # 実行ログ・集計データ
.docs/       # マニュアル・手順書
.github/     # Copilot進行管理
```

## セットアップ手順
1. Python 3.9以上をインストール
2. `requirements.txt` で依存パッケージをインストール
3. `.env` ファイルを作成し、OpenAI APIキーを設定

## 実行方法
- 詳細は `docs/` 配下の手順書を参照してください

---

## 参考
- 要件定義書（MVP版）
- copilot-instructions.md
