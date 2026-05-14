# System Advisor セットアップガイド (ユーザー作業手順)

実装は完了しました。以下を順番に実施することで動作します。

## 1. ローカル DB へのスキーマ反映 (必須・最優先)

⚠️ Claude Code は本番/ステージング DB を触れません。すべてユーザーの手で実行してください。

### 1.1 シェル環境変数のクリア

```bash
unset DATABASE_URL DIRECT_URL
echo $DATABASE_URL  # 空を確認
```

### 1.2 ローカル Docker DB の起動

```bash
docker-compose up -d
docker ps  # postgres コンテナが起動していることを確認
```

### 1.3 Prisma スキーマ反映

```bash
npx prisma db push
npx prisma generate
```

### 1.4 反映確認

```bash
npx prisma studio
```

`http://localhost:5555` で以下のテーブルが追加されていれば OK:
- advisor_chat_sessions
- advisor_chat_messages
- advisor_audit_logs
- advisor_knowledge_cache
- advisor_knowledge_sync_logs
- advisor_usage_daily

## 2. 環境変数の設定 (ローカル)

`.env.local` に以下を追加:

```bash
# 必須
ANTHROPIC_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXX

# GitHub 知識同期 (推奨)
GITHUB_TOKEN_FOR_ADVISOR=ghp_XXXXXXXXXXXXXX
ADVISOR_GITHUB_OWNER=ichiro0712-dotcom
ADVISOR_GITHUB_REPO=share-worker-app

# Cron 認証用
ADVISOR_CRON_SECRET=$(openssl rand -base64 32)

# 任意 (機能拡張用、後で OK)
# VERCEL_API_TOKEN=
# VERCEL_PROJECT_ID=
# VERCEL_TEAM_ID=
# SUPABASE_MANAGEMENT_TOKEN=
# SUPABASE_PROJECT_REF=
```

### 2.1 Anthropic API キーの取得方法

1. https://console.anthropic.com にアクセス・サインアップ
2. API Keys メニュー → 「Create Key」
3. 表示されたキーをコピー (1度しか表示されない)
4. クレジットを残高にチャージしておく ($5 から)

### 2.2 GitHub Personal Access Token の取得方法

1. https://github.com/settings/tokens → 「Generate new token (classic)」
2. Note: `tastas-system-advisor`
3. Expiration: `90 days`
4. Scopes: **`public_repo` のみチェック** (private repo の場合は `repo` 全体)
5. Generate → 表示されたトークンをコピー

## 3. 初回ビルド・起動

```bash
unset DATABASE_URL DIRECT_URL
rm -rf .next
npm install   # 依存追加分をインストール
npm run build # TypeScript エラーがないか確認
npm run dev
```

ブラウザで `http://localhost:3000/system-admin/login` にアクセスしてログイン後、サイドバーから「システムアドバイザー」を選択。

## 4. 知識同期の手動実行 (初回必須)

初回は手動で知識同期を走らせて、CLAUDE.md / docs / Prisma schema をローカル DB にキャッシュします。

```bash
# .env.local の ADVISOR_CRON_SECRET と同じ値を使う
curl -X POST http://localhost:3000/api/cron/advisor-knowledge-sync \
  -H "Authorization: Bearer YOUR_ADVISOR_CRON_SECRET"
```

レスポンス例:
```json
{
  "status": "success",
  "filesTotal": 9,
  "filesChanged": 9,
  "filesUnchanged": 0,
  "errors": [],
  "durationMs": 1234
}
```

`status: success` または `partial` で、`filesChanged > 0` であれば OK。

## 5. 動作確認テスト (10項目)

`/system-admin/advisor` で以下を順に試してください:

| # | 質問 | 期待される挙動 |
|---|------|-------------|
| 1 | こんにちは | 簡潔な挨拶 + 何ができるかの説明 |
| 2 | TASTAS ってどんなサービス? | プロジェクト概要 (CLAUDE.md由来) |
| 3 | プロジェクトのディレクトリ構成は? | `list_directory` ツール呼び出し→結果表示 |
| 4 | Job テーブルにはどんなカラム? | `describe_db_table` 呼び出し→構造表示 |
| 5 | 利用可能な指標を教えて | `list_available_metrics` 呼び出し→14個リスト |
| 6 | 現在アクティブな求人は何件? | `query_metric` (ACTIVE_JOBS) 呼び出し |
| 7 | LINE登録数を見たい | 「未実装のため取得不可」+ 理由・代替案 |
| 8 | CLAUDE.mdの内容は? | `read_doc(claude_md)` で全文表示 |
| 9 | 最近のコミットは? | `get_recent_commits` で履歴表示 |
| 10 | 先週のLP1のPV数は? | `query_metric` (LP_PV, lp_id=1) |

