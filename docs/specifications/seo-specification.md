# SEO仕様書

## 概要

+TASTASの検索エンジン最適化（SEO）に関する仕様を定義する。
主に公開求人ページのSEO対策と、Google for Jobs対応を含む。

---

## 1. 公開ページ構成

### 1.1 URL構造

| ページ | URL | 認証 |
|--------|-----|------|
| 公開求人詳細 | `/public/jobs/[id]` | 不要 |
| robots.txt | `/robots.txt` | 不要 |
| sitemap.xml | `/sitemap.xml` | 不要 |

### 1.2 公開条件

求人が公開ページに表示される条件：

1. `status` = `PUBLISHED`（公開中）
2. `job_type` = `NORMAL`（通常求人のみ）
3. 今日以降の勤務日が存在する
4. 募集開始日時を過ぎている
5. 表示期限内である

**除外される求人種別：**
- `LIMITED_WORKED`: 勤務経験者限定
- `LIMITED_FAVORITE`: お気に入り登録者限定
- `OFFER`: 指名オファー

---

## 2. メタタグ仕様

### 2.1 タイトルタグ

**フォーマット:**
```
【{職種}】{都道府県}{市区町村}の求人 | 時給{時給}円 | +TASTAS
```

**例:**
```html
<title>【介護福祉士】東京都新宿区の求人 | 時給1,500円 | +TASTAS</title>
```

**職種の決定ロジック:**
1. `required_qualifications` 配列の最初の要素を使用
2. 未設定の場合は「介護・看護スタッフ」をデフォルト値とする

### 2.2 Description

**フォーマット:**
```
{地域}で{職種}の求人募集中！時給{時給}円、{開始時間}〜{終了時間}勤務。
{施設名}での{資格要件}のお仕事です。単発・スポットバイトをお探しの方におすすめ。
```

**例:**
```html
<meta name="description" content="東京都新宿区で介護福祉士の求人募集中！時給1,500円、09:00〜18:00勤務。○○介護施設での介護福祉士・初任者研修のお仕事です。単発・スポットバイトをお探しの方におすすめ。">
```

### 2.3 Keywords

動的に生成されるキーワード：

```
{職種},{都道府県},{市区町村},求人,単発バイト,スポットワーク,介護,看護,{施設名}
```

### 2.4 その他のメタタグ

```html
<meta name="robots" content="index, follow">
<meta name="googlebot" content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1">
<meta name="author" content="+TASTAS">
<meta name="format-detection" content="telephone=no">
```

---

## 3. OGP (Open Graph Protocol)

### 3.1 基本設定

```html
<meta property="og:title" content="【介護福祉士】東京都新宿区の求人 | 時給1,500円 | +TASTAS">
<meta property="og:description" content="東京都新宿区で介護福祉士の求人募集中！...">
<meta property="og:type" content="website">
<meta property="og:url" content="https://share-worker-app.vercel.app/public/jobs/123">
<meta property="og:site_name" content="+TASTAS（タスタス）">
<meta property="og:locale" content="ja_JP">
```

### 3.2 画像設定

```html
<meta property="og:image" content="{求人画像URL または デフォルト画像}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{求人タイトル}">
```

**デフォルト画像:** `/images/og-default.png`

---

