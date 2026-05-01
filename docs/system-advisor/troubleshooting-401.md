# [相談用] Advisor で Anthropic API 401 invalid x-api-key が出る

## 1. 状況

TASTAS (Next.js 14 / TypeScript) に「System Advisor」というチャットボットを実装した。
ローカル開発環境でユーザーがチャット送信すると、サーバー側で以下のエラーが発生:

```
401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CaaTwvu9MdynZpWkqcK89"}
```

UI には「Anthropic 応答中にエラー: 401 invalid x-api-key」と表示される。

## 2. 試したこと・確認した事実

### 2-1. API キーの設定状況

- `.env.local` に `ANTHROPIC_API_KEY=sk-ant-api03-...` を設定済み
- キーは `sk-ant-api03-` プレフィックスで始まっており、Anthropic 標準の形式
- 数日前 (5月1日のこのプロジェクト開始時) に Anthropic Console で発行したばかり

### 2-2. Anthropic SDK の使い方

Next.js の API Route (Node.js runtime) から Anthropic SDK を呼んでいる。

```typescript
// src/lib/advisor/claude.ts
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;
export function getClaudeClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
```

呼び出し:
```typescript
const stream = client.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: systemMessage,    // [{ type: 'text', text: '...', cache_control: { type: 'ephemeral' } }]
  tools: [...18 tools],
  messages,
});
```

### 2-3. 環境

- Node.js 開発サーバー (next dev)
- `@anthropic-ai/sdk@^0.85.0` 使用
- 環境変数は `.env.local` 経由 (Next.js が自動読み込み)
- `dev` 起動前に `unset DATABASE_URL DIRECT_URL` を実施

### 2-4. 既に確認済みのこと

- ✅ `.env.local` に key が記載されている
- ✅ プレフィックスが `sk-ant-api03-` で始まる正しい形式
- ✅ シェル環境変数で `ANTHROPIC_API_KEY` が上書きされていない (`echo $ANTHROPIC_API_KEY` で空)
- ✅ 同じキーで初回知識同期 (GitHub API) は別物 → これは GitHub PAT で動いた
- ✅ サーバーログには `ANTHROPIC_API_KEY is not set` エラーは出ていない (= 環境変数は読めている)

## 3. 仮説

| # | 仮説 | 可能性 |
|---|------|------|
| A | API キーが Anthropic Console 側で revoke された / 期限切れ | **高い** |
| B | クレジット (残高) が 0 になっている | **中** |
| C | キーをコピペした際に末尾改行・スペース等が混入した | 中 |
| D | Anthropic Console で Workspace 制限がかかっている | 低 |
| E | SDK が新しいキー形式 `sk-ant-api03-` をうまく扱えない | 極めて低 |
| F | `cache_control` 設定が不正でリクエスト全体が拒否される | 低 (普通は別エラーコード) |

## 4. 質問

このエラーで考えられる原因と、優先順位の高い確認手順を教えてください。

特に:
1. `invalid x-api-key` は **キー自体の問題** で確定?それとも **送信時のヘッダー組み立てミス** の可能性もある?
2. `Anthropic SDK` で `apiKey` を渡したときの実際のヘッダー名は `x-api-key`?
3. キー発行直後に `revoke` が起こる典型ケースはあるか?
4. 再発行する以外に確認すべき項目は?

## 5. 再現手順

1. ブラウザで `http://localhost:3000/system-admin/login` にログイン (System Admin)
2. `/system-admin/advisor` を開く
3. 「こんにちは」など適当に送信
4. UI 上に「エラーが発生しました。もう一度お試しください。」+ コードブロックで上記 401 メッセージが表示

## 6. 関連コード片

### システムプロンプト (cache_control 付き)
```typescript
return [
  { type: 'text', text: staticPart, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: dynamicPart },
]
```

### ツール定義 (18個、Function calling)
ツール一覧は省略するが、各ツールが `{ name, description, input_schema }` の標準形式。

## 7. 求めるアウトプット

- 401 が出る最も可能性の高い原因
- 即座に試すべき確認コマンド (curl で直接 Anthropic API を叩いてキー有効性を確認する方法など)
- 問題切り分けのチェックリスト

## 8. 追加検証 (2025-12-17 補足)

curl で直接 Anthropic API を叩いて検証した:

```bash
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":50,"messages":[{"role":"user","content":"hi"}]}'
```

**結果**: HTTP 401, body は同一エラー。
```
{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CaaUEeY81NSctRywnFneD"}
```

→ **アプリ実装の問題ではなく、API キー自体が Anthropic 側で無効** であることが確定。

### キーの形状確認

- 全長: 108 文字 (Anthropic 標準は 90〜110 文字程度なので妥当)
- プレフィックス: `sk-ant-api03-` 正しい
- 末尾 8 文字: `...mv_29AAA` (改行・スペースは含まれない)

## 9. 結論と推奨アクション

### 結論
キーは正しい形式だが Anthropic API 側で「無効」と判定される状態。
アプリのコード/設定には問題なし。

### 推奨アクション (優先順)

1. **新しい API キーを発行し直す** (最優先)
   - https://console.anthropic.com/settings/keys
   - 既存キーを Revoke → 新規 Create
   - `.env.local` を上書き
   - dev サーバー再起動

2. **クレジット残高確認**
   - https://console.anthropic.com/settings/billing
   - $0 なら最低 $5 チャージ

3. **Workspace 確認**
   - 複数 Workspace を使い分けている場合、キーが想定と違う Workspace で発行されている可能性
   - 「Default」Workspace で発行されていることを確認

4. **キー発行履歴の確認**
   - 同じプロジェクト名で複数キーが乱立していないか
   - 古いキーを誤って `.env.local` に貼っていないか

