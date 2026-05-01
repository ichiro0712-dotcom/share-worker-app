# System Advisor (システムアドバイザー) 設計ドキュメント

TASTAS の System Admin 画面に組み込む LLM ベースのシステムアドバイザーチャットボットの設計一式です。

## 概要

- **位置づけ**: System Admin 内の常設メニュー (`/system-admin/advisor`)
- **目的**: 非エンジニア・企画担当者・システム責任者代理が、コードを触らずに以下を自然言語で質問・調査できるようにする
  - TASTAS のシステム構成・仕様
  - 本番DB の状態 (読み取り専用)
  - Vercel/Supabase のログ
  - GA4 の数値
  - 将来的に LINE / Lstep / 自前ログとも統合
- **思想**: 「コードを絶対にいじらないと約束した Claude Code」をブラウザ上で実現する
- **設計の核**: ツールはすべて読み取り専用 (write系を一切持たない)、プラグイン式で後から追加可能

## ドキュメント構成

| # | ファイル | 内容 |
|---|---------|------|
| 1 | [architecture.md](./architecture.md) | システム全体構成・モジュール分割・処理フロー |
| 2 | [data-model.md](./data-model.md) | Prisma スキーマ追加分・テーブル設計・インデックス |
| 3 | [tools-spec.md](./tools-spec.md) | ツール (function calling) の一覧・I/O 仕様・拡張方法 |
| 4 | [system-prompt.md](./system-prompt.md) | システムプロンプト設計・知識注入・prompt cache |
| 5 | [legacy-cleanup.md](./legacy-cleanup.md) | `_legacy_agent-hub` の不要ファイル削除リスト |
| 6 | [implementation-roadmap.md](./implementation-roadmap.md) | 実装フェーズ分け・各フェーズの完了条件 |
| 7 | [security-cost.md](./security-cost.md) | セキュリティ・監査ログ・コスト管理・レート制限 |
| 8 | [user-checklist.md](./user-checklist.md) | ユーザー (kawashima) が最後に行う確認・テスト手順 |
| 9 | [antigravity-tasks/](./antigravity-tasks/) | Antigravity (無料LLM) への作業依頼書群 |

## 設計の前提と制約

### 採用した設計方針

1. **A方式採用**: `_legacy_agent-hub/` から必要なものを `src/components/advisor/` 等にコピーし、TASTAS と完全統合する
2. **GitHub から知識同期**: CLAUDE.md / docs / Prisma schema は GitHub API + cron で定期同期 + セッション開始時にも最新化
3. **ローカル完結**: 開発はローカルで完了し、本人がレビューしてから push/deploy する。Claude Code は push/deploy しない
4. **Antigravity 活用**: 大量・単純な作業は依頼書を作成して委託する
5. **拡張性最優先**: Lstep API・自前別システムログも、ツール1ファイル追加 + registry 1行追加で対応可能な構造

### 技術スタック (TASTAS 既存スタックに準拠)

- Next.js 14 (App Router) / TypeScript / Tailwind CSS
- Prisma + PostgreSQL (ローカル Docker)
- Iron-session ベースの System Admin 認証 (`SYSTEM_ADMIN_SESSION_SECRET`)
- 新規依存追加: `@anthropic-ai/sdk` のみ (legacy で動作確認済み)

### 守るべき TASTAS のルール (CLAUDE.md より)

- 本番/ステージング DB に対する書き込み・破壊的操作 一切禁止
- Vercel 環境変数の CLI 操作 禁止
- `gh pr merge` 自己判断禁止、main への直接 push 禁止
- 日付/時刻処理は **JST 基準**で行う (`src/lib/actions/minimumWage.ts` のヘルパー使用)
- DB 操作は Server Actions 経由

### 認識合わせ: 同期問題への対応

複数の Claude Code / 開発者が main を更新する。本セッション開始時点の CLAUDE.md と main の最新は乖離している可能性がある。これは:

1. **Advisor 自体は GitHub から定期 pull するため自動で追従**する
2. ただし**本セッションでの実装中**は、現在のローカル CLAUDE.md を真実として進める
3. 実装後にユーザーが最新 CLAUDE.md と照合する (user-checklist.md 参照)

## 工数見積もり (legacy 流用後)

| Phase | 内容 | 工数 |
|-------|------|------|
| Phase 1 | DB スキーマ追加 | 0.5日 |
| Phase 2 | コア基盤 (auth, claude, github sync) | 2日 |
| Phase 3 | ツールレジストリ | 3日 |
| Phase 4 | API + ストリーミング | 1.5日 |
| Phase 5 | UI 実装 | 2日 |
| Phase 6 | 検証・チェックリスト | 1日 |
| **合計** | | **約10日** |

Antigravity に並列委託すれば実時間はさらに短縮可能。

## 用語

- **Advisor**: 本機能のチャットボット
- **System Admin**: TASTAS の管理画面 (`/system-admin/*`)、iron-session 認証
- **Tool**: Anthropic Tool Use (function calling) の関数。すべて読み取り専用
- **Knowledge Cache**: GitHub から同期したプロジェクト知識のローカルキャッシュ
- **Audit Log**: 「誰がいつ何を聞いたか・どのツールが呼ばれたか」の監査記録
