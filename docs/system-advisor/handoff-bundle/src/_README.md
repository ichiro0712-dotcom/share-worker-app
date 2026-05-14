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
