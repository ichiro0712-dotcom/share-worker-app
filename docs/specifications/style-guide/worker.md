# +タスタス ワーカー向けスタイルガイド

> **最終更新**: 2025-12-04
> **デザインコンセプト**: PayPay風のモダンで親しみやすいデザイン

---

## 1. カラーパレット

### プライマリーカラー
```
赤（アクセント/CTA）
  - primary: #FF3333 (PayPayレッド)
  - primary-dark: #E62E2E
  - primary-light: #FFE5E5

青（情報/リンク）
  - secondary: #3895FF (PayPayブルー)
  - secondary-dark: #2D7AD9
  - secondary-light: #E5F2FF
```

### ニュートラルカラー
```
背景
  - background: #F7F7F7 (ページ背景)
  - surface: #FFFFFF (カード背景)

テキスト
  - text-primary: #1A1A1A (見出し、本文)
  - text-secondary: #666666 (サブテキスト)
  - text-muted: #999999 (補足テキスト)

ボーダー
  - border: #E5E5E5
  - border-light: #F0F0F0
```

### セマンティックカラー
```
ステータス
  - success: #34C759 (成功)
  - warning: #FF9500 (警告)
  - error: #FF3B30 (エラー)
  - info: #007AFF (情報)
```

---

## 2. タイポグラフィ

### フォント設定
```css
font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
```

### フォントサイズ
```
見出し
  - h1: 24px / font-bold / line-height: 1.4
  - h2: 20px / font-bold / line-height: 1.4
  - h3: 18px / font-semibold / line-height: 1.5
  - h4: 16px / font-semibold / line-height: 1.5

本文
  - body-lg: 16px / font-normal / line-height: 1.6
  - body: 14px / font-normal / line-height: 1.6
  - body-sm: 12px / font-normal / line-height: 1.5

キャプション
  - caption: 11px / font-normal / line-height: 1.4
```

---

## 3. スペーシング

### 基本単位: 4px
```
spacing-1: 4px
spacing-2: 8px
spacing-3: 12px
spacing-4: 16px
spacing-5: 20px
spacing-6: 24px
spacing-8: 32px
spacing-10: 40px
```

### コンポーネント間隔
```
カード間: 12px
セクション間: 24px
ページパディング: 16px (モバイル) / 24px (タブレット以上)
```

---

## 4. コンポーネントスタイル

### ボタン

#### プライマリボタン（CTA）
```css
/* 応募ボタン等、主要なアクション */
background: #FF3333;
color: white;
border-radius: 12px;
padding: 16px 24px;
font-size: 16px;
font-weight: 600;
box-shadow: 0 2px 8px rgba(255, 51, 51, 0.3);

/* hover */
background: #E62E2E;

/* disabled */
opacity: 0.5;
cursor: not-allowed;
```

#### セカンダリボタン
```css
/* お気に入り、ブックマーク等 */
background: white;
color: #FF3333;
border: 1.5px solid #FF3333;
border-radius: 12px;
padding: 14px 24px;

/* hover */
background: #FFE5E5;
```

#### ゴーストボタン
```css
/* フィルター、サブアクション */
background: transparent;
color: #1A1A1A;
border: 1px solid #E5E5E5;
border-radius: 8px;
padding: 10px 16px;

/* hover */
background: #F7F7F7;
```

#### テキストボタン
```css
background: transparent;
color: #3895FF;
padding: 8px;

/* hover */
text-decoration: underline;
```

### カード

#### 求人カード
```css
background: white;
border-radius: 16px;
padding: 16px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

/* hover（タップ可能時）*/
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
transform: translateY(-2px);
transition: all 0.2s ease;
```

#### 情報カード
```css
background: #F7F7F7;
border-radius: 12px;
padding: 16px;
```

### 入力フィールド

#### テキスト入力
```css
background: white;
border: 1.5px solid #E5E5E5;
border-radius: 12px;
padding: 14px 16px;
font-size: 16px;

/* focus */
border-color: #3895FF;
box-shadow: 0 0 0 3px rgba(56, 149, 255, 0.15);
outline: none;

/* error */
border-color: #FF3B30;
```

#### セレクトボックス
```css
/* 同上 + 右側にシェブロンアイコン */
padding-right: 40px;
```

### タグ/バッジ

#### ステータスバッジ
```css
/* 募集中 */
background: #E5F2FF;
color: #3895FF;
border-radius: 20px;
padding: 4px 12px;
font-size: 12px;
font-weight: 500;

/* 締切間近 */
background: #FFE5E5;
color: #FF3333;

/* 完了 */
background: #F0F0F0;
color: #666666;
```

#### 特徴タグ
```css
background: #F7F7F7;
color: #1A1A1A;
border-radius: 6px;
padding: 6px 10px;
font-size: 12px;
```

### ナビゲーション

#### フッターナビ
```css
background: white;
border-top: 1px solid #E5E5E5;
padding: 8px 0 env(safe-area-inset-bottom);
height: 64px;

/* アイコン */
width: 24px;
height: 24px;
color: #999999;

/* アクティブ */
color: #FF3333;

/* ラベル */
font-size: 10px;
margin-top: 4px;
```

#### ヘッダー
```css
background: white;
border-bottom: 1px solid #E5E5E5;
padding: 12px 16px;
height: 56px;
```

---

## 5. アイコン

### サイズ
```
xs: 16px (インライン、タグ内)
sm: 20px (リスト項目)
md: 24px (ナビゲーション)
lg: 32px (空状態、強調)
xl: 48px (大きな空状態)
```

### 使用アイコンセット
Lucide React を継続使用

---

## 6. シャドウ

```css
/* カード、浮遊要素 */
shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
shadow-md: 0 4px 12px rgba(0, 0, 0, 0.12);
shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.16);

/* ボタン */
shadow-primary: 0 2px 8px rgba(255, 51, 51, 0.3);
shadow-secondary: 0 2px 8px rgba(56, 149, 255, 0.3);
```

---

## 7. アニメーション

### トランジション
```css
/* デフォルト */
transition: all 0.2s ease;

/* ゆっくり */
transition: all 0.3s ease;
```

### ホバー効果
```css
/* カード */
transform: translateY(-2px);

/* ボタン */
transform: scale(0.98);
```

---

## 8. レスポンシブ対応

### ブレークポイント
```
sm: 640px
md: 768px
lg: 1024px
```

### モバイルファースト
- フッターナビ固定
- カード1列表示
- タッチターゲット最小44px

---

## 9. Tailwind設定（tailwind.config.ts更新案）

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
        // ワーカー向けカラー
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
        background: "#F7F7F7",
        surface: "#FFFFFF",
        border: "#E5E5E5",
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
        'tag': '6px',
        'badge': '20px',
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

---

## 10. 適用イメージ

### 変更前 vs 変更後

| 要素 | 現状 | 新デザイン |
|------|------|-----------|
| プライマリカラー | #66cc99（緑） | #FF3333（赤） |
| アクセントカラー | なし | #3895FF（青） |
| カード角丸 | 8px | 16px |
| ボタン角丸 | 8px | 12px |
| ページ背景 | 白 | #F7F7F7 |
| シャドウ | なし | 軽いシャドウ |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-04 | PayPay風デザインガイド作成 |
