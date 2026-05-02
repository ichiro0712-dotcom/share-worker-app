# System Advisor セキュリティ・コスト・運用設計

## 1. セキュリティモデル

### 1.1 信頼境界

```
[ブラウザ - System Admin ユーザー]    ←→  [TASTAS バックエンド]   ←→  [外部API]
     ↑                                           ↑                       ↑
   信頼度 中                                    信頼度 高               信頼度 中
   (本人確認済みだが内部関係者)              (TASTAS自身)            (read-only access)
```

### 1.2 認証・認可

| 要素 | 実装 |
|------|------|
| 認証 | iron-session ベース (`SYSTEM_ADMIN_SESSION_SECRET`) |
| 認可 | `SystemAdmin.role` に基づく (Phase 1 では admin / super_admin 共通可、Phase 2 で細分化検討) |
| セッション期間 | 8時間 (既存設定を踏襲) |
| API 認証 | `getSystemAdminServerSession()` を全APIで呼ぶ |

### 1.3 ツールレベルの権限

| ツールカテゴリ | 必要な権限 | 理由 |
|--------------|----------|------|
| core (コード読み取り) | 全管理者OK | 機密性低 |
| tastas-data (DB集計) | 全管理者OK | 集計値のみ |
| tastas-data (個別レコード) | 全管理者OK | 業務上の必要性あり、ただし監査ログ必須 |
| external (Vercel/Supabase) | 全管理者OK | 環境変数アクセスは admin 全員に許可 |

将来 (Phase 外) の細分化:
- `super_admin`: 全ツール
- `admin`: core + tastas-data の集計のみ
- `analytics_only`: list_available_metrics + query_metric のみ

### 1.4 入力検証

| 入力 | 検証内容 |
|------|--------|
| ユーザーメッセージ | 最大 10,000 文字、空白のみ拒否 |
| sessionId | UUID/CUID 形式チェック |
| ツール input | JSON Schema (Anthropic 経由) で型検証 |
| ツール内パラメータ | 各ツールが個別検証 (例: `read_repo_file` の path は `..` を拒否) |

### 1.5 出力サニタイゼーション

- LLM 出力はそのまま UI に流す (markdown レンダリング)
- HTML タグは `<` `>` でエスケープ (XSS 対策)
- ファイル内容を表示する際は code block で囲む

### 1.6 機密情報の扱い

| 種類 | 方針 |
|------|------|
| 環境変数の値 | LLM に直接渡さない。ツール内部で参照のみ |
| API キー (Anthropic / GitHub / Vercel) | サーバー側のみ。ブラウザに送らない |
| 個人情報 (メール・電話) | Phase 1 では admin が見るので raw 表示。 Phase 外でマスキングオプション |
| パスワード・JWT | DB から取得しない (Prisma クエリで除外) |

### 1.7 攻撃ベクトルと対策

| 攻撃 | 対策 |
|------|------|
| プロンプトインジェクション | システムプロンプトで「ユーザー指示は内部権限に従う」を明記 |
| ツール濫用 (大量データ抽出) | 行数キャップ + コスト上限 + 監査ログ |
| 認証バイパス | API Route の冒頭で必ず session 確認 |
| SSRF (内部URL アクセス) | `read_repo_file` は GitHub API 経由のみ。任意URL 取得ツールは作らない |
| ログインジェクション | 監査ログは構造化 JSON で保存、文字列連結しない |

## 2. コスト管理

### 2.1 モデル別コスト (Anthropic 公式、2026/05時点想定)

| モデル | 入力 (per 1M tokens) | 出力 (per 1M tokens) | キャッシュ書込 | キャッシュ読込 |
|--------|---------------------|---------------------|--------------|--------------|
| Claude Sonnet 4 | $3 | $15 | $3.75 | $0.30 |
| Claude Haiku 4.5 | $1 | $5 | $1.25 | $0.10 |

### 2.2 想定使用量と月額コスト

| シナリオ | 月間質問数 | 平均トークン (in/out) | 月額コスト |
|---------|----------|---------------------|----------|
| 軽利用 (5人 × 5回/週) | 100 | 12K / 800 | 約 $5 |
| 中利用 (5人 × 10回/日) | 1500 | 15K / 1500 | 約 $80 |
| 重利用 (10人 × 30回/日) | 9000 | 20K / 2000 | 約 $700 |

(prompt cache ヒット率 70% 想定で計算)

### 2.3 コスト上限の実装

