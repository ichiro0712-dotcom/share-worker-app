# PROMPT_PATTERNS — プロンプト設計の教訓

**作成**: 2026-05-04
**目的**: TASTAS Advisor で **実際に効果のあったプロンプトテクニック**を記録。

---

## 1. ❌ 「例」として書いた架空指標を Gemini が信じる

### 事故例
プロンプト・schema コメント・型定義に「(例: ["LP_PV", "LP_TO_LINE_CONV"])」と複数箇所に書かれていた → Gemini が `LP_TO_LINE_CONV` を実在指標と誤認 → query_metric が「不明な metric_key」で弾く → 表が空に。

### 対策
- プロンプト・schema コメント・型定義の **「例」** には**実在するキーだけ**使う
- 命名がもっともらしいダミーは絶対に書かない (`LP_TO_LINE_CONV` のような未実装が紛れる温床)

### 教訓
LLM 向け「例」は **存在保証** が必要。

---

## 2. 「迷ったら更新する側に倒す」原則

### 事故例
revise で skeleton に流入経路の表を追加したのに dataSources に query_ga4 が追加されず、レポート生成で空表に。

### 真因
Gemini は「変更ないかも」と迷うと null (= 変更なし) を返しがち。

### 対策
プロンプトで明示:
- **「迷ったら更新する側に倒す」**
- **「null を返してよいのは文言修正のみのとき」**

### 教訓
LLM の「迷い」のデフォルト挙動を意図的に制御する。

---

## 3. 「✅ / ❌ 具体例併記」が効く

抽象的な禁止 (「自由に再構成してはいけない」) より、**「✅ こう書け / ❌ こう書くな」の具体例**を併記する方が遵守率が高い。

### 例: 表前置き散文の禁止

```markdown
❌ 例 (これを書かない):
## ワーカー TOP ページ PV 推移
今週のワーカー TOP ページの PV 数推移は以下の通りです。
| 日付 | PV |
...

✅ 正しい:
## ワーカー TOP ページ PV 推移

| 日付 | PV |
...
```

### 例: skeleton で固有名禁止

```markdown
❌ やってはいけない:
| 順位 | LP | PV |
| 1 | LP 5 (キラキラ介護転職 LP) | 0 |  ← 固有名禁止

✅ 正しい:
| 順位 | LP | PV |
| 1 | - | 0 |  ← プレースホルダ
```

---

## 4. JSON 出力の安定化 (5 段フォールバックパーサー)

Gemini Flash は `responseMimeType: 'application/json'` で構造化出力を強制できるが、稀に:
- ` ```json ... ``` ` でラップ
- 文字列内で生改行 (\n エスケープし忘れ)
- 末尾カンマ

### 5 段フォールバックパーサー
1. そのまま `JSON.parse`
2. fence (` ```json ` / ` ``` `) 抜き出し
3. 最初の `{` から最後の `}` までスライス
4. 文字列内生改行を `\n` にエスケープ (`repairJsonString`)
5. 末尾カンマ除去

### プロンプト側でも明示
- 「文字列値の中の改行は必ず `\n` にエスケープ」
- 「`"` は `\"` にエスケープ」
- 「末尾カンマ禁止」

実装: `src/lib/advisor/llm/gemini.ts` `parseJsonWithRepair`

---

## 5. ヘッダー型・章構成の固定強制は禁止

レポートは「主要 KPI 集計」「輪切り分析」「ad hoc 調査」「障害振り返り」など多様な用途で使う。
**「サマリ → 主要数値 → 次のアクション」の固定型を強制すると柔軟性を損なう**。

### 採用ルール
ユーザーが Canvas で作った skeleton をそのまま忠実に踏襲。

---

## 6. ユーザーが指定したデータソースは絶対尊重

### 事故例
ユーザー「**GTA から**取れる LP の PV ランキング」 → Gemini「LP_PV なら DB の query_metric で取れる」と判断 → query_metric を選択 (GA4 を使わず)。

### 対策
プロンプトに以下を明記:
> ユーザーが GA4 / GTA / アナリティクス / DB / Search Console / GitHub / Vercel / Supabase などを明示指定したら、その指定を絶対に尊重する。自動判断より明示指定を優先。

---

## 7. データソースラベルは UI と完全一致

英語キー (`query_metric` 等) は Gemini プロンプトでツール選択時のみ使い、ユーザーに見せる出典等は **日本語ラベル統一表** に従う:

| key | UI / 出典に使う日本語ラベル |
|---|---|
| query_metric | 本番 DB 指標集計 |
| query_ga4 | GA4 アクセス解析 |
| query_search_console | Search Console |
| get_jobs_summary | 求人サマリ |
| get_users_summary | ユーザーサマリ |
| get_recent_errors | エラーログ (DB) |
| get_supabase_logs | Supabase ログ |
| get_vercel_logs | Vercel ログ |
| get_vercel_deployments | Vercel デプロイ履歴 |
| get_recent_commits | GitHub コミット履歴 |

実装: `src/lib/advisor/tool-source-labels.ts`

---

## 8. 表直下の「集計期間 + 出典」注釈フォーマット

```
*集計期間: 2026-04-27 〜 2026-05-03 (JST) / 出典: 本番 DB 指標集計 (LP_PV / LP別)*
```

### ルール
- 表と注釈の間に **空行 1 行** (Markdown パーサーが「表の続き」と誤認しないため)
- `*italic*` で囲む (ReactMarkdown の `<em>` カスタムでグレー小フォント化)
- 期間表記:
  - 期間集計系 (本番 DB / GA4 / Search Console): `YYYY-MM-DD 〜 YYYY-MM-DD (JST)`
  - スナップショット系 (求人 / ユーザー サマリ): `現時点スナップショット (取得: YYYY-MM-DD HH:MM JST)`
  - 直近 N 時間系 (Supabase ログ): `直近 24 時間`
  - 直近 N 件系 (エラー / Vercel / コミット): `直近 N 件`

---

## 9. `<em>出典:>` のグレー化

ReactMarkdown の `<em>` カスタムレンダラで `出典:` で始まるテキストを判定して `text-[10px] text-slate-400 not-italic` に置き換える:

```tsx
em: ({ children }) => {
  const text = typeof children === 'string' ? children : ...
  if (text.startsWith('出典:') || text.startsWith('出典 :')) {
    return <em className="block text-[10px] text-slate-400 mt-1 mb-2 not-italic">{children}</em>
  }
  return <em>{children}</em>
}
```

---

## 10. プロンプトで使う表は GFM table 限定

セパレーター行は `|---|---|` のように **列数分の `---`** を必ず書く。
ヘッダ行とセパレーター行の `|` の数が不一致だと Markdown パーサーで表として認識されない。

---

## 関連ドキュメント

- [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)
- [ANTI_PATTERNS.md](./ANTI_PATTERNS.md)
- [BUG_FIX_PLAYBOOK.md](./BUG_FIX_PLAYBOOK.md)
