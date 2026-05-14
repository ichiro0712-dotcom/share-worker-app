/**
 * システムプロンプト構築
 *
 * 詳細仕様: docs/system-advisor/system-prompt.md
 *
 * 静的部分 (固定) + 動的部分 (セッション情報) を分けて返す。
 * 静的部分はハッシュも一緒に返し、prompt cache の同一性監視に使う。
 */

import crypto from 'node:crypto';
import { readKnowledge } from './knowledge/store';
import { formatJST } from './jst';
import { METRIC_CATALOG } from './tools/tastas-data/metrics-catalog';
import { getDraftBySession, type ReportDraftSnapshot } from './persistence/report-drafts';
import { getRecentSemanticMemory, type SemanticMemoryRecord } from './persistence/semantic-memory';

export interface SystemPromptResult {
  /** 静的部分 (cache_control 対象) */
  cachedPart: string;
  /** 静的部分のハッシュ (短縮 16文字) */
  cachedHash: string;
  /** 動的部分 (cache しない) */
  dynamicPart: string;
}

const ROLE_AND_MISSION = `あなたは TASTAS (タスタス) のシステムアドバイザーです。
TASTAS は看護師・介護士向け求人マッチングサービスです。

# あなたの役割

System Admin (システム管理者) からの質問に答えるアシスタントです。
具体的には以下のような問い合わせに対応します:

- TASTAS のシステム構成・仕様・実装方法に関する質問
- 本番DBの数値や状態に関する調査 (ユーザー数、求人数、特定LPのCV率等)
- Vercel / Supabase のログ調査
- GA4 のアクセスデータ
- 「この機能は技術的に可能か?」のような企画的質問

# あなたの権限

- 読み取り専用です。コード変更、DB書き込み、外部APIの状態変更は一切できません
- 提供されているツール (Function calling) のみを使ってデータにアクセスします`;

const CRITICAL_CONSTRAINTS = `# 厳守すべき制約

1. **コードを直接編集する提案はしない**
   - 「ここを修正してください」のような提案は OK
   - ただし「私が修正しました」のような表現は禁止

2. **本番データの破壊的操作の方法を提示しない**
   - "DELETE FROM" や "drop table" のような SQL を生成しない
   - ユーザーが質問しても危険な操作の手順は説明しない

3. **データに基づく回答**
   - 数値を答える時は必ずツールで取得した実データを根拠にする
   - 「だいたい〜」「おそらく〜」で数字を捏造しない
   - データ取得失敗時は素直に「取得できなかった」と返す

4. **取得できない指標は理由を構造化して説明する**
   - 下記「利用可能なメトリクス一覧」に available: false と記載されている指標を聞かれたら、
     その理由 (例: "LINE Webhookが未実装") と代替案を併せて返す

5. **JST (日本標準時) を使う**
   - 日付の入出力はすべて JST 基準
   - "今日" "昨日" "先週" は JST で解釈

6. **個人情報の取り扱い**
   - 必要な範囲を超えた個人情報の表示は控える
   - メール・電話番号を返す場合は、文脈上必要な時のみ`;

const TOOLS_HINT = `# ツール利用の方針

利用可能なツールはAPI側に渡されています。各ツールの description を必ず読み、
適切なものを選んでください。

## 質問種別ごとの推奨ツール

| 質問の例 | 推奨ツール |
|---------|----------|
| "このコードは何をしている?" | search_codebase → read_repo_file |
| "求人テーブルにはどんなカラム?" | describe_db_table |
| "アクティブな求人は何件?" | get_jobs_summary |
| "先週のLP3のCV率は?" | query_metric (下記の指標一覧から key を選ぶ) |
| "今エラー出てる?" | get_recent_errors → get_vercel_logs |
| "ワーカーTOPのアクセス数" | query_metric (PUBLIC_JOB_PV / JOB_SEARCH_PV) |
| "GA4のデータ見たい" | query_ga4 |
| "最近のデプロイ状況" | get_vercel_deployments |
| "CLAUDE.mdの内容" | read_doc(claude_md) |

## 連鎖呼び出し

多くの質問は 2〜4 ツールの連鎖で答えるのがベスト。

## 取得できない時の対応

- 下記「利用可能なメトリクス一覧」で available: false と記載されているものは取得不可
- ツールの description に "現在利用不可" と書かれている場合、その理由をユーザーに正直に伝える
- 代替案を提示する (近似データ・別の取得方法)

## レポート作成モード (補足)

レポート関連のメッセージ (\`[TOOL:report_create]\` / \`[TOOL:draft_revise]\` / \`[TOOL:result_edit]\`)
は基本的に **Gemini バイパス経路で自動処理される** ため、Claude (あなた) がここを処理することは
ほぼ無い。例外的に Claude に流れてくるのは「ドラフト未存在で TOOL:draft_revise が来た」など
**前提条件 NG ケース** のみ。その場合は短く「ドラフトをまず作りましょう」のような
ガイダンスを返すだけで OK。

### レポート出力の制約 (補足、ユーザーから質問されたら答える用)

- グラフ / チャート / 画像生成: 未対応 (Markdown のみ)
- 添付ファイル / Excel / PDF 出力: 未対応
- 表 (Markdown table) / 箇条書き / 見出し / 太字 / コードブロックは OK`;

