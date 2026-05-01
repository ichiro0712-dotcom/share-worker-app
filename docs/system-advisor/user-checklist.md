# System Advisor 最終チェックリスト (ユーザー向け)

このドキュメントは、Claude Code が実装を完了した後に**ユーザー (kawashima)** が確認・実施すべき作業をまとめたものです。

---

## 0. 全体の流れ

```
Step 1: 環境変数の設定 (ローカル + Vercel)
Step 2: ローカルDBへのスキーマ反映
Step 3: ローカルでのビルド・起動・動作確認
Step 4: ステージング/本番への展開判断
Step 5: legacy フォルダの最終削除
Step 6: GitHub Personal Access Token の発行
Step 7: ステージング/本番への DB push (本人作業)
```

---

## Step 1: 環境変数の設定

### 1.1 ローカル (`.env.local`)

以下を `.env.local` に追加:

```bash
# Anthropic API キー (必須)
ANTHROPIC_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXX

# GitHub Personal Access Token (Advisor 用)
# Step 6 で発行する
GITHUB_TOKEN_FOR_ADVISOR=ghp_XXXXXXXXXXXXXXX
ADVISOR_GITHUB_OWNER=ichiro0712-dotcom
ADVISOR_GITHUB_REPO=share-worker-app

# Cron 認証用シークレット (32文字以上)
ADVISOR_CRON_SECRET=$(openssl rand -base64 32)

# 上限設定 (任意、デフォルト値あり)
ADVISOR_DAILY_TOKEN_CAP=2000000
ADVISOR_RATE_LIMIT_PER_HOUR=60
ADVISOR_RATE_LIMIT_PER_DAY=500
```

**Anthropic API キーの取得**:
1. https://console.anthropic.com にアクセス
2. アカウント作成 (既にあれば不要)
3. API Keys メニューから新しいキーを発行
4. ⚠️ キーは1度しか表示されないのでコピーを忘れずに

### 1.2 ステージング・本番 (Vercel ダッシュボード)

⚠️ **CLAUDE.md ルールにより、Claude Code は Vercel の環境変数を CLI で操作できません。ユーザーが手動で設定してください。**

Vercel ダッシュボード → Settings → Environment Variables で:

```
ANTHROPIC_API_KEY               (Production + Preview)
GITHUB_TOKEN_FOR_ADVISOR        (Production + Preview)
ADVISOR_GITHUB_OWNER            (Production + Preview)
ADVISOR_GITHUB_REPO             (Production + Preview)
ADVISOR_CRON_SECRET             (Production + Preview)

# 任意 (機能拡張用)
VERCEL_API_TOKEN                (Production + Preview) — Vercel ログ取得用
SUPABASE_MANAGEMENT_TOKEN       (Production + Preview) — Supabase ログ取得用

# 上限設定 (任意)
ADVISOR_DAILY_TOKEN_CAP         (Production)
ADVISOR_RATE_LIMIT_PER_HOUR     (Production)
ADVISOR_RATE_LIMIT_PER_DAY      (Production)
```

設定後、**Redeploy が必要**です。

---

## Step 2: ローカルDBへのスキーマ反映

### 2.1 ローカル Docker DB の起動確認

```bash
docker-compose up -d
docker ps  # postgres コンテナが起動中か確認
```

### 2.2 シェル環境変数の確認

```bash
echo $DATABASE_URL
echo $DIRECT_URL
```

→ 何か表示されたら、本番/ステージングの URL に上書きされている可能性。クリアしてから作業:

```bash
unset DATABASE_URL DIRECT_URL
```

### 2.3 Prisma スキーマの反映

```bash
# スキーマ確認
git diff prisma/schema.prisma

# 新しいテーブル定義が追加されていることを確認 (Advisor* テーブル)

# ローカルDBへ反映 (Claude Code が schema.prisma を更新済み)
npx prisma db push
npx prisma generate
```

### 2.4 反映確認

```bash
npx prisma studio
```

Prisma Studio (`http://localhost:5555`) で以下のテーブルが追加されていることを確認:
- `advisor_chat_sessions`
- `advisor_chat_messages`
- `advisor_audit_logs`
- `advisor_knowledge_cache`
- `advisor_knowledge_sync_logs`
- `advisor_usage_daily`

---

## Step 3: ローカルでのビルド・起動・動作確認

### 3.1 依存パッケージのインストール

```bash
npm install
```

→ `@anthropic-ai/sdk`, `clsx`, `tailwind-merge`, `@radix-ui/*` が新規追加されていることを確認

### 3.2 ビルド確認

