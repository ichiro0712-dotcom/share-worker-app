# vercel-config — Vercel 設定 (vercel.json) 解説

**作成**: 2026-05-04
**正本**: `extra-config/vercel.json`
**目的**: hub-platform 側で Advisor 関連の Vercel cron / function config を再現する

---

## 1. Cron 設定 (Advisor 関連)

| path | schedule (UTC) | 意味 (JST) | 用途 |
|---|---|---|---|
| `/api/cron/advisor-cleanup` | `0 19 * * *` | 毎日 04:00 JST | Draft / Versions / Audit / 失効 share_token 自動削除 |
| `/api/cron/advisor-knowledge-sync` | (vercel.json 未登録) | — | GitHub から CLAUDE.md / docs を同期 (手動 or 別運用) |

⚠️ `advisor-knowledge-sync` は vercel.json に未登録。
本番展開時に Hobby プラン (1 日 1 回まで) なら `0 0 * * *`、Pro なら `0 * * * *` を追加検討。

---

## 2. Function 設定

```json
{
  "functions": {
    "app/**/*": {
      "maxDuration": 60
    }
  }
}
```

→ 全 API Route の最大実行時間 60 秒。
レポート生成 (`/api/advisor/report/generate`) は 15-30 秒なので余裕あり。

ただし将来 Gemini が遅くなった場合は `maxDuration: 120` への引き上げを検討:
```json
{
  "functions": {
    "app/api/advisor/report/generate/route.ts": {
      "maxDuration": 120
    }
  }
}
```

---

## 3. Headers (Service Worker 関連、Advisor とは無関係)

vercel.json には Service Worker 用のヘッダー設定もあるが、Advisor とは無関係なので省略。
詳細は `extra-config/vercel.json` 参照。

---

## 4. hub-platform 側で必要な設定変更

| 変更 | 理由 |
|---|---|
| cron path を hub-platform 側のパスに変更 | apps/agent-hub などに Advisor が住む場合 |
| `ADVISOR_CRON_SECRET` を hub-platform 側 Vercel env に追加 | 認証用 |
| `GEMINI_API_KEY` を hub-platform 側 Vercel env に追加 | Gemini バイパス |

---

## 5. 関連ドキュメント

- [extra-config/vercel.json](./extra-config/vercel.json) — vercel.json 全文
- [env-vars.md](./env-vars.md) — 環境変数全リスト
- [src/app/api/cron/](./src/app/api/cron/) — cron 実装
