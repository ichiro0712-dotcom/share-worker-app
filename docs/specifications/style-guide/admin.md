# +タスタス 管理者向けスタイルガイド

> **最終更新**: 2025-12-04
> **デザインコンセプト**: プロフェッショナルで視認性の高いダッシュボードデザイン

---

## 1. カラーパレット

### プライマリーカラー
```
青（主要アクション）
  - primary: #2563EB (ロイヤルブルー)
  - primary-dark: #1D4ED8
  - primary-light: #DBEAFE
  - primary-50: #EFF6FF
```

### セカンダリーカラー
```
グレー（ベース）
  - gray-900: #111827 (見出し)
  - gray-800: #1F2937 (本文)
  - gray-700: #374151 (サブテキスト)
  - gray-600: #4B5563
  - gray-500: #6B7280 (補足)
  - gray-400: #9CA3AF (プレースホルダー)
  - gray-300: #D1D5DB (ボーダー)
  - gray-200: #E5E7EB (分割線)
  - gray-100: #F3F4F6 (背景)
  - gray-50: #F9FAFB (カード背景)
```

### アクセントカラー
```
ステータス
  - success: #22C55E (緑 - 公開中、成功)
  - warning: #F59E0B (黄 - 警告)
  - error: #EF4444 (赤 - 停止、削除)
  - info: #3B82F6 (青 - 情報)
```

### ステータス別背景色
```
公開中:
  - bg: #DCFCE7, text: #166534
停止中:
  - bg: #F3F4F6, text: #374151
勤務中:
  - bg: #DBEAFE, text: #1E40AF
評価待ち:
  - bg: #FEF3C7, text: #92400E
完了:
  - bg: #F3F4F6, text: #4B5563
エラー/削除:
  - bg: #FEE2E2, text: #991B1B
```

---

## 2. タイポグラフィ

### フォント設定
```css
font-family: 'Inter', 'Hiragino Sans', 'Noto Sans JP', system-ui, sans-serif;
```

### フォントサイズ
```
見出し
  - h1: 20px / font-bold / line-height: 1.3
  - h2: 18px / font-semibold / line-height: 1.4
  - h3: 16px / font-semibold / line-height: 1.5
  - h4: 14px / font-medium / line-height: 1.5

本文
  - body: 14px / font-normal / line-height: 1.5
  - body-sm: 13px / font-normal / line-height: 1.5

キャプション
  - caption: 12px / font-normal / line-height: 1.4
  - tiny: 11px / font-normal / line-height: 1.3
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
```

### レイアウト
```
サイドバー幅: 240px
ヘッダー高さ: 64px
コンテンツパディング: 24px
カード間隔: 16px
```

---

## 4. コンポーネントスタイル

### ボタン

#### プライマリボタン
```css
/* 求人作成、公開等の主要アクション */
background: #2563EB;
color: white;
border-radius: 6px;
padding: 8px 16px;
font-size: 14px;
font-weight: 500;

/* hover */
background: #1D4ED8;

/* disabled */
opacity: 0.5;
cursor: not-allowed;
```

#### セカンダリボタン
```css
/* テンプレート管理等 */
background: white;
color: #374151;
border: 1px solid #D1D5DB;
border-radius: 6px;
padding: 8px 16px;

/* hover */
background: #F9FAFB;
border-color: #9CA3AF;
```

#### 成功ボタン（公開する）
```css
background: #22C55E;
color: white;
border-radius: 6px;

/* hover */
background: #16A34A;
```

#### 警告ボタン（停止する）
```css
background: #4B5563;
color: white;
border-radius: 6px;

/* hover */
background: #374151;
```

#### 危険ボタン（削除）
```css
background: #EF4444;
color: white;
border-radius: 6px;

/* hover */
background: #DC2626;
```

#### アイコンボタン
```css
background: transparent;
color: #6B7280;
padding: 8px;
border-radius: 6px;

/* hover */
background: #F3F4F6;
color: #374151;
```

### カード

#### リストカード（求人一覧）
```css
background: white;
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 12px 16px;

/* hover */
border-color: #3B82F6;
box-shadow: 0 1px 3px rgba(59, 130, 246, 0.1);
transition: all 0.15s ease;
```

#### 統計カード
```css
background: white;
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 20px;
```

### 入力フィールド

#### テキスト入力
```css
background: white;
border: 1px solid #D1D5DB;
border-radius: 6px;
padding: 8px 12px;
font-size: 14px;

/* focus */
border-color: #2563EB;
box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
outline: none;

/* error */
border-color: #EF4444;
```

#### セレクトボックス
```css
background: white;
border: 1px solid #D1D5DB;
border-radius: 6px;
padding: 8px 32px 8px 12px;
font-size: 14px;
```

