# GTM dataLayer 実装ガイド

このドキュメントは、+タスタス LP トラッキングシステムをGoogle Tag Manager (GTM) / GA4 / Facebook広告と連携させるための実装ガイドです。

---

## 1. 概要

LP（ランディングページ）のトラッキングスクリプトは、ユーザーの行動イベントを `dataLayer` にプッシュします。
GTM側でこれらのイベントを受け取り、GA4やFacebook Pixelに転送する設定を行ってください。

---

## 2. dataLayerイベント一覧

### 2.1 ページビュー

```javascript
dataLayer.push({
  event: 'lp_pageview',
  lp_id: '1',                        // LP識別子
  campaign_code: 'fb_summer2024',    // キャンペーンコード
  utm_source: 'facebook',            // 流入元
  utm_medium: 'cpc',                 // メディアタイプ
  utm_campaign: 'summer2024'         // キャンペーン名
});
```

### 2.2 スクロール到達

```javascript
dataLayer.push({
  event: 'lp_scroll',
  scroll_depth: 50,                  // 25, 50, 75, 90 のいずれか
  lp_id: '1',
  campaign_code: 'fb_summer2024'
});
```

### 2.3 滞在時間達成

```javascript
dataLayer.push({
  event: 'lp_dwell',
  dwell_seconds: 10,                 // 5 または 10
  lp_id: '1',
  campaign_code: 'fb_summer2024'
});
```

### 2.4 CTAクリック（LINE登録ボタン）

```javascript
dataLayer.push({
  event: 'lp_cta_click',
  button_id: 'line_register_main',   // ボタン識別子
  button_text: 'LINEで登録する',      // ボタンテキスト
  lp_id: '1',
  campaign_code: 'fb_summer2024'
});
```

### 2.5 エンゲージメントパターン達成

```javascript
dataLayer.push({
  event: 'lp_engagement',
  engagement_level: 3,               // 1〜5
  engagement_pattern: '10秒以上滞在かつ50%到達',
  lp_id: '1',
  campaign_code: 'fb_summer2024'
});
```

**エンゲージメントレベル定義:**

| レベル | 条件 |
|-------|------|
| 1 | 5秒以上滞在 |
| 2 | 10秒以上滞在 |
| 3 | 10秒以上滞在 かつ 50%スクロール |
| 4 | 10秒以上滞在 かつ 75%スクロール |
| 5 | 10秒以上滞在 かつ 90%スクロール |

---

## 3. GTM設定手順

### 3.1 変数の作成

**Data Layer Variables（データレイヤー変数）を作成:**

| 変数名 | データレイヤー変数名 |
|-------|-------------------|
| DLV - lp_id | lp_id |
| DLV - campaign_code | campaign_code |
| DLV - utm_source | utm_source |
| DLV - utm_medium | utm_medium |
| DLV - utm_campaign | utm_campaign |
| DLV - scroll_depth | scroll_depth |
| DLV - dwell_seconds | dwell_seconds |
| DLV - button_id | button_id |
| DLV - button_text | button_text |
| DLV - engagement_level | engagement_level |
| DLV - engagement_pattern | engagement_pattern |

### 3.2 トリガーの作成

**カスタムイベントトリガーを作成:**

| トリガー名 | イベント名 | 発火条件 |
|-----------|-----------|---------|
| CE - LP Pageview | lp_pageview | - |
| CE - LP Scroll | lp_scroll | - |
| CE - LP Dwell | lp_dwell | - |
| CE - LP CTA Click | lp_cta_click | - |
| CE - LP Engagement | lp_engagement | - |

### 3.3 GA4 タグの作成

#### ページビュータグ
- **タグタイプ**: GA4 イベント
- **イベント名**: `lp_pageview`
- **イベントパラメータ**:
  - `lp_id`: {{DLV - lp_id}}
  - `campaign_code`: {{DLV - campaign_code}}
  - `utm_source`: {{DLV - utm_source}}
  - `utm_medium`: {{DLV - utm_medium}}
  - `utm_campaign`: {{DLV - utm_campaign}}
- **トリガー**: CE - LP Pageview

