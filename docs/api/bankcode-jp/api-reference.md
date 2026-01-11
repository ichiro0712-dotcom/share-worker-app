# BankcodeJP API v3 リファレンス

> 金融機関コード・支店コード検索API

## 概要

BankcodeJP APIは、日本の金融機関コードおよび支店コードを検索・取得するためのRESTful APIです。

**ベースURL:** `https://apis.bankcode-jp.com/v3/`

## 認証

APIキーによる認証が必要です。以下の2つの方法で設定可能：

### 1. クエリパラメータ方式

```
https://apis.bankcode-jp.com/v3/banks?apikey=YOUR_API_KEY
```

### 2. HTTPヘッダー方式（推奨）

```http
GET /v3/banks HTTP/1.1
Host: apis.bankcode-jp.com
apikey: YOUR_API_KEY
```

> **注意**: モバイルアプリではHTTPヘッダー方式を推奨（SSL/TLSで暗号化されるため）

### APIキーの取得

1. ダッシュボードにアクセス
2. 「APIキーを作成」をクリック
3. リファラーまたはIPアドレスで保護設定を行う

---

## エンドポイント一覧

### 金融機関 (Banks)

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | `/banks` | 金融機関一覧を取得 |
| GET | `/banks/{code}` | 指定した金融機関コードの詳細を取得 |
| GET | `/freeword/banks` | 金融機関をあいまい検索 |

### 支店 (Branches)

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | `/banks/{bankCode}/branches` | 指定金融機関の支店一覧を取得 |
| GET | `/banks/{bankCode}/branches/{code}` | 指定支店の詳細を取得 |
| GET | `/freeword/banks/{bankCode}/branches` | 支店をあいまい検索 |

### 業態種別 (Business Types)

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | `/businessTypes` | 金融機関の業態種別一覧を取得 |

### バージョン情報

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | `/version` | データベースバージョン情報を取得 |

---

## リソース定義

### Bank（金融機関）

| フィールド | 型 | 説明 |
|------------|------|------|
| code | string | 金融機関コード（半角数字4桁） |
| name | string | 金融機関名 |
| halfWidthKana | string | 金融機関名（半角カタカナ） |
| fullWidthKana | string | 金融機関名（全角カタカナ） |
| hiragana | string | 金融機関名（ひらがな） |
| businessTypeCode | string | 業態種別コード |
| businessType | string | 業態種別名 |

### Branch（支店）

| フィールド | 型 | 説明 |
|------------|------|------|
| code | string | 支店コード（半角数字3桁） |
| name | string | 支店名 |
| halfWidthKana | string | 支店名（半角カタカナ） |
| fullWidthKana | string | 支店名（全角カタカナ） |
| hiragana | string | 支店名（ひらがな） |

### BusinessType（業態種別）

| フィールド | 型 | 説明 |
|------------|------|------|
| code | string | 業態種別コード |
| name | string | 業態種別名 |

---

## クエリパラメータ

### ページネーション

| パラメータ | 型 | デフォルト | 説明 |
|------------|------|------------|------|
| limit | integer | 20 | 取得件数（1〜2000） |
| cursor | string | - | ページネーション用カーソル |

**レスポンスに含まれるページネーション情報:**

```json
{
  "banks": [...],
  "size": 20,
  "limit": 20,
  "hasNext": true,
  "nextCursor": "eyJjb2RlIjoiMDAyMCJ9",
  "hasPrev": false,
  "prevCursor": null,
  "version": "2024-01-15T10:00:00+0900"
}
```

### 部分レスポンス（fields）

特定のフィールドのみ取得してペイロードを削減：

```
GET /v3/banks?fields=code,name,hiragana
```

### ソート（sort）

プロパティ名を指定。`+`（昇順）または`-`（降順）プレフィックスで順序指定：

```
GET /v3/banks?sort=hiragana      # ひらがな昇順
GET /v3/banks?sort=-name         # 名前降順
GET /v3/banks?sort=businessTypeCode,name  # 複数フィールド
```

### フィルタリング（filter）

#### 基本構文

```
filter=プロパティ名 演算子 引数
```

#### 比較演算子

