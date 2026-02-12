# 無料LLM向け指示書: デザイン一括変更タスク

## 作業概要

+タスタスアプリケーションのデザインを統一するため、スタイルガイドに基づいたデザイン変更を行う。

**目的**: 現在の緑基調（#66cc99）のデザインを、ワーカー向け（PayPay風赤/青）と管理者向け（プロフェッショナル青/グレー/黒）に分離・変更する。

**参照すべきドキュメント**:
- `docs/style-guide-worker.md` - ワーカー向けスタイルガイド
- `docs/style-guide-admin.md` - 管理者向けスタイルガイド

---

## Phase 1: 基盤設定の変更

### タスク 1.1: Tailwind設定の更新

**ファイル**: `tailwind.config.ts`

**変更内容**:
```typescript
import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ワーカー向けカラー（デフォルト）
        primary: {
          DEFAULT: "#FF3333",
          dark: "#E62E2E",
          light: "#FFE5E5",
        },
        secondary: {
          DEFAULT: "#3895FF",
          dark: "#2D7AD9",
          light: "#E5F2FF",
        },
        // 管理者向けカラー
        admin: {
          primary: "#2563EB",
          "primary-dark": "#1D4ED8",
          "primary-light": "#DBEAFE",
          sidebar: "#111827",
        },
        // 共通
        background: "#F7F7F7",
        surface: "#FFFFFF",
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
        'tag': '6px',
        'badge': '20px',
        'admin-card': '8px',
        'admin-button': '6px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.12)',
        'primary': '0 2px 8px rgba(255, 51, 51, 0.3)',
        'secondary': '0 2px 8px rgba(56, 149, 255, 0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**確認方法**: `npm run build` でエラーがないこと

---

## Phase 2: ワーカー向けページの変更

### タスク 2.1: Buttonコンポーネントの更新

**ファイル**: `components/ui/Button.tsx`

**変更内容**:
```typescript
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'rounded-button font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-primary hover:bg-primary-dark text-white shadow-primary',
    secondary: 'bg-secondary hover:bg-secondary-dark text-white shadow-secondary',
    outline: 'border-[1.5px] border-primary text-primary hover:bg-primary-light bg-white',
    ghost: 'text-gray-600 hover:bg-gray-100'
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
```

### タスク 2.2: JobCardコンポーネントの更新

**ファイル**: `components/job/JobCard.tsx`

**変更箇所**:
1. カード背景: `bg-white` → `bg-surface`
2. カード角丸: `rounded-lg` → `rounded-card`
3. シャドウ追加: `shadow-card hover:shadow-card-hover`
4. 時給表示の色: `text-primary` → `text-primary` (赤に変わる)
5. ホバー時のトランジション: `transition-all hover:-translate-y-0.5`

**具体的な変更例**:
```tsx
// 変更前
<div className="bg-white rounded-lg p-4 border border-gray-100">

// 変更後
<div className="bg-surface rounded-card p-4 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5">
```

### タスク 2.3: JobListClientの背景色変更

**ファイル**: `components/job/JobListClient.tsx`

**変更箇所**:
1. ページ背景: `bg-white` → `bg-background`
2. 検索バー: ボーダーを `border-gray-200` → `border-gray-300` + `rounded-button`
3. フィルターボタン: `rounded-lg` → `rounded-button`

### タスク 2.4: BottomNavの更新

**ファイル**: `components/layout/BottomNav.tsx`

**変更箇所**:
1. アクティブアイコン色: `text-primary` (赤に変わる)
2. ボーダー: `border-t border-gray-200`

### タスク 2.5: 求人詳細ページ

**ファイル**: `app/jobs/[id]/page.tsx` および関連コンポーネント

**変更箇所**:
1. 応募ボタン: `bg-primary` → そのまま（赤に変わる）
2. 背景: `bg-white` → `bg-background`
3. カード: `rounded-lg` → `rounded-card`

---

## Phase 3: 管理者向けページの変更

### タスク 3.1: AdminLayoutの更新

**ファイル**: `components/admin/AdminLayout.tsx` または該当するレイアウト

**変更箇所（サイドバー）**:
```tsx
// サイドバー背景
<aside className="w-60 bg-admin-sidebar text-gray-400">

// メニューアイテム
<a className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-admin-button text-gray-400 hover:text-white hover:bg-white/5">

// アクティブアイテム
<a className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-admin-button text-blue-400 bg-blue-500/20">
```

### タスク 3.2: 管理者用ボタンスタイル

**ファイル**: `app/admin/jobs/page.tsx`

**変更箇所**:
```tsx
// 求人作成ボタン（青）
<button className="flex items-center gap-2 px-4 py-2 text-sm bg-admin-primary text-white rounded-admin-button hover:bg-admin-primary-dark">

// 公開するボタン（緑）
<button className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-admin-button hover:bg-green-700">

// 停止するボタン（グレー）
<button className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-admin-button hover:bg-gray-700">