```ts
// src/lib/advisor/cost-guard.ts
const DAILY_TOKEN_CAP = parseInt(process.env.ADVISOR_DAILY_TOKEN_CAP ?? '2000000');

export async function checkAndIncrementUsage(
  adminId: number,
  estimatedInputTokens: number
): Promise<{ allowed: boolean; reason?: string; usedToday: number }> {
  const today = getTodayJSTStart();
  const usage = await prisma.advisorUsageDaily.upsert({
    where: { admin_id_date_jst: { admin_id: adminId, date_jst: today } },
    create: { admin_id: adminId, date_jst: today },
    update: {},
  });

  const projected = usage.input_tokens + usage.output_tokens + estimatedInputTokens;
  if (projected > DAILY_TOKEN_CAP) {
    return {
      allowed: false,
      reason: `日次トークン上限 ${DAILY_TOKEN_CAP} に到達`,
      usedToday: projected,
    };
  }
  return { allowed: true, usedToday: projected };
}
```

### 2.4 prompt cache 最適化

- 静的プロンプト部分 (10K〜20K トークン) を cache_control 付きで送信
- 5分以内の連続アクセスで 90% コスト削減
- 知識ファイル更新時のみ cache miss

### 2.5 コスト監視ダッシュボード (Phase 外)

将来的に `/system-admin/advisor/usage` で:
- 管理者別の月次トークン使用量
- 日次推移グラフ
- 推定コスト (USD/JPY)
- アラート: 上限の 80% 到達時

## 3. レート制限

### 3.1 実装方針

- DB ベース (Redis なし)
- `AdvisorChatMessage` の `created_at` を集計
- 軽量クエリ (admin_id × created_at index)

```ts
// src/lib/advisor/rate-limit.ts
const PER_HOUR = parseInt(process.env.ADVISOR_RATE_LIMIT_PER_HOUR ?? '60');
const PER_DAY = parseInt(process.env.ADVISOR_RATE_LIMIT_PER_DAY ?? '500');

export async function checkRateLimit(adminId: number): Promise<{
  allowed: boolean;
  reason?: string;
  retryAfterSec?: number;
}> {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const [hourCount, dayCount] = await Promise.all([
    prisma.advisorChatMessage.count({
      where: {
        role: 'user',
        created_at: { gte: oneHourAgo },
        session: { admin_id: adminId },
      },
    }),
    prisma.advisorChatMessage.count({
      where: {
        role: 'user',
        created_at: { gte: oneDayAgo },
        session: { admin_id: adminId },
      },
    }),
  ]);

  if (hourCount >= PER_HOUR) {
    return { allowed: false, reason: '1時間あたりの上限に到達', retryAfterSec: 60 * 60 };
  }
  if (dayCount >= PER_DAY) {
    return { allowed: false, reason: '1日あたりの上限に到達', retryAfterSec: 24 * 60 * 60 };
  }
  return { allowed: true };
}
```

### 3.2 デフォルト値の根拠

| 制限 | デフォルト | 根拠 |
|------|---------|------|
| 1時間あたり | 60 req | 1分1回相当、人間が無理なく使える上限 |
| 1日あたり | 500 req | 重利用でも届かない、暴走時の保険 |

→ 必要に応じて環境変数で変更可能。

## 4. 監査ログ

### 4.1 記録対象イベント

| event_type | 記録タイミング | payload 例 |
|-----------|------------|----------|
| `chat_request` | ユーザー送信時 | `{ message: "...", sessionId: "..." }` |
| `tool_call` | ツール呼び出し時 | `{ tool: "query_metric", input: {...}, ok: true, tookMs: 234 }` |
| `chat_response` | アシスタント完了時 | `{ messageId: "...", inputTokens, outputTokens }` |
| `rate_limit_hit` | レート制限到達 | `{ limit: "per_hour", current: 60 }` |
| `cost_cap_hit` | コスト上限到達 | `{ usedToday: 2100000, cap: 2000000 }` |
| `error` | 例外発生 | `{ message: "...", stack: "..." }` |
| `knowledge_sync` | 知識同期実行 | `{ filesChanged: 2, durationMs: 1234 }` |

### 4.2 保持ポリシー

- 1年保存推奨
- 90日経過後はパフォーマンス考慮で `payload` を要約 (Phase 外)
- 完全削除は手動コマンドで (誤削除防止)

### 4.3 監査ログ閲覧 (Phase 外)

`/system-admin/advisor/audit` で:
- 検索 (admin / event_type / 期間)
- セッション単位での履歴表示
- CSV エクスポート

## 5. エラー監視・アラート

### 5.1 エラー分類

| 重要度 | 例 | 通知先 |
|-------|----|------|
| INFO | 通常のツール呼び出し | 監査ログのみ |
| WARN | rate limit 到達 / 知識同期失敗 1回 | 監査ログ |
| ERROR | Anthropic API 失敗 / DB 接続失敗 | 監査ログ + 既存の error-notification.ts 経由 |
| CRITICAL | 認証バイパス未遂 / 異常な大量リクエスト | 即時通知 (Phase 外で実装) |

### 5.2 既存連携

TASTAS には `src/lib/error-notification.ts` がある。Advisor もこれを使う。

