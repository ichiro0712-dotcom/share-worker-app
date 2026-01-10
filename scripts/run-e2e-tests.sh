#!/bin/bash

# E2Eテスト実行スクリプト with レポート生成
# Usage: ./scripts/run-e2e-tests.sh [--report] [--filter <pattern>]

set -e

# 変数初期化
GENERATE_REPORT=false
FILTER_PATTERN=""
REPORT_DIR="docs/test-reports"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
REPORT_FILE="${REPORT_DIR}/${TIMESTAMP}-e2e-test-report.md"
JSON_RESULT_FILE="/tmp/playwright-results-${TIMESTAMP}.json"

# 引数パース
while [[ $# -gt 0 ]]; do
  case $1 in
    --report)
      GENERATE_REPORT=true
      shift
      ;;
    --filter)
      FILTER_PATTERN="$2"
      shift 2
      ;;
    --report-dir)
      REPORT_DIR="$2"
      REPORT_FILE="${REPORT_DIR}/${TIMESTAMP}-e2e-test-report.md"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# レポートディレクトリ作成
if [ "$GENERATE_REPORT" = true ]; then
  mkdir -p "$REPORT_DIR"
fi

echo "==================================="
echo "E2E テスト実行開始"
echo "==================================="
echo "日時: $(date '+%Y-%m-%d %H:%M:%S')"
echo "レポート生成: $GENERATE_REPORT"
if [ -n "$FILTER_PATTERN" ]; then
  echo "フィルター: $FILTER_PATTERN"
fi
echo "==================================="

# Playwrightテスト実行
TEST_CMD="npx playwright test"
if [ -n "$FILTER_PATTERN" ]; then
  TEST_CMD="$TEST_CMD --grep \"$FILTER_PATTERN\""
fi

# JSON形式で結果を出力
TEST_CMD="$TEST_CMD --reporter=json"

echo ""
echo "実行コマンド: $TEST_CMD"
echo ""

# テスト実行（結果をJSONファイルに保存）
set +e
eval "$TEST_CMD" > "$JSON_RESULT_FILE" 2>&1
TEST_EXIT_CODE=$?
set -e

# 通常のレポーターでも実行（コンソール出力用）
if [ -n "$FILTER_PATTERN" ]; then
  npx playwright test --grep "$FILTER_PATTERN" --reporter=list 2>&1 || true
else
  npx playwright test --reporter=list 2>&1 || true
fi

echo ""
echo "==================================="
echo "テスト実行完了 (exit code: $TEST_EXIT_CODE)"
echo "==================================="

# レポート生成
if [ "$GENERATE_REPORT" = true ]; then
  echo ""
  echo "レポートを生成中..."

  # Node.jsスクリプトでJSONをパースしてMarkdownを生成
  node -e "
const fs = require('fs');

try {
  const jsonPath = '$JSON_RESULT_FILE';
  const reportPath = '$REPORT_FILE';
  const timestamp = '$TIMESTAMP';

  let results;
  try {
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    results = JSON.parse(jsonContent);
  } catch (e) {
    // JSONパースに失敗した場合はデフォルト構造を使用
    results = { suites: [], stats: { expected: 0, unexpected: 0, skipped: 0 } };
  }

  // 統計情報を集計
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failedTests = [];
  const passedTests = [];

  function processTest(test, filePath) {
    if (!test.results || test.results.length === 0) return;

    const result = test.results[0];
    const testInfo = {
      file: filePath,
      name: test.title,
      duration: result.duration || 0,
    };

    if (result.status === 'passed' || result.status === 'expected') {
      passed++;
      passedTests.push(testInfo);
    } else if (result.status === 'skipped') {
      skipped++;
    } else {
      failed++;
      failedTests.push({
        ...testInfo,
        error: result.error?.message || 'Unknown error',
        stack: result.error?.stack || '',
      });
    }
  }

  function processSuite(suite, filePath = '') {
    const currentPath = filePath ? filePath : (suite.file || suite.title || 'Unknown');

    if (suite.specs) {
      suite.specs.forEach(spec => processTest(spec, currentPath));
    }
    if (suite.suites) {
      suite.suites.forEach(s => processSuite(s, currentPath));
    }
  }

  if (results.suites) {
    results.suites.forEach(suite => processSuite(suite));
  }

  const total = passed + failed + skipped;
  const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

  // Markdownレポート生成
  let report = \`# E2Eテスト結果レポート

## 概要

| 項目 | 値 |
|------|-----|
| 実行日時 | \${new Date().toLocaleString('ja-JP')} |
| テストタイプ | E2E (Playwright) |
| 合計テスト数 | \${total} |
| 成功 | \${passed} |
| 失敗 | \${failed} |
| スキップ | \${skipped} |
| **成功率** | **\${successRate}%** |

\`;

  // 成功率に応じたステータスバッジ
  if (failed === 0) {
    report += \`
> ✅ **全てのテストが成功しました！**

\`;
  } else {
    report += \`
> ⚠️ **\${failed}件のテストが失敗しています**

\`;
  }

  // 失敗したテストの詳細
  if (failedTests.length > 0) {
    report += \`## 失敗したテスト

| ファイル | テスト名 | エラー概要 |
|----------|----------|------------|
\`;
    failedTests.forEach(test => {
      const shortError = test.error.split('\\n')[0].substring(0, 60);
      report += \`| \${test.file} | \${test.name} | \${shortError}... |\n\`;
    });

    report += \`
### 失敗テスト詳細

\`;
    failedTests.forEach((test, index) => {
      report += \`#### ${index + 1}. \${test.name}

- **ファイル**: \\\`\${test.file}\\\`
- **エラーメッセージ**:
\\\`\\\`\\\`
\${test.error}
\\\`\\\`\\\`

\`;
    });
  }

  // 成功したテストのサマリー（上位10件）
  if (passedTests.length > 0) {
    report += \`## 成功したテスト（サンプル）

| ファイル | テスト名 | 実行時間 |
|----------|----------|----------|
\`;
    passedTests.slice(0, 10).forEach(test => {
      report += \`| \${test.file} | \${test.name} | \${test.duration}ms |\n\`;
    });

    if (passedTests.length > 10) {
      report += \`
*他 \${passedTests.length - 10} 件のテストが成功*

\`;
    }
  }

  // 推奨事項
  report += \`## 推奨事項

\`;
  if (failed > 0) {
    report += \`- [ ] 失敗した \${failed} 件のテストを修正する
- [ ] エラーメッセージを確認し、根本原因を特定する
\`;
  }
  if (successRate < 80) {
    report += \`- [ ] 成功率が80%を下回っています。テストの安定性を改善してください
\`;
  }
  if (total < 50) {
    report += \`- [ ] テストカバレッジを向上させることを検討してください
\`;
  }
  if (failed === 0 && total > 0) {
    report += \`- ✅ 全てのテストが成功しています。このまま継続してください
- [ ] 新機能追加時はテストも追加することを忘れずに
\`;
  }

  report += \`
---

*このレポートは /sc:test --report コマンドによって自動生成されました*
\`;

  fs.writeFileSync(reportPath, report);
  console.log('レポートを生成しました: ' + reportPath);

} catch (error) {
  console.error('レポート生成エラー:', error.message);
  process.exit(1);
}
"

  echo ""
  echo "==================================="
  echo "レポート: $REPORT_FILE"
  echo "==================================="
fi

# 一時ファイル削除
rm -f "$JSON_RESULT_FILE"

exit $TEST_EXIT_CODE
