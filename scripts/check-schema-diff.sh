#!/bin/bash
#
# スキーマ差分チェックスクリプト
# 本番DBとPrismaスキーマの差分を検出し、破壊的変更があれば警告
#

set -e

# 色定義
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  スキーマ差分チェック${NC}"
echo -e "${BLUE}========================================${NC}"

# .env.production.local が存在しない場合、Vercelから取得
if [ ! -f ".env.production.local" ]; then
  echo -e "${YELLOW}本番環境変数を取得中...${NC}"
  vercel env pull .env.production.local --environment=production --yes 2>/dev/null || {
    echo -e "${RED}エラー: Vercel CLIで環境変数を取得できませんでした${NC}"
    echo "手動で 'vercel env pull .env.production.local --environment=production' を実行してください"
    exit 1
  }
fi

# 環境変数を読み込み
source .env.production.local

# DIRECT_URLを使用（PgBouncer経由ではスキーマ操作ができないため）
DB_URL="${DIRECT_URL:-$DATABASE_URL}"

if [ -z "$DB_URL" ]; then
  echo -e "${RED}エラー: DATABASE_URLまたはDIRECT_URLが設定されていません${NC}"
  exit 1
fi

echo -e "${BLUE}本番DBとの差分をチェック中...${NC}"
echo ""

# 差分を取得
DIFF_OUTPUT=$(npx prisma migrate diff \
  --from-url "$DB_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script 2>&1) || true

# 差分がない場合
if [ -z "$DIFF_OUTPUT" ] || echo "$DIFF_OUTPUT" | grep -q "No difference detected"; then
  echo -e "${GREEN}✅ 差分なし - 本番DBとPrismaスキーマは同期されています${NC}"
  exit 0
fi

# 差分がある場合、内容を分析
echo -e "${YELLOW}📋 検出された差分:${NC}"
echo ""
echo "$DIFF_OUTPUT"
echo ""

# 破壊的変更（DROP）の検出
DESTRUCTIVE_CHANGES=$(echo "$DIFF_OUTPUT" | grep -iE "DROP (TABLE|COLUMN|INDEX|CONSTRAINT)" || true)

if [ -n "$DESTRUCTIVE_CHANGES" ]; then
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}⚠️  警告: 破壊的変更が検出されました！${NC}"
  echo -e "${RED}========================================${NC}"
  echo ""
  echo -e "${RED}以下の削除操作が含まれています:${NC}"
  echo "$DESTRUCTIVE_CHANGES"
  echo ""
  echo -e "${YELLOW}これらの変更は自動適用されません。${NC}"
  echo -e "${YELLOW}手動で確認・実行してください。${NC}"
  echo ""
  exit 2  # 破壊的変更ありの終了コード
fi

# 追加・変更のみの場合
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 追加・変更のみの差分です（安全）${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}この差分はGitHub Actionsで自動適用されます。${NC}"
exit 0