/**
 * `query_metric` で利用可能なメトリクス一覧を Markdown 表で生成する。
 * これを system prompt に静的に埋め込むことで、Claude が `list_available_metrics` ツールを
 * 呼び出さなくても直接 metric_key を選べるようにする (ツール round-trip を 1 回減らす)。
 *
 * ⚠️ Single Source of Truth は metrics-catalog.ts。手書きせず必ずカタログから生成する。
 */
function buildMetricsCatalogSection(): string {
  const lines: string[] = []
  lines.push('# 利用可能なメトリクス一覧 (query_metric の metric_key)')
  lines.push('')
  lines.push('`query_metric` ツールで取得可能なメトリクスは以下の通り。')
  lines.push('Claude はこの表を直接参照して metric_key を選ぶこと (`list_available_metrics` ツールは廃止済み)。')
  lines.push('')
  lines.push('| key | 表示名 | 単位 | available | group_by | 説明 |')
  lines.push('|---|---|---|---|---|---|')
  for (const m of METRIC_CATALOG) {
    const groupBy = m.supportedGroupBy.join(', ')
    const avail = m.available ? '✅' : `❌ (${m.reason ?? '未対応'})`
    // 説明はパイプ文字を除去 (Markdown 表が壊れないように)
    const desc = m.description.replace(/\|/g, '/').replace(/\n/g, ' ')
    lines.push(`| \`${m.key}\` | ${m.label} | ${m.unit} | ${avail} | ${groupBy} | ${desc} |`)
  }
  lines.push('')
  lines.push('### 計算ロジック (詳しい挙動を知りたい時の参考)')
  lines.push('')
  for (const m of METRIC_CATALOG) {
    if (!m.available) continue
    lines.push(`- **\`${m.key}\`**: ${m.calculation}`)
  }
  return lines.join('\n')
}

const RESPONSE_STYLE = `# 回答スタイル

## 基本方針
- 簡潔・正確・データドリブン
- 数値は必ず単位と期間を明記 (例: "2026/04/24〜2026/04/30 で 1,234 PV")
- 推測と事実を区別する。推測時は「おそらく」「と思われる」を付与

## マークダウン
- 表形式が適している場合は積極的に表で返す
- 数値リスト・箇条書きを活用
- コード断片を引用する場合はファイルパスと行番号を併記
  例: src/lib/auth.ts:42

## 長さ
- 質問が短ければ回答も短く
- 複雑な質問は構造化 (見出し + 箇条書き)
- 不要な前置き・お礼の繰り返しは省く

## わからない時の対応
- 「データに基づくと不明」「ツールでは取得できない」と素直に答える
- 推測で埋めない
- 必要な追加情報を逆質問する

## 言語
- 日本語で回答 (ユーザーが日本語管理者のため)
- 専門用語は必要に応じて使ってよい
- 略語の初出は展開する (例: "CV (Conversion)")`;

const SAFETY_FALLBACK = `# 安全装置

## 質問が曖昧な時
- 「先週」「最近」のような曖昧な表現は最初に解釈を確認
- 例: 「先週」→ 「先週 (X月X日〜X月X日 JST) のデータでよろしいですか?」

## 大量データ要求
- 1000行を超えそうなクエリは集計を提案
- 個別レコード一覧より集計値・トレンドを優先

## ツール失敗時
- 1度失敗したら別アプローチを試す
- 連続失敗時はユーザーに状況を報告して指示を仰ぐ

## 機密性の高い質問
- 個人情報の大量出力要求は丁重に断る
- "全ユーザーのメール一覧" のような要求は理由を聞く`;

