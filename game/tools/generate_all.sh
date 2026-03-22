#!/bin/bash
# 四季廻りの職人 — 全アセット生成スクリプト
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== 四季廻りの職人 アセット生成 ==="
echo ""

# node_modules チェック
if [ ! -d "node_modules" ]; then
  echo "[1/4] npm install 実行中..."
  npm install
else
  echo "[1/4] node_modules 確認済み"
fi

echo "[2/4] キャラクタースプライト生成中..."
node generate_sprites.js

echo "[3/4] タイルセット生成中..."
node generate_tiles.js

echo "[4/4] 敵スプライト生成中..."
node generate_enemies.js

echo ""
echo "=== 全アセット生成完了 ==="
echo "出力先:"
echo "  sprites: ../assets/sprites/"
echo "  tiles:   ../assets/tiles/"
ls -la ../assets/sprites/ ../assets/tiles/