| 演算子 | 説明 | 例 |
|--------|------|-----|
| `==` | 等しい | `code==0001` |
| `!=` | 等しくない | `code!=0001` |
| `<` | より小さい | `code<0100` |
| `<=` | 以下 | `code<=0100` |
| `>` | より大きい | `code>0100` |
| `>=` | 以上 | `code>=0100` |
| `=in=` | 含まれる | `code=in=(0001,0002,0003)` |

#### 論理演算子

| 演算子 | 意味 | 優先度 |
|--------|------|--------|
| `;` | AND | 高 |
| `,` | OR | 低 |

#### パターンマッチング

| ワイルドカード | 説明 |
|----------------|------|
| `*` | 0文字以上の任意の文字 |
| `_` | 1文字の任意の文字 |

**例:**
```
filter=name==あ*                    # 「あ」で始まる名前
filter=code=in=(0001,0002)          # コードが0001または0002
filter=businessTypeCode==01;name==*銀行  # 業態01かつ「銀行」で終わる
```

### あいまい検索（freeword）

```
GET /v3/freeword/banks?freeword=みずほ
```

### JSONP

```
GET /v3/banks?callback=myCallback
```

---

## レスポンス例

### 金融機関一覧

**リクエスト:**
```
GET /v3/banks?limit=2
```

**レスポンス:**
```json
{
  "banks": [
    {
      "code": "0001",
      "name": "みずほ銀行",
      "halfWidthKana": "ﾐｽﾞﾎ",
      "fullWidthKana": "ミズホ",
      "hiragana": "みずほ",
      "businessTypeCode": "01",
      "businessType": "都市銀行"
    },
    {
      "code": "0005",
      "name": "三菱UFJ銀行",
      "halfWidthKana": "ﾐﾂﾋﾞｼUFJ",
      "fullWidthKana": "ミツビシUFJ",
      "hiragana": "みつびしゆーえふじぇい",
      "businessTypeCode": "01",
      "businessType": "都市銀行"
    }
  ],
  "size": 2,
  "limit": 2,
  "hasNext": true,
  "nextCursor": "eyJjb2RlIjoiMDAwNSJ9",
  "hasPrev": false,
  "prevCursor": null,
  "version": "2024-01-15T10:00:00+0900"
}
```

### バージョン情報

**リクエスト:**
```
GET /v3/version
```

**レスポンス:**
```json
{
  "version": "2024-01-15T10:00:00+0900"
}
```

---

## エラーレスポンス

### エラー形式

```json
{
  "httpStatusCode": 400,
  "code": "INVALID_PARAMETER",
  "message": "パラメータが不正です",
  "validationErrors": [
    {
      "field": "limit",
      "message": "1から2000の間で指定してください"
    }
  ]
}
```

### HTTPステータスコード

| コード | 意味 | 説明 |
|--------|------|------|
| 200 | OK | リクエスト成功 |
| 400 | Bad Request | リクエストパラメータが不正 |
| 401 | Unauthorized | APIキーが無効または未指定 |
| 404 | Not Found | リソースが見つからない |
| 429 | Too Many Requests | レート制限超過 |
| 500 | Internal Server Error | サーバー内部エラー |

---

## レート制限

### 制限値

| プラン | 1日の上限 |
|--------|----------|
| Free | 350回/日 |
| 有料プラン | プランにより異なる |

### レスポンスヘッダー

| ヘッダー | 説明 |
|----------|------|
| `x-ratelimit-limit-day` | 1日の上限回数 |
| `x-ratelimit-remaining-day` | 残りリクエスト回数 |
| `ratelimit-reset` | 制限リセットまでの秒数 |

### 制限超過時

HTTP 429が返却されます。`ratelimit-reset`ヘッダーでリセット時刻を確認してください。

---

## CORS対応

オリジン間リソース共有（CORS）に対応しています。ブラウザから直接APIを呼び出すことが可能です。

---

## 利用上の注意

- HTTPS接続が必須です
- APIキーは適切に保護してください
- レート制限に注意してください
- データベースは定期的に更新されます（versionエンドポイントで確認可能）

---

## 関連リンク

- [BankcodeJP公式サイト](https://bankcode-jp.com/)
- [API管理ダッシュボード](https://api.docs.bankcode-jp.com/)
