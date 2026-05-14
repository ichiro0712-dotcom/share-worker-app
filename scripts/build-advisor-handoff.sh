#!/usr/bin/env bash
# TASTAS Advisor → hub-platform 移送パッケージ生成スクリプト
#
# 出力: docs/system-advisor/handoff-bundle/
#   - 入口 / 仕様書 / ナレッジ (手書きドキュメント) は事前に存在する想定
#   - 本スクリプトは「コード / スキーマ / 設定ファイル」の機械的コピー部分のみを
#     冪等に再生成する
#
# 完成した bundle を hub-platform に渡す手順 (ユーザー手動):
#   cp -r docs/system-advisor/handoff-bundle \
#     /Users/kawashimaichirou/Desktop/バイブコーディング/hub-platform/scratch/advisor-import-$(date +%Y-%m-%d)
#
# Claude Code は CLAUDE.md ルールにより hub-platform に直接コピーしない。
set -euo pipefail

REPO_ROOT="/Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ"
BUNDLE="${REPO_ROOT}/docs/system-advisor/handoff-bundle"

cd "${REPO_ROOT}"

echo "[handoff] bundle root = ${BUNDLE}"

# ============================================================
# 1. ディレクトリ初期化 (機械生成部分のみクリア、手書きは温存)
# ============================================================
mkdir -p "${BUNDLE}/src/lib" \
         "${BUNDLE}/src/components" \
         "${BUNDLE}/src/app/system-admin" \
         "${BUNDLE}/src/app/api" \
         "${BUNDLE}/src/app/advisor" \
         "${BUNDLE}/prisma" \
         "${BUNDLE}/extra-config"

# 機械生成領域のみリセット (手書き .md は温存)
rm -rf "${BUNDLE}/src/lib/advisor" \
       "${BUNDLE}/src/components/advisor" \
       "${BUNDLE}/src/app/system-admin/advisor" \
       "${BUNDLE}/src/app/api/advisor" \
       "${BUNDLE}/src/app/api/cron" \
       "${BUNDLE}/src/app/advisor"

# ============================================================
# 2. Advisor コード一式をコピー
# ============================================================
echo "[handoff] copying source code..."

cp -r "src/lib/advisor"               "${BUNDLE}/src/lib/advisor"
cp -r "src/components/advisor"        "${BUNDLE}/src/components/advisor"
cp -r "app/system-admin/advisor"      "${BUNDLE}/src/app/system-admin/advisor"
cp -r "app/api/advisor"               "${BUNDLE}/src/app/api/advisor"
mkdir -p "${BUNDLE}/src/app/api/cron"
cp -r "app/api/cron/advisor-cleanup"          "${BUNDLE}/src/app/api/cron/advisor-cleanup"
cp -r "app/api/cron/advisor-knowledge-sync"   "${BUNDLE}/src/app/api/cron/advisor-knowledge-sync"
mkdir -p "${BUNDLE}/src/app/advisor"
cp -r "app/advisor/r"                 "${BUNDLE}/src/app/advisor/r"

# ============================================================
# 3. Prisma スキーマ抜粋
#    - schema-advisor.prisma: Advisor 関連 model 全部
#    - schema-related.prisma: 参照される側 (LandingPage / SystemAdmin / 業務 PV テーブル)
# ============================================================
echo "[handoff] extracting Prisma schemas..."

# 3-1. Advisor 関連 (model AdvisorXxx)
{
  echo "// ============================================================"
  echo "// TASTAS Advisor 関連 Prisma model 抜粋"
  echo "// ============================================================"
  echo "// 元ファイル: prisma/schema.prisma"
  echo "// 生成日: $(date '+%Y-%m-%d')"
  echo "//"
  echo "// hub-platform 側で advisor-core を抽出する際の参照用。"
  echo "// 本ファイルそのままでは動かない (datasource / generator が無いため)。"
  echo "// hub-platform の prisma/schema.prisma に組み込む際は、prefix や"
  echo "// schema (multi-schema) 等を統合方針に合わせて調整すること。"
  echo "// ============================================================"
  echo ""
  awk '
    /^model Advisor[A-Za-z]+ \{/ { in_model=1 }
    in_model { print }
    in_model && /^\}/ { in_model=0; print "" }
  ' "prisma/schema.prisma"
} > "${BUNDLE}/prisma/schema-advisor.prisma"

# 3-2. 参照される側 (Advisor が読み取る業務テーブル群)
{
  echo "// ============================================================"
  echo "// TASTAS Advisor が読み取る "業務側" model 抜粋 (参照のみ)"
  echo "// ============================================================"
  echo "// 元ファイル: prisma/schema.prisma"
  echo "// 生成日: $(date '+%Y-%m-%d')"
  echo "//"
  echo "// これらは Advisor 専用ではなく TASTAS 業務本体のテーブル。"
  echo "// Advisor は advisorDataPrisma + READ ONLY tx 経由でのみ読み取る。"
  echo "// hub-platform 側では各 Hub 固有のテーブルに置き換わる想定。"
  echo "// ============================================================"
  echo ""
  for model in SystemAdmin LandingPage LpPageView LpClickEvent \
               PublicJobPageView JobSearchPageView JobDetailPageView \
               RegistrationPageView ApplicationClickEvent FormDestination \
               User Job Facility Application; do
    awk -v m="$model" '
      $0 ~ "^model "m" \\{" { in_model=1 }
      in_model { print }
      in_model && /^\}/ { in_model=0; print "" }
    ' "prisma/schema.prisma"
  done
} > "${BUNDLE}/prisma/schema-related.prisma"