各項目で:
- ストリーミング表示が流れる
- ツール呼び出しが UI 上にバッジで表示される
- データに基づく回答が返る (推測ではなく)

## 6. ステージング/本番への展開

ローカルで動作確認できたら:

### 6.1 ステージング DB へのスキーマ反映

ユーザーの手で:
```bash
# 一時的にステージングDBに接続
export DATABASE_URL="postgres://..."
export DIRECT_URL="postgres://..."
npx prisma db push

# 完了後、必ずクリア
unset DATABASE_URL DIRECT_URL
```

または Supabase ダッシュボードから SQL を直接実行する方法もあります。

### 6.2 ステージング Vercel 環境変数の設定

⚠️ **CLAUDE.md ルールに従い、Claude Code は環境変数を CLI で操作できません。Vercel ダッシュボードから手動で:**

```
ANTHROPIC_API_KEY               (Production + Preview)
GITHUB_TOKEN_FOR_ADVISOR        (Production + Preview)
ADVISOR_GITHUB_OWNER            (Production + Preview)
ADVISOR_GITHUB_REPO             (Production + Preview)
ADVISOR_CRON_SECRET             (Production + Preview)

# 任意
VERCEL_API_TOKEN                (Production + Preview)
SUPABASE_MANAGEMENT_TOKEN       (Production + Preview)
```

設定後、Redeploy を実行。

### 6.3 cron 設定 (任意・推奨)

Vercel Cron Jobs を使う場合、`vercel.json` に追加:

```json
{
  "crons": [
    {
      "path": "/api/cron/advisor-knowledge-sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

(毎時 0分に実行)。本番反映後、Vercel ダッシュボードで cron 動作確認。

### 6.4 PR作成

ローカルで動作確認できたらブランチ `feature/system-advisor-chatbot` を develop に PR 出します:

⚠️ Claude Code から PR 作成を依頼してください (push/PR は自分でやらないルール)

## 7. legacy フォルダの最終削除

ステージング/本番で動作確認 OK なら:

```bash
# 削除前の最終確認
npm run build  # 成功すること
ls src/components/advisor/  # AdvisorChatLayout.tsx があること
ls src/lib/advisor/         # 全ファイルが揃っていること

# 削除実行
rm -rf _legacy_agent-hub

# git に反映
git add -A
git commit -m "リファクタリング: System Advisor 移行完了に伴い _legacy_agent-hub を削除"
```

## トラブルシューティング

### 「ANTHROPIC_API_KEY is not set」エラー

```bash
unset DATABASE_URL DIRECT_URL  # シェル変数クリア
# .env.local を再確認
cat .env.local | grep ANTHROPIC
npm run dev
```

### 「knowledge cache is empty」(チャットの応答が薄い)

→ Step 4 の知識同期を実行してください。同期前は CLAUDE.md 等が空のまま動作します。

### CSS が崩れる

```bash
rm -rf .next
npm run dev
```

ブラウザはハードリロード (Cmd+Shift+R)。

### Prisma 関連エラー (例: 「Property 'advisorChatSession' does not exist」)

```bash
npx prisma generate
```

### Cron が認証失敗 (401)

`.env.local` の `ADVISOR_CRON_SECRET` と curl の `Bearer` の値が一致しているか確認。

## 動作確認後の報告内容

実装完了後、以下をチームに共有すると良い:

```markdown
# System Advisor 導入完了

## 環境
- 本番: tastas.work で稼働中
- ステージング: stg-share-worker.vercel.app で稼働中
- ローカル: localhost:3000

## 設定済み
- [x] DB スキーマ反映 (ローカル/ステージング/本番)
- [x] Anthropic API キー
- [x] GitHub PAT (有効期限: YYYY-MM-DD)
- [x] cron スケジュール (1時間ごと)

## 利用可能な機能
- 18 ツール (うち 15 が Phase 1 で稼働、3 は将来実装の placeholder)
- セッション継続
- 監査ログ
- コスト管理 (1日 200万トークンキャップ)
- レート制限 (1人 60req/h, 500req/日)

## 残課題
- LINE Webhook 連携 (LINE登録数の取得)
- Search Console API 連携 (検索クエリ別流入)
- Lstep Webhook 連携 (Lstep配信ログ)

これらが必要になったら docs/system-advisor/tools-spec.md の「拡張手順」を参照。
```