### テーブル

```css
/* ヘッダー */
background: #F9FAFB;
border-bottom: 1px solid #E5E7EB;
padding: 12px 16px;
font-size: 12px;
font-weight: 500;
color: #6B7280;
text-transform: uppercase;
letter-spacing: 0.05em;

/* 行 */
border-bottom: 1px solid #E5E7EB;
padding: 12px 16px;

/* ホバー */
background: #F9FAFB;
```

### ナビゲーション

#### サイドバー
```css
background: #111827;
width: 240px;
padding: 16px 0;

/* メニュー項目 */
padding: 10px 16px;
color: #9CA3AF;
font-size: 14px;
border-radius: 6px;
margin: 2px 8px;

/* hover */
background: rgba(255, 255, 255, 0.05);
color: #F9FAFB;

/* active */
background: rgba(37, 99, 235, 0.2);
color: #60A5FA;
```

#### ヘッダー
```css
background: white;
border-bottom: 1px solid #E5E7EB;
padding: 0 24px;
height: 64px;
```

### タグ/バッジ

#### ステータスバッジ
```css
/* 公開中 */
background: #DCFCE7;
color: #166534;
border-radius: 4px;
padding: 2px 8px;
font-size: 12px;
font-weight: 500;

/* 停止中 */
background: #F3F4F6;
color: #374151;

/* 勤務中 */
background: #DBEAFE;
color: #1E40AF;

/* 評価待ち */
background: #FEF3C7;
color: #92400E;
```

#### カウントバッジ
```css
background: #EF4444;
color: white;
border-radius: 9999px;
min-width: 20px;
height: 20px;
font-size: 11px;
font-weight: 600;
```

### モーダル

```css
/* オーバーレイ */
background: rgba(0, 0, 0, 0.5);

/* コンテナ */
background: white;
border-radius: 12px;
max-width: 480px;
padding: 24px;
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

---

## 5. アイコン

### サイズ
```
xs: 14px
sm: 16px
md: 20px
lg: 24px
```

### カラー
```
デフォルト: #6B7280
アクティブ: #2563EB
ホバー: #374151
```

---

## 6. シャドウ

```css
/* 軽いシャドウ */
shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);

/* カード */
shadow-md: 0 1px 3px rgba(0, 0, 0, 0.1);

/* モーダル、ドロップダウン */
shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

/* 大きなモーダル */
shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

---

## 7. データ可視化

### グラフカラー
```
primary: #2563EB
secondary: #60A5FA
tertiary: #93C5FD

success: #22C55E
warning: #F59E0B
error: #EF4444
```

### プログレスバー
```css
/* 背景 */
background: #E5E7EB;
height: 8px;
border-radius: 4px;

/* 進捗 */
background: #2563EB;
border-radius: 4px;
```

---

## 8. レスポンシブ対応

### ブレークポイント
```
md: 768px
lg: 1024px
xl: 1280px
```

### レイアウト調整
- サイドバー: 1024px以下で折りたたみ
- テーブル: 768px以下でカード表示に切り替え

---

## 9. Tailwind設定（管理者用追加分）

```typescript
// tailwind.config.ts に追加
theme: {
  extend: {
    colors: {
      // 管理者向けカラー
      admin: {
        primary: "#2563EB",
        "primary-dark": "#1D4ED8",
        "primary-light": "#DBEAFE",
        sidebar: "#111827",
        "sidebar-hover": "rgba(255, 255, 255, 0.05)",
        "sidebar-active": "rgba(37, 99, 235, 0.2)",
      },
    },
    borderRadius: {
      'admin-card': '8px',
      'admin-button': '6px',
      'admin-badge': '4px',
    },
  },
}
```

---

## 10. 適用イメージ

### 変更前 vs 変更後

| 要素 | 現状 | 新デザイン |
|------|------|-----------|
| プライマリカラー | #66cc99（緑） | #2563EB（青） |
| サイドバー | ライトグレー | #111827（ダーク） |
| カード角丸 | 8px | 8px（維持） |
| ボーダー | 淡いグレー | #E5E7EB |
| ボタンスタイル | 緑ベース | 青/グレー/赤ベース |
| テキスト | #666666 | #374151 |

### サイドバーの変更
- **背景**: ダークネイビー (#111827)
- **テキスト**: ライトグレー (#9CA3AF)
- **アクティブ**: 青いハイライト (#60A5FA)
- **ホバー**: 微かな白い背景

### ヘッダーの変更
- **背景**: 白
- **ボーダー**: 下線のみ (#E5E7EB)
- **タイトル**: #111827
- **ボタン群**: 右寄せ、色分け（青/グレー/赤）

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-04 | 管理者向けデザインガイド作成 |
