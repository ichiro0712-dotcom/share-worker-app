# LINE運用チーム向け パラメータ設定ガイド

このドキュメントは、+TASTAS LPからLINE公式アカウントへ誘導する際のパラメータ設定方法を説明します。

---

## 1. 概要

LPからLINE登録へ誘導する際、どの広告キャンペーン経由で登録したかを追跡するために、LINEの友だち追加URLにパラメータを付与します。

---

## 2. LINE友だち追加URLの形式

### 2.1 基本URL

```
https://line.me/R/ti/p/@あなたのLINE_ID
```

または

```
https://lin.ee/xxxxxxx
```

### 2.2 パラメータ付きURL

LPトラッキングからの流入を識別するため、以下のパラメータを追加:

```
https://line.me/R/ti/p/@あなたのLINE_ID?lp_campaign={キャンペーンコード}
```

---

## 3. LPからLINEへのパラメータ引き継ぎ

### 3.1 自動引き継ぎの仕組み

LPのトラッキングスクリプトは、LINE登録ボタンがクリックされた際に:

1. 現在のキャンペーンコード（URLの `?c=xxx` または UTMパラメータから生成）を取得
2. LINE URLにパラメータとして追加
3. ユーザーをLINE登録ページへ誘導

### 3.2 LPのHTML設定

LINE登録ボタンには以下のいずれかを設定:

```html
<!-- 方法1: クラス名で自動認識 -->
<a href="https://line.me/R/ti/p/@xxx" class="btn-line-cta">
  LINEで登録する
</a>

<!-- 方法2: data属性で明示的に指定 -->
<a href="https://line.me/R/ti/p/@xxx" data-lp-cta="line">
  LINEで登録する
</a>
```

トラッキングスクリプトがボタンクリック時にURLを自動書き換え:

```
元: https://line.me/R/ti/p/@xxx
↓
書き換え後: https://line.me/R/ti/p/@xxx?lp_campaign=fb_summer2024&lp_id=1
```

---

## 4. LINEで受け取るパラメータ

### 4.1 パラメータ一覧

| パラメータ名 | 説明 | 例 |
|-------------|------|-----|
| `lp_campaign` | キャンペーンコード | `fb_summer2024` |
| `lp_id` | LP識別子 | `1`, `2` |
| `lp_source` | 流入元（UTMから） | `facebook`, `instagram` |

### 4.2 LINE側での確認方法

LINE Official Account Managerで:

1. 分析 → 友だち → 流入経路分析
2. URLパラメータ別の友だち追加数を確認

---

## 5. 広告配信時のURL設定

### 5.1 Facebook/Instagram広告

広告のリンク先URLに以下を設定:

```
https://share-worker-app.vercel.app/lp/1?c=fb_summer2024
```

または UTM形式:

```
https://share-worker-app.vercel.app/lp/1?utm_source=facebook&utm_medium=cpc&utm_campaign=summer2024
```

### 5.2 Google広告

```
https://share-worker-app.vercel.app/lp/1?utm_source=google&utm_medium=cpc&utm_campaign=nurse_recruit
```

### 5.3 LINE広告

```
https://share-worker-app.vercel.app/lp/1?utm_source=line&utm_medium=display&utm_campaign=caregiver_2024
```

---

## 6. キャンペーンコード命名規則

### 6.1 推奨フォーマット

```
{プラットフォーム}_{ターゲット}_{年月}_{バリエーション}
```

### 6.2 例

| コード | 意味 |
|-------|------|
| `fb_nurse_202401_a` | Facebook、看護師向け、2024年1月、バリエーションA |
| `ig_caregiver_202402_video` | Instagram、介護士向け、2024年2月、動画広告 |
| `google_search_202403` | Google検索広告、2024年3月 |
| `line_retarget_202404` | LINEリターゲティング、2024年4月 |

### 6.3 プラットフォームコード

| コード | プラットフォーム |
|-------|----------------|
| `fb` | Facebook |
| `ig` | Instagram |
| `google` | Google広告 |
| `line` | LINE広告 |
| `tw` | X (Twitter) |
| `yt` | YouTube |
| `tiktok` | TikTok |

---

## 7. 効果測定

### 7.1 確認できる指標

LPトラッキングダッシュボード（`/lp/tracking`）で:

| 指標 | 説明 |
|------|------|
| PV | キャンペーン別ページビュー |
| UU | キャンペーン別ユニークユーザー |
| CTAクリック数 | LINE登録ボタンのクリック数 |
| CTR | クリック率（CTAクリック / UU） |
| エンゲージメント | 滞在時間・スクロール深度 |

### 7.2 LINE側で確認できる指標

LINE Official Account Managerで:

| 指標 | 説明 |
|------|------|
| 友だち追加数 | キャンペーン別の新規友だち数 |
| ブロック率 | キャンペーン別のブロック率 |

---

## 8. よくある質問

### Q: パラメータが正しく引き継がれているか確認するには？

A: ブラウザのネットワークタブで、LINE URLへのリクエストを確認してください。
パラメータが付与されていれば正常に動作しています。

### Q: 既存のLINE URLを変更する必要がありますか？

A: いいえ。LPのトラッキングスクリプトが自動的にパラメータを追加します。
LP側のボタンに正しいクラス名（`btn-line-cta`）が設定されていれば動作します。

### Q: 複数のLPで同じキャンペーンコードを使えますか？

A: はい。LP IDは別途記録されるため、同じキャンペーンコードでもLP別の効果を測定できます。

---

## 9. 連絡先

設定で不明点がある場合は、開発チームにお問い合わせください。

- 仕様確認: `docs/lp-tracking-specification.md`
- トラッキングダッシュボード: `/lp/tracking`