// 削除ボタン（赤）
<button className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-admin-button hover:bg-red-700">

// テンプレート管理ボタン（アウトライン）
<button className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-admin-button hover:bg-gray-50">
```

### タスク 3.3: 管理者用カードスタイル

**ファイル**: `app/admin/jobs/page.tsx`

**変更箇所（求人カード）**:
```tsx
// 変更前
<div className="bg-white rounded border border-gray-200 hover:border-blue-400 hover:shadow-sm">

// 変更後
<div className="bg-white rounded-admin-card border border-gray-200 hover:border-admin-primary hover:shadow-md transition-all">
```

### タスク 3.4: ステータスバッジの更新

**変更箇所**:
```tsx
const statusConfig = {
  recruiting: { label: '公開中', color: 'bg-green-100 text-green-700', activeColor: 'bg-green-600 text-white' },
  paused: { label: '停止中', color: 'bg-gray-100 text-gray-600', activeColor: 'bg-gray-600 text-white' },
  working: { label: '勤務中', color: 'bg-blue-100 text-blue-700', activeColor: 'bg-blue-600 text-white' },
  review: { label: '評価待ち', color: 'bg-amber-100 text-amber-700', activeColor: 'bg-amber-600 text-white' },
  completed: { label: '完了', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-gray-500 text-white' },
  failed: { label: '不成立', color: 'bg-red-100 text-red-700', activeColor: 'bg-red-600 text-white' },
};
```

### タスク 3.5: ヘッダーの更新

**変更箇所**:
```tsx
// ヘッダー
<div className="bg-white border-b border-gray-200 px-6 py-4">
  <h1 className="text-xl font-bold text-gray-900">求人管理</h1>
</div>
```

---

## Phase 4: 共通コンポーネントの確認

### タスク 4.1: badge.tsx の確認

**ファイル**: `components/ui/badge.tsx`

管理者・ワーカー両方で使用されるため、汎用的に維持。色はpropsで制御。

### タスク 4.2: LoadingSpinner の更新

**ファイル**: `components/ui/LoadingSpinner.tsx`

**変更箇所**:
- ワーカー側: `border-primary` (赤)
- 管理者側: `border-admin-primary` (青)

**実装例**:
```tsx
interface LoadingSpinnerProps {
  variant?: 'worker' | 'admin';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ variant = 'worker' }) => {
  const color = variant === 'admin' ? 'border-admin-primary' : 'border-primary';
  return (
    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${color}`}></div>
  );
};
```

---

## 確認手順

### ステップ1: ビルド確認
```bash
npm run build
```
エラーがないことを確認

### ステップ2: 開発サーバーで確認
```bash
npm run dev
```

### ステップ3: 以下のページを目視確認

**ワーカー向け**:
- http://localhost:3000/ （求人一覧）
- http://localhost:3000/jobs/1 （求人詳細 - IDは適当に存在するもの）
- http://localhost:3000/mypage （マイページ）

**確認ポイント**:
- [ ] プライマリボタンが赤色になっている
- [ ] 背景がライトグレー（#F7F7F7）になっている
- [ ] カードの角丸が大きくなっている（16px）
- [ ] カードにシャドウがついている
- [ ] フッターナビのアクティブアイコンが赤

**管理者向け**:
- http://localhost:3000/admin/jobs （求人一覧）
- http://localhost:3000/admin （ダッシュボード）

**確認ポイント**:
- [ ] サイドバーがダークネイビーになっている
- [ ] 求人作成ボタンが青色になっている
- [ ] ステータスフィルターボタンが適切な色になっている
- [ ] カードホバー時に青いボーダーになる

---

## 注意事項

1. **グローバルCSSの確認**: `app/globals.css` に直接色指定がある場合は、Tailwind変数に置き換える

2. **ハードコードされた色**: `#66cc99` や `rgb(102, 204, 153)` などのハードコードを検索して置き換える
   ```bash
   grep -r "#66cc99" --include="*.tsx" --include="*.ts" --include="*.css"
   grep -r "66cc99" --include="*.tsx" --include="*.ts" --include="*.css"
   ```

3. **型エラーの確認**: 新しいvariantを追加した場合は、型定義も更新する

4. **テストページでの確認**: 各ページで実際に操作してスタイルが崩れていないか確認

---

## 完了条件

- [ ] `npm run build` がエラーなく完了する
- [ ] ワーカー向けページが赤/青基調のPayPay風デザインになっている
- [ ] 管理者向けページが青/グレー/ダーク基調のプロフェッショナルデザインになっている
- [ ] 両者のデザインが明確に区別されている
- [ ] 既存機能（応募、フィルター、ナビゲーション等）が正常に動作する

---

## 追加メモ

- 作業中に疑問があれば、該当するスタイルガイド（`docs/style-guide-worker.md` または `docs/style-guide-admin.md`）を参照
- 大きな構造変更は避け、色・角丸・シャドウなどのスタイル変更に集中する
- 作業後は必ず `npm run build` で型チェックとビルドを確認