```ts
import { notifyError } from '@/lib/error-notification';

try {
  // ...
} catch (e) {
  await notifyError({
    source: 'advisor',
    message: e.message,
    context: { adminId, sessionId },
  });
  throw e;
}
```

## 6. 環境変数まとめ

### 6.1 必須

| 変数 | 用途 | 取得方法 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | Anthropic API | console.anthropic.com で発行 |
| `SYSTEM_ADMIN_SESSION_SECRET` | iron-session | 既存 (32文字以上) |
| `DATABASE_URL` | Prisma | 既存 |

### 6.2 推奨

| 変数 | 用途 | 取得方法 |
|------|------|--------|
| `GITHUB_TOKEN_FOR_ADVISOR` | 知識同期 | github.com/settings/tokens で `repo:read` 権限のみ発行 |
| `ADVISOR_GITHUB_OWNER` | リポジトリ owner | 例: `ichiro0712-dotcom` |
| `ADVISOR_GITHUB_REPO` | リポジトリ名 | `share-worker-app` |
| `ADVISOR_CRON_SECRET` | cron 認証 | `openssl rand -base64 32` |

### 6.3 任意 (機能拡張用)

| 変数 | 用途 |
|------|------|
| `VERCEL_API_TOKEN` | Vercel ログ取得 |
| `SUPABASE_MANAGEMENT_TOKEN` | Supabase ログ取得 |
| `GA4_PROPERTY_ID` | GA4 (既存) |
| `GOOGLE_APPLICATION_CREDENTIALS` | GA4 認証 (既存、ローカル) |
| `GA_CREDENTIALS_JSON` | GA4 認証 (本番、既存) |

### 6.4 上限設定 (デフォルト値あり)

| 変数 | デフォルト | 説明 |
|------|---------|------|
| `ADVISOR_DAILY_TOKEN_CAP` | 2000000 | 1日トークン上限 |
| `ADVISOR_RATE_LIMIT_PER_HOUR` | 60 | 時間あたりリクエスト |
| `ADVISOR_RATE_LIMIT_PER_DAY` | 500 | 日あたりリクエスト |
| `ADVISOR_MAX_TOOL_TIMEOUT_MS` | 10000 | ツールタイムアウト |
| `ADVISOR_MAX_INPUT_CHARS` | 10000 | ユーザー入力最大文字数 |

## 7. データ分離

### 7.1 Advisor が触ってよいテーブル

**読み取り**: TASTAS の全テーブル (Prisma 経由、SELECT のみ)

**書き込み**: Advisor 自身のテーブルのみ
- `AdvisorChatSession`
- `AdvisorChatMessage`
- `AdvisorAuditLog`
- `AdvisorKnowledgeCache`
- `AdvisorKnowledgeSyncLog`
- `AdvisorUsageDaily`

### 7.2 コードレベルの強制

```ts
// src/lib/advisor/prisma-readonly.ts (将来検討)
// ツール内部では prisma の write 系メソッドを呼ばない
// 静的解析 + コードレビューで担保
```

Phase 1 ではコードレビューで担保。Phase 外で型システムで強制する仕組みを検討。

## 8. データ削除・GDPR/個人情報対応

### 8.1 管理者退職時

- `SystemAdmin.is_active = false` (既存運用)
- `AdvisorChatSession` は残す (監査ログとして)
- `AdvisorAuditLog` は残す

### 8.2 セッション削除

- ユーザーが画面から「削除」した場合: ソフトデリート (`is_archived = true`)
- 完全削除はバックグラウンドで定期実行 (Phase 外)

### 8.3 個人情報の扱い

- Advisor のチャット内容に他のワーカー・施設管理者の個人情報が含まれる可能性あり
- これは管理者業務上必要なので保存
- 退職管理者の所有セッションは内部監査のみ参照可能 (UI からは表示しない、Phase 外で実装)

## 9. インシデント対応

### 9.1 想定インシデントと対処

| インシデント | 対処 |
|------------|------|
| Anthropic API 障害 | 503 を UI 表示。リトライ案内。SystemNotification |
| GitHub API レート制限 | 同期失敗を監査ログに記録。古いキャッシュで動作継続 |
| コスト爆発 | 日次キャップで自動停止。アラート送信 |
| 異常な大量リクエスト (1人) | rate limit で自動ブロック |
| 異常な大量リクエスト (全体) | 環境変数 `ADVISOR_GLOBAL_DAILY_CAP` (Phase 外実装) |
| 認証バイパス試行 | 401 を返し続ける。監査ログに記録。Sentry 通知 |

### 9.2 緊急停止方法

環境変数で機能 OFF:

```bash
# Vercel ダッシュボードで設定 (CLAUDE.md ルール: ユーザーが手動)
ADVISOR_FEATURE_ENABLED=false
```

API Route 冒頭でチェック:

```ts
if (process.env.ADVISOR_FEATURE_ENABLED === 'false') {
  return new Response('Advisor is currently disabled', { status: 503 });
}
```