#### スクロールタグ
- **タグタイプ**: GA4 イベント
- **イベント名**: `lp_scroll`
- **イベントパラメータ**:
  - `lp_id`: {{DLV - lp_id}}
  - `scroll_depth`: {{DLV - scroll_depth}}
  - `campaign_code`: {{DLV - campaign_code}}
- **トリガー**: CE - LP Scroll

#### 滞在時間タグ
- **タグタイプ**: GA4 イベント
- **イベント名**: `lp_dwell`
- **イベントパラメータ**:
  - `lp_id`: {{DLV - lp_id}}
  - `dwell_seconds`: {{DLV - dwell_seconds}}
  - `campaign_code`: {{DLV - campaign_code}}
- **トリガー**: CE - LP Dwell

#### CTAクリックタグ
- **タグタイプ**: GA4 イベント
- **イベント名**: `lp_cta_click`
- **イベントパラメータ**:
  - `lp_id`: {{DLV - lp_id}}
  - `button_id`: {{DLV - button_id}}
  - `button_text`: {{DLV - button_text}}
  - `campaign_code`: {{DLV - campaign_code}}
- **トリガー**: CE - LP CTA Click

#### エンゲージメントタグ
- **タグタイプ**: GA4 イベント
- **イベント名**: `lp_engagement`
- **イベントパラメータ**:
  - `lp_id`: {{DLV - lp_id}}
  - `engagement_level`: {{DLV - engagement_level}}
  - `engagement_pattern`: {{DLV - engagement_pattern}}
  - `campaign_code`: {{DLV - campaign_code}}
- **トリガー**: CE - LP Engagement

---

## 4. Facebook Pixel 連携

### 4.1 カスタムイベントの設定

Facebook Pixelでは以下のカスタムイベントを設定:

| GTMイベント | Facebook イベント | 推奨設定 |
|------------|------------------|---------|
| lp_pageview | ViewContent | 標準イベント使用 |
| lp_cta_click | Lead | コンバージョンとして設定 |
| lp_engagement (level 4-5) | InitiateCheckout | 高エンゲージメントをコンバージョン候補に |

### 4.2 Facebook Pixel タグ設定例

```javascript
// ViewContent（ページビュー時）
fbq('track', 'ViewContent', {
  content_name: 'LP ' + {{DLV - lp_id}},
  content_category: 'Landing Page',
  campaign: {{DLV - campaign_code}}
});

// Lead（CTAクリック時）
fbq('track', 'Lead', {
  content_name: {{DLV - button_text}},
  content_category: 'CTA Click',
  campaign: {{DLV - campaign_code}}
});
```

---

## 5. 確認手順

### 5.1 GTM プレビューモード

1. GTMでプレビューモードを有効化
2. LPにアクセス
3. Tag Assistantで以下を確認:
   - `lp_pageview` イベントが発火
   - スクロールで `lp_scroll` イベントが発火
   - 5秒/10秒経過で `lp_dwell` イベントが発火
   - LINE登録ボタンクリックで `lp_cta_click` イベントが発火

### 5.2 GA4 リアルタイムレポート

1. GA4管理画面 → レポート → リアルタイム
2. イベント数を確認
3. 各イベントのパラメータ値を確認

### 5.3 Facebook Events Manager

1. Events Manager → テストイベント
2. テストコードを入力してLPにアクセス
3. イベント受信を確認

---

## 6. トラブルシューティング

### dataLayerにイベントが入らない

**確認事項:**
1. ブラウザのコンソールで `console.log(dataLayer)` を実行
2. トラッキングスクリプト `/lp/tracking.js` が読み込まれているか確認
3. JavaScriptエラーがないか確認

### GA4にイベントが届かない

**確認事項:**
1. GTMのプレビューモードでタグが発火しているか
2. GA4の測定IDが正しく設定されているか
3. トリガーの条件が正しいか

### Facebook Pixelにイベントが届かない

**確認事項:**
1. Facebook Pixel ベースコードが設置されているか
2. Events Managerでピクセルがアクティブか
3. カスタムイベント名が正しいか

---

## 7. 連絡先

実装で不明点がある場合は、開発チームにお問い合わせください。

- 仕様確認: `docs/lp-tracking-specification.md`
- トラッキングスクリプト: `public/lp/tracking.js`
- API仕様: `app/api/lp-tracking/route.ts`
