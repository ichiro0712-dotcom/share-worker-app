#!/usr/bin/env node

/**
 * E2Eテスト結果 + デバッグシート統合レポート生成スクリプト
 *
 * Usage: node scripts/generate-test-report.js [options]
 * Options:
 *   --test-results <path>   Playwrightテスト結果JSONファイル
 *   --debug-sheet <path>    デバッグシート（Excel）パス
 *   --output <path>         出力レポートファイル
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 引数パース
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
};

const testResultsPath = getArg('test-results') || '/tmp/playwright-results.json';
const debugSheetPath = getArg('debug-sheet') || 'docs/debug/20251230.xlsx';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outputPath = getArg('output') || `docs/test-reports/${timestamp}-integrated-report.md`;

// 出力ディレクトリ作成
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// デバッグシートからデータ読み込み
function loadDebugSheet(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`デバッグシートが見つかりません: ${filePath}`);
    return [];
  }

  try {
    const output = execSync(`npx xlsx-cli "${filePath}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const lines = output.trim().split('\n');

    if (lines.length < 2) return []; // ヘッダー + データ

    // xlsx-cliの出力: 最初の行がヘッダー、最後の行がシート名
    // シート名の行を除外（「シート」を含む行、または短い行）
    const dataLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 10 && !trimmed.match(/^シート\d*$/);
    });

    if (dataLines.length < 2) return [];

    // 最初の行がヘッダー
    const headerLine = dataLines[0];
    const rawHeaders = parseCSVLine(headerLine);
    // ヘッダー名を正規化（BOM、引用符、空白を削除）
    const headers = rawHeaders.map(h => h.replace(/^\ufeff/, '').replace(/^["']|["']$/g, '').trim());
    const items = [];

    for (let i = 1; i < dataLines.length; i++) {
      const values = parseCSVLine(dataLines[i]);
      // IDが数字の行のみ有効なデータとして扱う
      const id = values[0] ? values[0].replace(/^["']|["']$/g, '').trim() : '';
      if (id && /^\d+$/.test(id)) {
        const item = {};
        headers.forEach((h, idx) => {
          item[h] = (values[idx] || '').replace(/^["']|["']$/g, '').trim();
        });
        items.push(item);
      }
    }

    return items;
  } catch (e) {
    console.error('デバッグシート読み込みエラー:', e.message);
    return [];
  }
}

// CSVライン パーサー
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// テスト結果からカテゴリ別に分類
function categorizeTests(testResults) {
  const categories = {
    auth: { name: '認証機能', tests: [] },
    profile: { name: 'プロフィール', tests: [] },
    job: { name: '求人機能', tests: [] },
    application: { name: '応募機能', tests: [] },
    message: { name: 'メッセージ', tests: [] },
    review: { name: 'レビュー', tests: [] },
    facility: { name: '施設管理', tests: [] },
    other: { name: 'その他', tests: [] },
  };

  testResults.forEach(test => {
    const file = test.file?.toLowerCase() || '';
    if (file.includes('auth')) {
      categories.auth.tests.push(test);
    } else if (file.includes('profile')) {
      categories.profile.tests.push(test);
    } else if (file.includes('job')) {
      categories.job.tests.push(test);
    } else if (file.includes('application')) {
      categories.application.tests.push(test);
    } else if (file.includes('message')) {
      categories.message.tests.push(test);
    } else if (file.includes('review')) {
      categories.review.tests.push(test);
    } else if (file.includes('facility') || file.includes('admin')) {
      categories.facility.tests.push(test);
    } else {
      categories.other.tests.push(test);
    }
  });

  return categories;
}

// デバッグ項目をE2Eテストと紐付け
function mapDebugItemsToTests(debugItems, testResults) {
  const mapping = [];

  debugItems.forEach(item => {
    if (!item.ID) return;

    const summary = item['概要'] || '';
    const status = item['ステータス'] || '';
    const completed = item['対応完了'] === 'TRUE';

    // 関連テストを検索
    const relatedTests = testResults.filter(test => {
      const testName = test.name?.toLowerCase() || '';
      const testFile = test.file?.toLowerCase() || '';

      // キーワードマッチング
      const keywords = extractKeywords(summary);
      return keywords.some(kw => testName.includes(kw) || testFile.includes(kw));
    });

    mapping.push({
      id: item.ID,
      type: item['種別'] || 'その他',
      priority: item['優先度'] || '-',
      summary: summary,
      status: status,
      completed: completed,
      relatedTests: relatedTests.map(t => t.name),
      hasCoverage: relatedTests.length > 0,
    });
  });

  return mapping;
}

// サマリからキーワード抽出
function extractKeywords(summary) {
  const keywords = [];
  const patterns = [
    /ログイン/g, /登録/g, /パスワード/g, /認証/g,
    /プロフィール/g, /資格/g, /郵便番号/g, /フリガナ/g,
    /求人/g, /応募/g, /マッチング/g,
    /メッセージ/g, /通知/g,
    /レビュー/g, /評価/g,
    /施設/g, /管理/g, /テンプレート/g,
    /画像/g, /アップロード/g, /保存/g,
    /日付/g, /時間/g, /過去/g,
    /バリデーション/g, /エラー/g, /必須/g,
  ];

  patterns.forEach(p => {
    const matches = summary.match(p);
    if (matches) {
      keywords.push(...matches.map(m => m.toLowerCase()));
    }
  });

  return [...new Set(keywords)];
}

// レポート生成
function generateReport(testResults, debugItems) {
  const now = new Date();
  const dateStr = now.toLocaleString('ja-JP');

  // テスト統計
  const passed = testResults.filter(t => t.status === 'passed').length;
  const failed = testResults.filter(t => t.status === 'failed').length;
  const skipped = testResults.filter(t => t.status === 'skipped').length;
  const total = passed + failed + skipped;
  const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

  // デバッグ統計
  const bugs = debugItems.filter(d => d['種別'] === 'バグ');
  const proposals = debugItems.filter(d => d['種別'] === '提案');
  const completedBugs = bugs.filter(d => d['対応完了'] === 'TRUE');
  const completedProposals = proposals.filter(d => d['対応完了'] === 'TRUE');
  const pendingItems = debugItems.filter(d => d['対応完了'] !== 'TRUE' && d['ステータス'] !== '完了');

  // カテゴリ別テスト
  const categories = categorizeTests(testResults);

  // デバッグ項目とテストのマッピング
  const mapping = mapDebugItemsToTests(debugItems, testResults);
  const coveredItems = mapping.filter(m => m.hasCoverage);
  const uncoveredItems = mapping.filter(m => !m.hasCoverage && m.type === 'バグ');

  let report = `# E2Eテスト結果 + デバッグ対応状況レポート

> 生成日時: ${dateStr}

---

## 1. テスト実行結果サマリー

| 項目 | 値 |
|------|-----|
| 合計テスト数 | ${total} |
| ✅ 成功 | ${passed} |
| ❌ 失敗 | ${failed} |
| ⏭️ スキップ | ${skipped} |
| **成功率** | **${successRate}%** |

`;

  // ステータスバッジ
  if (failed === 0 && total > 0) {
    report += `> ✅ **全テスト成功**\n\n`;
  } else if (failed > 0) {
    report += `> ⚠️ **${failed}件のテストが失敗しています**\n\n`;
  }

  // カテゴリ別テスト結果
  report += `### カテゴリ別テスト数

| カテゴリ | テスト数 | 成功 | 失敗 |
|----------|----------|------|------|
`;

  Object.entries(categories).forEach(([key, cat]) => {
    const catPassed = cat.tests.filter(t => t.status === 'passed').length;
    const catFailed = cat.tests.filter(t => t.status === 'failed').length;
    if (cat.tests.length > 0) {
      report += `| ${cat.name} | ${cat.tests.length} | ${catPassed} | ${catFailed} |\n`;
    }
  });

  // デバッグシート対応状況
  report += `
---

## 2. デバッグシート対応状況

| 項目 | 件数 |
|------|------|
| バグ報告 | ${bugs.length} |
| ├── 対応完了 | ${completedBugs.length} |
| └── 未対応 | ${bugs.length - completedBugs.length} |
| 提案 | ${proposals.length} |
| ├── 対応完了 | ${completedProposals.length} |
| └── 未対応 | ${proposals.length - completedProposals.length} |

`;

  // 未対応リスト
  report += `### 未対応項目リスト

`;

  if (pendingItems.length === 0) {
    report += `> ✅ 全ての項目が対応完了しています\n\n`;
  } else {
    report += `| ID | 種別 | 優先度 | 概要 | ステータス | テストカバー |
|-----|------|--------|------|------------|-------------|
`;

    pendingItems.forEach(item => {
      const id = item.ID || '-';
      const type = item['種別'] || '-';
      const priority = item['優先度'] || '-';
      const summary = (item['概要'] || '').substring(0, 40);
      const status = item['ステータス'] || '-';
      const mapping = coveredItems.find(m => m.id === id);
      const covered = mapping ? '✅' : '❌';
      report += `| ${id} | ${type} | ${priority} | ${summary}... | ${status} | ${covered} |\n`;
    });
  }

  // 失敗テスト詳細
  const failedTests = testResults.filter(t => t.status === 'failed');
  if (failedTests.length > 0) {
    report += `
---

## 3. 失敗テスト詳細

`;

    failedTests.slice(0, 10).forEach((test, idx) => {
      report += `### ${idx + 1}. ${test.name}

- **ファイル**: \`${test.file}\`
- **エラー**: ${(test.error || 'Unknown error').substring(0, 200)}

`;
    });

    if (failedTests.length > 10) {
      report += `*他 ${failedTests.length - 10} 件の失敗テストあり*\n\n`;
    }
  }

  // テストカバレッジ分析
  report += `
---

## 4. デバッグ項目のテストカバレッジ

`;

  if (uncoveredItems.length > 0) {
    report += `### テストが不足している可能性のあるバグ

以下のバグ報告に対応するE2Eテストが見つかりませんでした：

| ID | 概要 | 推奨テスト追加 |
|-----|------|---------------|
`;

    uncoveredItems.slice(0, 10).forEach(item => {
      const summary = item.summary.substring(0, 50);
      const recommend = suggestTest(item.summary);
      report += `| ${item.id} | ${summary}... | ${recommend} |\n`;
    });
  } else {
    report += `> ✅ 主要なバグ報告に対するテストカバレッジは良好です\n`;
  }

  // 推奨事項
  report += `
---

## 5. 推奨事項

`;

  const recommendations = [];

  if (failed > 0) {
    recommendations.push(`- [ ] 失敗している ${failed} 件のテストを修正する`);
  }
  if (pendingItems.length > 0) {
    const highPriority = pendingItems.filter(p => p['優先度'] === '緊急' || p['優先度'] === '高');
    if (highPriority.length > 0) {
      recommendations.push(`- [ ] 高優先度の未対応項目 ${highPriority.length} 件を優先的に対応する`);
    }
  }
  if (uncoveredItems.length > 0) {
    recommendations.push(`- [ ] テストカバレッジが不足している ${uncoveredItems.length} 件の項目にテストを追加する`);
  }
  if (successRate < 80) {
    recommendations.push(`- [ ] テスト成功率が80%を下回っています。テストの安定性を改善してください`);
  }
  if (recommendations.length === 0) {
    recommendations.push(`- ✅ 現在の状態は良好です。継続してテストを維持してください`);
  }

  report += recommendations.join('\n') + '\n';

  // フッター
  report += `
---

*このレポートは \`/sc:test --report\` コマンドによって自動生成されました*
*デバッグシート: ${debugSheetPath}*
`;

  return report;
}

// テスト追加の推奨
function suggestTest(summary) {
  if (/ログイン|認証|パスワード/.test(summary)) return 'worker/auth.spec.ts';
  if (/プロフィール|資格|登録/.test(summary)) return 'worker/profile.spec.ts';
  if (/求人|作成|テンプレート/.test(summary)) return 'facility/jobs.spec.ts';
  if (/応募|マッチング/.test(summary)) return 'worker/application.spec.ts';
  if (/メッセージ|通知/.test(summary)) return 'worker/messages.spec.ts';
  if (/施設|管理/.test(summary)) return 'facility/facility-settings.spec.ts';
  return '該当ファイルを特定';
}

// メイン処理
async function main() {
  console.log('統合レポート生成開始...');

  // テスト結果読み込み
  let testResults = [];
  if (fs.existsSync(testResultsPath)) {
    try {
      const content = fs.readFileSync(testResultsPath, 'utf8');
      const json = JSON.parse(content);

      // Playwrightの結果フォーマットからテストを抽出
      function extractTests(suites, results = []) {
        if (!suites) return results;
        suites.forEach(suite => {
          if (suite.specs) {
            suite.specs.forEach(spec => {
              const result = spec.results?.[0];
              results.push({
                file: suite.file || spec.file || 'unknown',
                name: spec.title,
                status: result?.status === 'passed' || result?.status === 'expected' ? 'passed' :
                        result?.status === 'skipped' ? 'skipped' : 'failed',
                duration: result?.duration || 0,
                error: result?.error?.message || null,
              });
            });
          }
          if (suite.suites) {
            extractTests(suite.suites, results);
          }
        });
        return results;
      }

      testResults = extractTests(json.suites || []);
    } catch (e) {
      console.warn('テスト結果ファイルの読み込みに失敗:', e.message);
    }
  } else {
    console.warn('テスト結果ファイルが見つかりません（空のレポートを生成します）');
  }

  // デバッグシート読み込み
  const debugItems = loadDebugSheet(debugSheetPath);
  console.log(`デバッグ項目: ${debugItems.length} 件`);

  // レポート生成
  const report = generateReport(testResults, debugItems);

  // ファイル出力
  fs.writeFileSync(outputPath, report);
  console.log(`レポートを生成しました: ${outputPath}`);
}

main().catch(console.error);