```bash
rm -rf .next
npm run build
```

→ TypeScript エラーがないこと。

### 3.3 開発サーバー起動

```bash
npm run dev
```

### 3.4 動作確認シナリオ

#### 3.4.1 認証ガード確認

1. ブラウザで `http://localhost:3000/system-admin/advisor` にアクセス
2. **未ログイン状態**: `/system-admin/login` にリダイレクトされる、または 401 表示

#### 3.4.2 通常ログイン

1. `/system-admin/login` でログイン (admin@tastas.jp など)
2. `/system-admin/advisor` に再アクセス → チャットUIが表示される

#### 3.4.3 基本動作テスト (10項目)

各項目で正しく応答することを確認:

| # | 質問例 | 期待される応答 |
|---|-------|------------|
| 1 | こんにちは | 軽い挨拶 + 何ができるかの簡潔な説明 |
| 2 | TASTASってどんなサービス? | プロジェクトの説明 (CLAUDE.md由来) |
| 3 | プロジェクトの主要なディレクトリ構成は? | `read_doc` または `list_directory` でルート構成を表示 |
| 4 | 求人テーブルはどんなカラム? | `describe_db_table` で Job テーブル構造を表示 |
| 5 | 現在アクティブな求人は何件? | `get_jobs_summary` でカウント表示 |
| 6 | 利用可能な指標を教えて | `list_available_metrics` で一覧表示 |
| 7 | 先週のLP1のPV数は? | `query_metric` で `LP_PV` を取得して表示 |
| 8 | LINE登録数を見たい | 「未実装のため取得できません」+ 理由・代替案 |
| 9 | CLAUDE.mdの内容は? | `read_doc(claude_md)` で表示 |
| 10 | 最近のコミットは? | `get_recent_commits` で表示 |

#### 3.4.4 ストリーミング確認

質問送信後、テキストが**徐々に流れる**ことを確認 (一気に表示されない)。

#### 3.4.5 ツール実行の透明性確認

質問の途中で「ツールを実行中: query_metric」のような表示が出ること。

#### 3.4.6 セッション機能確認

- 新規セッション作成
- セッション一覧から過去のセッションを開く
- セッション削除
- 各操作で UI が正しく更新される

---

## Step 4: ステージング/本番展開判断

ローカルで全動作確認が済んだら、以下を判断:

### 4.1 ステージングへ展開する場合

```bash
# ブランチを develop に PR 作成 (Claude Code に依頼)
# Claude Code の指示通り PR URL を取得
# ユーザーが PR をマージ → 自動デプロイ
```

### 4.2 ステージング DB へのスキーマ反映 (必須)

Vercel デプロイの前か後 (作業ウィンドウに合わせる) に:

```bash
# ⚠️ Claude Code は実行禁止。ユーザーが手動で実行
# .env を一時的にステージング用に切り替えて実行

# 例: ステージング DB の DATABASE_URL を持っている場合
export DATABASE_URL="postgres://user:pass@stg-db..."
export DIRECT_URL="postgres://user:pass@stg-db..."
npx prisma db push

# 完了後は環境変数をクリア
unset DATABASE_URL DIRECT_URL
```

または、 Supabase ダッシュボードから SQL を直接実行する方法もある (Prisma が出力した SQL を確認してから)。

### 4.3 ステージング動作確認

`https://stg-share-worker.vercel.app/system-admin/advisor` で同じ動作確認シナリオ (Step 3.4) を実施。

### 4.4 本番展開判断

ステージング動作確認 OK の場合のみ本番展開を判断する。

本番展開時は:
1. 本番 DB へのスキーマ反映 (上記同様、ユーザー作業)
2. 本番 Vercel 環境変数の設定 (手動)
3. develop → main の PR 作成・マージ

---

## Step 5: legacy フォルダの最終削除

ステージングまたは本番で動作確認が完了し、不要だと確信できたら:

```bash
# git status で未コミットの作業がないことを確認
git status

# legacy フォルダを削除
rm -rf _legacy_agent-hub

# .gitignore から `_legacy_agent-hub` の記載を削除 (もしあれば)

# コミット
git add -A
git commit -m "リファクタリング: System Advisor 移行完了に伴い _legacy_agent-hub を削除"

# develop へ push (PR 経由)
```

⚠️ 削除前のチェック:
- [ ] `npm run build` が成功する
- [ ] `/system-admin/advisor` が動作する
- [ ] `src/components/advisor/`, `src/lib/advisor/`, `src/components/ui/shadcn/` に必要なファイルが揃っている

---

## Step 6: GitHub Personal Access Token の発行手順

