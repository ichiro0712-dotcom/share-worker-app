#!/bin/bash
# E2Eテスト + DB検証スクリプト
#
# 使用方法:
#   ./scripts/test-with-db-verify.sh [test-file]
#
# 例:
#   ./scripts/test-with-db-verify.sh                              # 全テスト
#   ./scripts/test-with-db-verify.sh worker/application.spec.ts   # 特定テスト

set -e

echo "========================================"
echo " E2Eテスト + DB検証 自動実行スクリプト"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# 色付け
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# テスト対象ファイル
TEST_FILE=${1:-""}

# Step 1: 開発サーバーが起動しているか確認
echo -e "${YELLOW}[Step 1] 開発サーバー確認${NC}"
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${RED}エラー: 開発サーバーが起動していません${NC}"
    echo "npm run dev を実行してからお試しください"
    exit 1
fi
echo -e "${GREEN}✓ 開発サーバー起動中${NC}"
echo ""

# Step 2: E2Eテスト実行（ヘッドレスモード）
echo -e "${YELLOW}[Step 2] E2Eテスト実行（ヘッドレス）${NC}"
if [ -n "$TEST_FILE" ]; then
    echo "テスト対象: tests/e2e/$TEST_FILE"
    CI=true PLAYWRIGHT_USE_EXISTING_SERVER=1 npx playwright test "tests/e2e/$TEST_FILE" --reporter=list
else
    echo "テスト対象: worker/application.spec.ts (デフォルト)"
    CI=true PLAYWRIGHT_USE_EXISTING_SERVER=1 npx playwright test "tests/e2e/worker/application.spec.ts" --reporter=list
fi
E2E_EXIT_CODE=$?

if [ $E2E_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}⚠ E2Eテストが失敗しました (exit code: $E2E_EXIT_CODE)${NC}"
    echo "DB検証は続行します..."
fi
echo ""

# Step 3: DB検証
echo -e "${YELLOW}[Step 3] DB updated_by 検証${NC}"
npx tsx scripts/verify-updated-by.ts
DB_EXIT_CODE=$?
echo ""

# 結果サマリー
echo "========================================"
echo " 実行結果サマリー"
echo "========================================"
if [ $E2E_EXIT_CODE -eq 0 ]; then
    echo -e "E2Eテスト: ${GREEN}✓ 成功${NC}"
else
    echo -e "E2Eテスト: ${RED}✗ 失敗${NC}"
fi

if [ $DB_EXIT_CODE -eq 0 ]; then
    echo -e "DB検証:    ${GREEN}✓ 成功${NC}"
else
    echo -e "DB検証:    ${YELLOW}⚠ 警告あり${NC}"
fi
echo "========================================"

# 両方成功なら0、どちらか失敗なら1
if [ $E2E_EXIT_CODE -eq 0 ] && [ $DB_EXIT_CODE -eq 0 ]; then
    exit 0
else
    exit 1
fi
