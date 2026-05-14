# [Antigravity 依頼 01] shadcn/ui コンポーネントのコピーと改修

## 目的

`_legacy_agent-hub/components/ui/` から System Advisor チャット画面で使用する shadcn/ui コンポーネントを TASTAS の `src/components/ui/shadcn/` にコピーし、TASTAS の構造に合わせて軽微な改修を行う。

## 背景

- TASTAS は既存の独自UIコンポーネント (`components/ui/`) を持っているが、shadcn ベースのコンポーネントを混ぜて使う必要がある (Advisor は legacy から流用するため)
- 命名衝突を避けるため `src/components/ui/shadcn/` というサブフォルダに配置する

## 作業手順

### Step 1: ディレクトリ作成

```bash
mkdir -p src/components/ui/shadcn
mkdir -p src/lib
```

### Step 2: ユーティリティファイル作成

`src/lib/cn.ts` を新規作成:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Step 3: 以下のファイルをコピー

各ファイルを `_legacy_agent-hub/components/ui/<file>` から `src/components/ui/shadcn/<file>` にコピーする:

- `button.tsx`
- `input.tsx`
- `textarea.tsx`
- `scroll-area.tsx`
- `dialog.tsx`
- `dropdown-menu.tsx`

**スキップするファイル**: `avatar.tsx`, `badge.tsx`, `label.tsx`, `separator.tsx`, `sheet.tsx`, `tabs.tsx` (Phase 1 では未使用)

### Step 4: 各ファイルの import パスを修正

コピーした各ファイル内の以下を全置換:

```typescript
// 変更前
import { cn } from "@/lib/utils"

// 変更後
import { cn } from "@/lib/cn"
```

### Step 5: package.json に依存追加

`package.json` の `dependencies` に以下を追加 (バージョンは最新安定版):

```json
{
  "dependencies": {
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0"
  }
}
```

### Step 6: npm install を実行

```bash
npm install
```

## 完了条件

- [ ] `src/components/ui/shadcn/` に 6ファイルが配置されている
- [ ] `src/lib/cn.ts` が存在する
- [ ] 各ファイル内の `import` が `@/lib/cn` を参照している
- [ ] `package.json` に新しい依存が追加されている
- [ ] `npm install` が成功する
- [ ] `npm run build` が TypeScript エラーなく完了する

## 作業完了後チェックリスト (必須)

### 1. ビルド確認
```bash
rm -rf .next && npm run build
```
TypeScriptエラー・モジュール解決エラーがないこと。

### 2. ファイル一覧の報告
作業で追加したファイル一覧を報告する。

### 3. 禁止事項の確認
- [ ] git push していない
- [ ] vercel deploy していない
- [ ] DB 操作 (prisma db push など) を実行していない
- [ ] 既存の `src/components/ui/` 配下のファイルを変更していない

## トラブルシューティング

### `cn` 関数が見つからないエラー
→ Step 4 の import パス置換が漏れている可能性。再確認。

### Radix UI の peer dep 警告
→ `npm install` で警告が出るが無視して良い。React 18 系で動作確認済み。