/**
 * デフォルトのプロンプト本体 (override 用に外部からも参照可能にしたもの)。
 * 設定ページで「現状のプロンプトをコピーして編集する」UX を実現するために export する。
 *
 * METRICS_CATALOG_SECTION は metrics-catalog.ts から自動生成される動的セクション。
 * Claude が `list_available_metrics` ツールを呼ぶ往復を省略するため、ここに直接列挙する。
 */
export const DEFAULT_PROMPT_SECTIONS = [
  ROLE_AND_MISSION,
  CRITICAL_CONSTRAINTS,
  TOOLS_HINT,
  buildMetricsCatalogSection(),
  RESPONSE_STYLE,
  SAFETY_FALLBACK,
] as const;

export function getDefaultPromptText(): string {
  // 知識ブロックは含めない (動的生成のため)。設定ページで編集する人間が触れる "ルール" 部分のみ。
  return DEFAULT_PROMPT_SECTIONS.join('\n\n---\n\n');
}

export async function buildSystemPrompt(opts: {
  admin: { id: number; name: string; role: string };
  sessionId: string;
  /**
   * 設定ページで保存された override テキスト。
   * 空文字 / null / undefined ならデフォルト (ROLE+CONSTRAINTS+TOOLS_HINT+RESPONSE+SAFETY) を使う。
   * override がある場合はそれが ROLE+CONSTRAINTS 等の役割を全て担う。
   * (知識ブロックは override しない: 動的データなので常に注入する)
   */
  systemPromptOverride?: string | null;
}): Promise<SystemPromptResult> {
  // 知識を順序固定で取得 (ハッシュの安定性のため)
  const knowledgeKeys = [
    'claude_md',
    'metric_definitions',
    'schema_prisma',
    'advisor_readme',
    'advisor_architecture',
  ];
  const records = await readKnowledge(knowledgeKeys);

  let knowledgeBlock = '# プロジェクト知識\n\n';
  if (records.length === 0) {
    knowledgeBlock +=
      '⚠️ 知識キャッシュが空です。`read_doc` ツールや `read_repo_file` ツールで都度取得してください。\n';
  } else {
    for (const r of records) {
      knowledgeBlock += `## ${r.label}\n\n`;
      // サイズが大きいものは要約を促す注釈
      const limit = 30000;
      if (r.content.length > limit) {
        knowledgeBlock += r.content.slice(0, limit);
        knowledgeBlock += `\n\n... (この知識は ${r.byteSize} バイトあり、最初の ${limit} 文字のみ表示しています。詳細は read_doc('${r.key}') で全文取得可能です。)\n\n`;
      } else {
        knowledgeBlock += r.content + '\n\n';
      }
    }
  }

  // override があれば本体ルールを差し替え。空文字も "未設定" とみなす。
  const hasOverride = !!opts.systemPromptOverride && opts.systemPromptOverride.trim().length > 0;
  const ruleSections = hasOverride
    ? [opts.systemPromptOverride!.trim()]
    : DEFAULT_PROMPT_SECTIONS.slice();

  const cachedPart = [
    ...ruleSections,
    knowledgeBlock,
  ].join('\n\n---\n\n');

  const cachedHash = crypto.createHash('sha256').update(cachedPart).digest('hex').slice(0, 16);

  // 現在のレポートドラフト状態を毎リクエスト埋め込む。
  // これで Claude はツール往復なしに最新状態を把握でき、
  // ドラフト修正時の余分なループ往復 (TTFB 100 秒級) を排除する。
  const draft = await getDraftBySession(opts.sessionId).catch(() => null);
  const draftBlock = draft ? renderDraftStateBlock(draft) : '';

  // しおり付きセッションの過去レポートを「意味的記憶」として埋め込む。
  // ユーザーが「先月のレポートで言ってた○○」のような文脈依存質問をした時、
  // Claude / Gemini がここを参照して回答できるようにする。
  // (取り込み元: app/api/cron/advisor-semantic-ingest 毎日 04:30 JST)
  const memories = await getRecentSemanticMemory({
    adminId: opts.admin.id,
    category: 'advisor_report',
    limit: 5,
  }).catch(() => []);
  const memoryBlock = memories.length > 0 ? renderSemanticMemoryBlock(memories) : '';

  const dynamicPart = [
    '# このセッションの情報',
    '',
    `- 質問者: ${opts.admin.name} (role: ${opts.admin.role})`,
    `- 現在時刻 (JST): ${formatJST(new Date())}`,
    `- セッションID: ${opts.sessionId}`,
    `- 知識キャッシュハッシュ: ${cachedHash}`,
    memoryBlock,
    draftBlock,
  ]
    .filter((s) => s.length > 0)
    .join('\n');

  return { cachedPart, cachedHash, dynamicPart };
}

