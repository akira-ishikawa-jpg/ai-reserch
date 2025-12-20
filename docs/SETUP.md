# 環境構築手順書

## 前提
- Python 3.9以上
- OpenAI APIキー取得済み

## セットアップ手順

1. リポジトリをクローン
2. `requirements.txt` で依存パッケージをインストール
   ```sh
   pip install -r requirements.txt
   ```
3. `.env` ファイルを作成し、OpenAI APIキーを設定
   ```sh
   cp .env.example .env
   # .envを編集し、APIキーを入力
   ```
4. FastAPIサーバ起動
   ```sh
   uvicorn app.main:app --reload
   ```
5. Streamlitフロントエンド起動
   ```sh
   streamlit run frontend/app.py
   ```

## 補足
- 詳細な使い方はREADME.md参照
