# package-deps — npm 依存パッケージ

**作成**: 2026-05-04
**正本**: `extra-config/package.json` (TASTAS の package.json 全文コピー)
**目的**: hub-platform 側で Advisor 機能を再現するために必要な npm パッケージを特定する

---

## 1. 必須依存 (Advisor の中核機能)

| パッケージ | バージョン | 用途 |
|---|---|---|
| `@anthropic-ai/sdk` | `^0.85.0` | Anthropic Claude API (チャット本体) |
| `@google/genai` | `^1.51.0` | Gemini API (レポート生成 / バイパス) |
| `@prisma/client` | `5.22.0` | DB ORM |
| `prisma` (devDep) | `5.22.0` | Prisma CLI |
| `iron-session` | `^8.0.4` | Cookie ベース System Admin 認証 |
| `next` | `14.2.18` | Next.js (App Router) |
| `react` | `^18` | UI |
| `react-dom` | `^18` | UI |
| `react-markdown` | `^10.1.0` | Markdown レンダリング |
| `remark-gfm` | `^4.0.1` | GFM テーブル / 取り消し線 |
| `lucide-react` | `^0.554.0` | アイコン |
| `tailwindcss` | `^3.4.18` | スタイリング |

## 2. 周辺依存 (UI / 開発系)

| パッケージ | 用途 |
|---|---|
| `@radix-ui/react-scroll-area` | ScrollArea (Canvas / メッセージリスト) |
| `clsx` | className 結合 |
| `date-fns` | 日付フォーマット (使用箇所限定) |
| `typescript` | コンパイル |

## 3. インストールコマンド (ゼロから入れる場合)

```bash
# 中核
npm install @anthropic-ai/sdk @google/genai @prisma/client iron-session

# UI
npm install react-markdown remark-gfm lucide-react @radix-ui/react-scroll-area clsx

# Prisma CLI
npm install -D prisma
```

## 4. 注意点

- `@google/genai` は **2026-05 時点で v1.51.0** を使用。SDK 仕様変更で破壊的更新の可能性あり、要監視
- `@anthropic-ai/sdk` の `cache_control` API は v0.85+ で安定
- Next.js 14 (App Router) を前提とした設計。13 以下では Server Action / RSC が動かない
- React 18 を前提 (Suspense / use hook 等)

## 5. hub-platform 側で既に入っているもの

(hub-platform/package.json を参照)
- agent-hub が既に `@anthropic-ai/sdk` 等を使っている可能性あり → バージョン整合をチェック
- monorepo (Turborepo) なら共通依存に格上げ検討