/**
 * 現在のレポートドラフトを system prompt の dynamic 部分に埋め込むためのレンダリング。
 * Claude がツール往復なしに最新状態を把握できるようにする。
 */
function renderDraftStateBlock(draft: ReportDraftSnapshot): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('# 現在のレポートドラフト状態 (このセッションで進行中)');
  lines.push('');
  lines.push('右側 Canvas に表示されているドラフトの最新値。');
  lines.push('修正指示が来たらこの内容を参照し、update_report_draft で差分のみ送る。');
  lines.push('');
  if (draft.originalRequest) {
    lines.push('## 元の要望 (このドラフトを始めた発端)');
    lines.push(draft.originalRequest);
    lines.push('');
  }
  lines.push('## 要件メタ');
  lines.push(`- title: ${draft.title ?? '(未指定)'}`);
  lines.push(`- goal: ${draft.goal ?? '(未指定)'}`);
  lines.push(`- range: ${draft.rangeStart ?? '?'} 〜 ${draft.rangeEnd ?? '?'}`);
  lines.push(`- data_sources: ${draft.dataSources.length > 0 ? draft.dataSources.join(', ') : '(未指定)'}`);
  lines.push(`- metric_keys: ${draft.metricKeys.length > 0 ? draft.metricKeys.join(', ') : '(未指定)'}`);
  if (draft.outline) {
    lines.push('');
    lines.push('## outline');
    lines.push(draft.outline);
  }
  if (draft.notes) {
    lines.push('');
    lines.push('## notes');
    lines.push(draft.notes);
  }
  if (draft.skeletonMarkdown) {
    lines.push('');
    lines.push('## skeleton_markdown (ドラフト本体 / 0 埋めの表骨格)');
    lines.push('```markdown');
    lines.push(draft.skeletonMarkdown);
    lines.push('```');
  }
  return lines.join('\n');
}

/**
 * しおり付きセッションの過去レポートを「意味的記憶」として埋め込む。
 *
 * ユーザーが「先月のレポートで言ってた○○」のような文脈依存質問をした時、
 * Claude / Gemini がここを参照して具体内容に沿った回答ができる。
 *
 * 取り込み元: app/api/cron/advisor-semantic-ingest (毎日 04:30 JST)
 * 取り込み対象: AdvisorChatSession.bookmarked = true なセッションの最新レポート
 * 表示件数: 最新 5 件 (token 量制御のため)
 * 各レポート本文: cron 側で 8,000 字に truncate 済み
 */
function renderSemanticMemoryBlock(memories: SemanticMemoryRecord[]): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('# 過去の重要レポート (しおり付きセッションの最新版、意味的記憶)');
  lines.push('');
  lines.push('以下は質問者が「しおり (永続保存)」を付けたセッションの最新レポート。');
  lines.push('「先月のレポートで言ってた○○」「あのレポートでは○○と書いた」のような');
  lines.push('文脈依存質問が来たら、ここから該当内容を引いて回答する。');
  lines.push('該当内容が無ければ「過去レポートには見当たりません」と正直に答える。');
  lines.push('');
  for (const m of memories) {
    const meta = (m.metadata && typeof m.metadata === 'object' && !Array.isArray(m.metadata)
      ? m.metadata
      : {}) as Record<string, unknown>;
    const versionNumber = meta.versionNumber ?? '?';
    const generatedAt = meta.generatedAt ?? '?';
    lines.push(`## ${m.title} (v${versionNumber}, ${generatedAt})`);
    lines.push('');
    lines.push('```markdown');
    lines.push(m.content);
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}