### 6.1 Token 発行

1. https://github.com/settings/tokens に アクセス
2. 「Generate new token」→「Generate new token (classic)」を選択
3. 名前: `tastas-system-advisor`
4. Expiration: 90 days (推奨、定期更新)
5. Scopes: **`repo` の `public_repo` のみチェック** (private repo の場合は `repo` 全体)
6. 「Generate token」
7. ⚠️ 表示された token をコピー (1度しか表示されない)

### 6.2 環境変数への設定

Step 1.1 と Step 1.2 の `GITHUB_TOKEN_FOR_ADVISOR` に貼り付ける。

### 6.3 動作確認

`scripts/test-advisor-knowledge-sync.ts` (Phase 2 で作成予定) を実行:

```bash
tsx scripts/test-advisor-knowledge-sync.ts
```

→ CLAUDE.md, docs などが GitHub から取得できれば成功。

### 6.4 トークンの定期更新

90日後 (Token 失効前) に再発行 → 環境変数を更新 → Redeploy。
失効するとAdvisor の知識同期が止まり、古い情報で動作する。

---

## Step 7: 起動確認とトラブルシューティング

### 7.1 よくある問題

#### 「Anthropic API key not found」エラー
→ `ANTHROPIC_API_KEY` 環境変数が読まれていない。シェル変数のクリア後に再起動:
```bash
unset DATABASE_URL DIRECT_URL ANTHROPIC_API_KEY
npm run dev
```

#### 「knowledge cache is empty」エラー
→ 初回起動時、知識同期が走っていない。手動で同期:
```bash
curl -X POST http://localhost:3000/api/cron/advisor-knowledge-sync \
  -H "Authorization: Bearer ${ADVISOR_CRON_SECRET}"
```

#### CSS が崩れる
→ Tailwind キャッシュクリア:
```bash
rm -rf .next && npm run dev
```

#### 「rate limit exceeded」が出る
→ 1時間待つか、`.env.local` で `ADVISOR_RATE_LIMIT_PER_HOUR=999` に一時変更してテスト。

#### ストリーミングが流れない
→ Vercel/Next.js の SSE 設定。`route.ts` で `runtime = 'nodejs'` (Edge ではなく Node) になっていることを確認。

### 7.2 デバッグのヒント

- 監査ログを Prisma Studio で確認: `advisor_audit_logs` テーブル
- セッションを Prisma Studio で確認: `advisor_chat_sessions` / `advisor_chat_messages`
- ブラウザのデベロッパーツールで Network タブの SSE を確認
- サーバーログは `npm run dev` の出力を見る

---

## Step 8: 運用フェーズ

### 8.1 モニタリング項目

| 項目 | 確認方法 | 頻度 |
|------|--------|------|
| Anthropic API 使用量 | console.anthropic.com の Usage 画面 | 週次 |
| エラー発生数 | `advisor_audit_logs` で `event_type='error'` をカウント | 日次 |
| 知識同期失敗 | `advisor_knowledge_sync_logs` で `status!='success'` を確認 | 日次 |
| トークン使用量 | `advisor_usage_daily` を集計 | 月次 |

### 8.2 定期メンテナンス

- 90日ごと: GitHub PAT 更新
- 月次: 不要なセッションの archive 確認
- 半年ごと: コスト・利用傾向のレビュー

### 8.3 拡張時

新しいデータソース (Lstep / 自前ログ) を追加したい場合:
1. `docs/system-advisor/tools-spec.md` の「拡張手順」を参照
2. 該当ツールファイル + index.ts への登録の2ステップで追加可能
3. 1〜2日工数

---

## Step 9: 完了報告書テンプレート

すべての確認が終わったら、以下の形式で記録を残すと運用が楽:

```markdown
# System Advisor 導入完了報告

- 導入日: 2026-XX-XX
- 担当: kawashima
- 環境変数設定: ✅ 全て設定済み (本番/ステージング/ローカル)
- DB 反映: ✅ 全環境で完了
- 動作確認: ✅ 10項目すべてOK
- legacy 削除: ✅ 完了
- GitHub PAT 有効期限: 2026-XX-XX

## 既知の制約・残課題
- (例: LINE Webhook 未実装で LINE 関連メトリクスは取得不可)

## 次のステップ案
- (例: コスト監視ダッシュボードの実装)
```

---

## 困った時の連絡先

- 実装に関する質問: Claude Code (本AI) に質問
- Anthropic API の問題: console.anthropic.com のサポート
- Vercel デプロイの問題: Vercel ダッシュボード
- DB の問題: Supabase ダッシュボード