# ============================================================
# 4. 設定ファイル / 周辺コード (UI 完全再現に必要)
# ============================================================
echo "[handoff] copying extra-config..."

cp "middleware.ts"           "${BUNDLE}/extra-config/middleware.ts"
cp "app/globals.css"         "${BUNDLE}/extra-config/globals.css"
cp "tailwind.config.ts"      "${BUNDLE}/extra-config/tailwind.config.ts"
cp "package.json"            "${BUNDLE}/extra-config/package.json"
cp "vercel.json"             "${BUNDLE}/extra-config/vercel.json"
cp "tsconfig.json"           "${BUNDLE}/extra-config/tsconfig.json"

# .env.example が無ければ Advisor 関連の env 変数を抜粋して作る
if [[ -f ".env.example" ]]; then
  cp ".env.example"          "${BUNDLE}/extra-config/dotenv.example"
fi

# ============================================================
# 5. README ファイル (各サブディレクトリの目次)
#    手書きの README が既にある場合は上書きしない
# ============================================================

if [[ ! -f "${BUNDLE}/src/_README.md" ]]; then
  cat > "${BUNDLE}/src/_README.md" <<'EOF'
# src/ — TASTAS Advisor コード参考用 (読み取り専用)

このフォルダは hub-platform 側 LLM がコードを読むための参考用コピー。

## 読書順 (どこから読むか)

| # | パス | 役割 | 仕様書リンク |
|---|---|---|---|
| 1 | `lib/advisor/orchestrator.ts` | Tool Use ループ + Gemini バイパス分岐 | [04_REPORT_FEATURE](../docs/04_REPORT_FEATURE.md) |
| 2 | `lib/advisor/system-prompt.ts` | cachedPart + dynamicPart 構築 | [05_SYSTEM_PROMPT](../docs/05_SYSTEM_PROMPT.md) |
| 3 | `lib/advisor/tools/registry.ts` | 19 ツール集約 | [03_TOOLS_SPEC](../docs/03_TOOLS_SPEC.md) |
| 4 | `lib/advisor/llm/gemini-draft-create.ts` | 初回ドラフト Gemini バイパス | [04_REPORT_FEATURE §3.2](../docs/04_REPORT_FEATURE.md) |
| 5 | `lib/advisor/llm/gemini-edit.ts` | ドラフト修正 Gemini バイパス | 同上 |
| 6 | `lib/advisor/llm/gemini-result-edit.ts` | レポート部分修正 Gemini バイパス | 同上 |
| 7 | `lib/advisor/reports/collect.ts` | データソース並列収集 | [04_REPORT_FEATURE §3.3](../docs/04_REPORT_FEATURE.md) |
| 8 | `lib/advisor/reports/generate.ts` | Gemini 本文生成パイプライン | 同上 |
| 9 | `components/advisor/report/report-canvas.tsx` | Canvas 本体 (~1700 行) | [06_UI_BEHAVIOR_SPEC](../docs/06_UI_BEHAVIOR_SPEC.md) |
| 10 | `components/advisor/chat/chat-layout.tsx` | チャット + サイドバー + Canvas 統合 | 同上 |
| 11 | `components/advisor/chat/chat-input.tsx` | ツール選択 + プリフィル | 同上 |
| 12 | `app/api/advisor/chat/route.ts` | SSE ストリーミング | [01_ARCHITECTURE](../docs/01_ARCHITECTURE.md) |
| 13 | `app/api/advisor/report/generate/route.ts` | レポート生成 API | 同上 |
| 14 | `app/api/cron/advisor-cleanup/route.ts` | 保持期間 cron | [02_DATA_MODEL §6](../docs/02_DATA_MODEL.md) |
| 15 | `app/advisor/r/[token]/page.tsx` | 公開シェアページ | [06_UI_BEHAVIOR_SPEC §5](../docs/06_UI_BEHAVIOR_SPEC.md) |

## 触ってはいけない

- 本フォルダのコードは **TASTAS で本番想定運用中**。改変するなら hub-platform 側で
  packages/advisor-core として抽出してから。

## コードと仕様書の対応

各 .ts ファイルの冒頭コメントに `@spec` タグでドキュメントへのリンクを書いてある。
そこから仕様書 → コードと往復しながら読むと理解が早い。
EOF
fi

# ============================================================
# 6. 完了サマリ
# ============================================================
echo ""
echo "[handoff] === 生成完了 ==="
echo ""
echo "サマリ:"
find "${BUNDLE}" -type f | wc -l | xargs -I {} echo "  ファイル数: {}"
du -sh "${BUNDLE}" | awk '{print "  サイズ: "$1}'
echo ""
echo "ディレクトリツリー (深さ 2):"
find "${BUNDLE}" -maxdepth 2 -type d | sort | sed "s|${BUNDLE}||" | sed 's|^/|  |' | sed 's|^$|  /|'
echo ""
echo "次のステップ:"
echo "  1. ${BUNDLE}/README.md を読んで内容確認"
echo "  2. hub-platform 側にコピー (ユーザー手動):"
echo "     cp -r ${BUNDLE} \\"
echo "       /Users/kawashimaichirou/Desktop/バイブコーディング/hub-platform/scratch/advisor-import-$(date +%Y-%m-%d)"
echo ""