## 4. Twitterカード

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="【介護福祉士】東京都新宿区の求人 | 時給1,500円 | +TASTAS">
<meta name="twitter:description" content="東京都新宿区で介護福祉士の求人募集中！...">
<meta name="twitter:site" content="@tastas_jp">
```

---

## 5. Google for Jobs 構造化データ

### 5.1 概要

Google検索の求人検索機能に対応するため、JSON-LD形式の構造化データを埋め込む。

**スキーマ:** https://schema.org/JobPosting

### 5.2 JSON-LD構造

```json
{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "介護福祉士 日勤スタッフ",
  "description": "施設での介護業務全般...",
  "identifier": {
    "@type": "PropertyValue",
    "name": "+TASTAS",
    "value": "tastas-job-123"
  },
  "datePosted": "2026-01-10T00:00:00.000Z",
  "validThrough": "2026-01-31T00:00:00.000Z",
  "employmentType": "TEMPORARY",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "○○介護施設",
    "sameAs": "https://share-worker-app.vercel.app/public/facilities/1",
    "logo": "https://example.com/logo.png"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "新宿1-2-3",
      "addressLocality": "新宿区",
      "addressRegion": "東京都",
      "addressCountry": "JP"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 35.6895,
      "longitude": 139.6917
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "JPY",
    "value": {
      "@type": "QuantitativeValue",
      "value": 1500,
      "unitText": "HOUR"
    }
  },
  "workHours": "09:00-18:00",
  "jobBenefits": "交通費支給（1,000円）",
  "qualifications": "介護福祉士、初任者研修",
  "directApply": true
}
```

### 5.3 フィールド説明

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `title` | ○ | 求人タイトル |
| `description` | ○ | 仕事内容説明 |
| `datePosted` | ○ | 求人掲載日（ISO 8601形式） |
| `validThrough` | △ | 応募締切日（最後の勤務日を使用） |
| `employmentType` | ○ | `TEMPORARY`（単発バイトのため） |
| `hiringOrganization` | ○ | 採用組織（施設情報） |
| `jobLocation` | ○ | 勤務地（住所＋座標） |
| `baseSalary` | △ | 給与情報（時給） |
| `workHours` | - | 勤務時間 |
| `jobBenefits` | - | 福利厚生（交通費） |
| `qualifications` | - | 応募資格 |
| `directApply` | - | 直接応募可能（true） |

### 5.4 検証ツール

- **Google リッチリザルトテスト:** https://search.google.com/test/rich-results
- **スキーマ検証:** https://validator.schema.org/

---

## 6. robots.txt

### 6.1 設定内容

```
User-agent: *
Allow: /public/
Disallow: /admin/
Disallow: /system-admin/
Disallow: /mypage/
Disallow: /messages/
Disallow: /my-jobs/
Disallow: /bookmarks/
Disallow: /application-complete/
Disallow: /login
Disallow: /register/
Disallow: /password-reset/
Disallow: /api/

Sitemap: https://{host}/sitemap.xml
```

### 6.2 動的生成

`app/robots.ts` でリクエストホストに応じて動的にURLを生成。

---

## 7. sitemap.xml

### 7.1 構造

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://share-worker-app.vercel.app</loc>
    <lastmod>2026-01-10</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://share-worker-app.vercel.app/public/jobs/123</loc>
    <lastmod>2026-01-09</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... -->
</urlset>
```

### 7.2 含まれるページ

1. **トップページ** - priority: 1.0
2. **公開求人詳細** - priority: 0.8
   - `status` = `PUBLISHED`
   - `job_type` = `NORMAL`

### 7.3 動的生成

`app/sitemap.ts` でDBから公開求人を取得し動的に生成。

---

## 8. 公開ページレイアウト

### 8.1 ヘッダー

- ロゴのみ表示（ナビゲーションなし）
- リンク先: トップページ（`/`）

### 8.2 フッター

- CTAボタン「会員登録して応募する」
- 固定表示（position: fixed）
- リンク先: `/login`

### 8.3 BottomNav

公開ページでは非表示。
`WorkerLayout` で `/public/` を除外パスとして設定。

---

## 9. 関連ファイル

| ファイル | 役割 |
|---------|------|
| `app/public/layout.tsx` | 公開ページ用レイアウト |
| `app/public/jobs/[id]/page.tsx` | 公開求人詳細ページ |
| `app/robots.ts` | robots.txt生成 |
| `app/sitemap.ts` | sitemap.xml生成 |
| `src/lib/actions/job-public.ts` | 公開求人データ取得 |
| `middleware.ts` | 認証除外設定 |
| `components/layout/WorkerLayout.tsx` | BottomNav除外設定 |

---

## 10. 今後の拡張予定

- [ ] 公開求人一覧ページ（`/public/jobs`）
- [ ] 公開施設詳細ページ（`/public/facilities/[id]`）
- [ ] パンくずリスト構造化データ（BreadcrumbList）
- [ ] FAQ構造化データ（FAQPage）
- [ ] 組織構造化データ（Organization）

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-01-10 | 初版作成 |
