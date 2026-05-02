# Antigravity 委託タスク群

System Advisor 開発のうち、単純で大量のコピー・置換系作業を Antigravity (無料LLM) に委託するための依頼書群。

## タスク一覧

| # | ファイル | タイミング | 想定工数 |
|---|---------|-----------|---------|
| 01 | [01-shadcn-ui-copy.md](./01-shadcn-ui-copy.md) | Phase 5 開始時 | 30分 |
| 02 | [02-chat-ui-strip-ca.md](./02-chat-ui-strip-ca.md) | Phase 5 中 | 1時間 |
| 03 | [03-tool-stub-files.md](./03-tool-stub-files.md) | Phase 3 中 | 1時間 |

## 依頼方法

各依頼書を Antigravity に丸ごと渡し、指示通りに実行させる。
完了後、Claude Code (本AI) がレビューして TASTAS 用に最終調整する。

## 共通の前提

- TASTAS リポジトリの作業ディレクトリ: `/Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ`
- 作業ブランチ: `feature/system-advisor-chatbot`
- 各依頼書の末尾には、TASTAS の CLAUDE.md ルール (デプロイしない・push しない・ビルド確認等) のチェックリストが付いている
