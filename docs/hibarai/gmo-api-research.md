# GMOあおぞらネット銀行 API仕様書 調査メモ

**調査日**: 2026-05-28
**対象バージョン**: 1.8.0（2021-07-12最終更新）
**用途**: 日払い機能のGMO接続実装の指針

---

## 📄 公式仕様書（PDF）

| 名称 | URL |
|---|---|
| **法人口座編** | https://gmo-aozora.com/business/service/pdf/api-spec-corporate.pdf |
| **認可編 (OpenID Connect)** | https://gmo-aozora.com/business/service/pdf/auth-openid.pdf |
| **イベント通知編 (Webhook)** | https://gmo-aozora.com/business/service/pdf/api-spec-webhooks.pdf |
| API一覧 (HTML) | https://gmo-aozora.com/business/api-cooperation/apilineup.html |
| 開発者ポータル | https://api.gmo-aozora.com/ganb/developer/api-docs/ |
| sunabar (テスト環境) | https://gmo-aozora.com/sunabar/tutorial/01.html |

## 🌐 環境

| 環境 | ドメイン | ベースパス（法人） |
|---|---|---|
| 本番 | `api.gmo-aozora.com` | `/ganb/api/corporation/v1` |
| 開発 | `stg-api.gmo-aozora.com` | `/ganb/api/corporation/v1` |
| sunabar (実験) | `api.sunabar.gmo-aozora.com` | `/personal/v1`, `/corporate/v1` |

**プロトコル**: HTTP/1.1 + HTTPS、UTF-8、JSON

---

## 🔐 認証（OpenID Connect Authorization Code Flow）

### エンドポイント

| 用途 | パス |
|---|---|
| 認可 | `GET /ganb/api/auth/v1/authorization` |
| トークン | `POST /ganb/api/auth/v1/token` |
| ユーザー情報 | `GET /ganb/api/auth/v1/userinfo` |

### フロー（一度限り、ユーザーによる承認）
```
1. ユーザーをブラウザで認可エンドポイントへリダイレクト
   - client_id, redirect_uri, response_type=code, scope, state, nonce
2. ユーザーがGMOあおぞらにログイン＋アクセス認可
3. redirect_uri に code が付与されて戻る
4. サーバー側で /token に code を投げてアクセストークンを取得
   - grant_type=authorization_code
5. access_token / refresh_token / id_token を受領
```

### スコープ
| スコープ | 用途 |
|---|---|
| `openid` | 必須（OIDC） |
| `offline_access` | リフレッシュトークン取得 |
| `corp:account` | 法人口座情報照会 |
| `corp:transfer` | **法人 振込（核機能）** |
| `corp:bulk-transfer` | 法人 総合振込 |
| `corp:virtual-account` | 法人 振込入金口座（被仕向） |
| `private:account` `private:transfer` `private:virtual-account` | 個人/個人事業主向け（同時指定不可） |

### トークン
- `access_token`: API呼び出し時 `x-access-token` ヘッダ（または `Authorization: Bearer`）
- `expires_in`: 約30日（実例 2592000秒）
- `refresh_token`: 期限切れ後の再発行用
- `id_token`: JWT (HS256)、`clientSecret` をキーに署名検証

---

## 💰 主要API（法人口座編）

### 1. 口座一覧照会 — `GET /accounts`
- 認証: `x-access-token`
- レスポンス: 全口座（口座ID、支店、口座番号、名義、`transferLimitAmount` 振込限度額）

### 2. 残高照会 — `GET /accounts/balances`
- レスポンス: `balance`（現在残高）、`withdrawableAmount`（**支払可能残高 = 出金可能額**）

### 3. 入出金明細照会 — `GET /accounts/transactions`
- 期間指定（dateFrom/dateTo）、500件/ページ、ページネーション対応

### 4. ⭐ **振込依頼 — `POST /transfer/request`**
中核。日払い機能の核心。

**ヘッダ**:
- `x-access-token` （認証）
- **`Idempotency-Key`**（**冪等性保証**。1-128文字。**v1.8.0で追加**）

**ボディ**:
```json
{
  "accountId": "101011234567",            // 振込元口座
  "remitterName": "プラスタスタス カ",     // 振込依頼人名
  "transferDesignatedDate": "2026-05-28", // 振込指定日
  "transferDateHolidayCode": "1",         // 1:営業日扱い / 2:前営業日 / 3:エラー
  "totalCount": "1",
  "totalAmount": "10657",
  "applyComment": "WORKER#36 5/28勤務分", // 申請メモ
  "transfers": [{
    "itemId": "1",
    "transferAmount": "10657",
    "ediInfo": "WID-xxxx",
    "beneficiaryBankCode": "0001",        // 振込先銀行コード
    "beneficiaryBranchCode": "001",
    "accountTypeCode": "1",               // 1:普通 / 2:当座 / 4:貯蓄
    "accountNumber": "1234567",
    "beneficiaryName": "サトウ ミサキ"      // ★受取人名（48桁・カナ）
  }]
}
```

**レスポンス 201 Created**:
- `applyNo`（受付番号 16桁）← これで以後の状況照会
- `resultCode`（1:完了 / 2:未完了）
- `applyEndDatetime`

### 5. 振込状況照会 — `GET /transfer/status`
個別 or 一括で照会。

**主要レスポンス**:
- `transferStatus` コード一覧：
  | コード | 状態 |
  |---|---|
  | 2 | 申請中 |
  | 3 | 差戻 |
  | 4 | 取下げ |
  | 5 | 期限切れ |
  | 8 | 承認取消/予約取消 |
  | 11 | 予約中 |
  | 12 | 手続中 |
  | 13 | リトライ中 |
  | **20** | **手続済（成功）** |
  | 22 | **資金返却** |
  | 24 | 組戻手続中 |
  | 25 | **組戻済** |
  | 26 | 組戻不成立 |
  | 40 | 手続不成立 |
- `refundStatus`: 1:手続中 / 2:組戻済 / 3:不成立
- `isRepayment`: 資金返却フラグ
- `repaymentDate`: 資金返却日
- `transferFee`: 手数料額
- `applyStatus`: 0:未申請 / 1:申請中 / 2:差戻 / 3:取下 / 4:期限切れ / 5:承認取消 / 6:承認済 / 7:自動承認

### 6. 振込依頼結果照会 — `GET /transfer/request-result`
- Query: `accountId` + `applyNo`
- 単一トランザクションの結果取得用

### 7. 振込手数料事前照会 — `POST /transfer/transferfee`
- 振込依頼と同じボディ構造
- レスポンス: `totalFee`、明細ごと `transferFee`
- **申請前に手数料を確認できる**

### 8. 振込取消依頼 — `POST /transfer/cancel`
- 申請後（承認前）の取消

---

## 📨 Webhook（イベント通知編）

### ⚠️ 最重要な発見
**仕向（自社からの振込）の結果通知Webhookは存在しない。** Webhookで提供されるのは **被仕向（着金）通知のみ**。

→ **日払いの振込結果は、振込状況照会API のポーリングで取得する設計**にしなければならない。

### 提供されているWebhook
- **`va-deposit-transaction`** — 振込入金口座への入金明細通知（被仕向）

### Webhookセキュリティ
- **アクセストークン**: リクエストヘッダに通知対象ユーザーのアクセストークン → 受信側で一致を検証
- **シグネチャ（オプション）**: `x-webhook-signature` ヘッダにHMAC-SHA256ハッシュ（Base64）
  ```bash
  echo -n "[ボディ部]" | openssl dgst -binary -sha256 -hmac "[クライアントシークレット]" | base64
  ```
- **Basic認証（オプション）**

### 制約
- 配信は **非同期、順序保証なし**
- リトライ：最初の通知から **1時間以内** に指数関数的間隔
- 配信エラー継続で **14日間配信停止**
- 同一明細が **重複配信される可能性あり**（受信側で冪等処理必須）
- アクセストークン期限切れ → 通知停止

### サポートAPI
- `POST /subscribe`：Webhookの開始/停止コントロール
- `GET /unsentlist/va-deposit-transaction`：未送信明細の一括取得（リカバリ用）

---

## 🏦 振込料金（2026/5/10改定の可能性あり※要確認）

| 区分 | 通常会員 | とくとく会員（月額500円） |
|---|---|---|
| **同行宛** | 無料 | 無料 |
| **他行宛** | 143円（税込）/件 | 129円（税込）/件 |
| **組戻手数料** | 880円（税込）/件 | 同 |

振込限度額: 0〜5億円（初期値500万円、上限変更は審査）

24/365 対応、ただし他行宛は土曜・日曜 23:52-00:10 が停止時間帯。

---

## ❌ 提供されていない・要追加問合せの機能

| 機能 | 状況 |
|---|---|
| **仕向振込の結果Webhook** | ❌ 提供なし → ポーリング設計必須 |
| **受取人名義照合API** | ❌ 公開資料に記載なし。手動で `beneficiaryName` を送るだけ。誤一致は GMO 側の判定に依存。**要GMO問合せ** |
| **組戻し依頼の独立API** | ⚠️ 明示的なAPI記載なし。`transferStatus` の組戻ステータスで追跡可能。**運用上は別途連絡が必要そう。要GMO問合せ** |

---

## 🎯 我々の設計への影響と対応

### 影響1: cycle.html の修正必要
- 現状: 「Webhook受信 → 完了確定」
- 正しい: 「振込状況照会APIをポーリング → 完了確定」
- Phase 2 ステップ6 を書き直し

### 影響2: Server Actions 設計
- 振込依頼後、`applyNo` をDBに保存
- **バックグラウンドジョブ（cron）で `/transfer/status` を定期ポーリング**
- 状態が `20`（手続済）になったら完了通知
- 状態が `40`/`22`/`25` 等になったらエラー/組戻し処理

### 影響3: 名義照合は運用で担保
- ワーカー登録時に「本人名義必須」をUI/規約で明示
- 銀行コード×支店コード×口座番号は API で送れる
- 受取人名（カナ48桁）も送る → GMO側で照合不一致なら振込失敗ステータスで返る想定

### 影響4: 着金Webhookは別用途
- 法人口座への着金（被仕向）のWebhook → 経理側で利用可能
- 例：報酬計算と紐付ける、不正検知に使う

---

## 🚀 GMO接続のための最小実装ステップ

1. **sunabar 申込**（法人口座所有者は審査なしで利用可）
   - 銀行サービスサイト→「開発者向け」タブからID/PASS取得
   - sunabarポータルログイン
   - 仮想口座が自動発行（個人/法人各1）
   - アクセストークン取得

2. **Node.js スクリプトで疎通確認**（接続情報入手後）
   ```bash
   # 口座一覧（最も簡単）
   curl -X GET https://api.sunabar.gmo-aozora.com/corporate/v1/accounts \
        -H "x-access-token: ${TOKEN}"
   ```

3. **OAuth2フロー実装**
   - `/ganb/api/auth/v1/authorization` へのリダイレクト
   - redirect_uri で code 受領
   - `/ganb/api/auth/v1/token` で access_token 取得
   - DB に access_token + refresh_token + 有効期限を保存

4. **振込依頼の試験**（sunabar 仮想口座間で完結可能）
   - 1円・他行宛で `Idempotency-Key` 付き
   - `applyNo` を取得 → DB保存
   - `/transfer/status` で 20:手続済 になるまでポーリング

5. **エラーケース確認**
   - 不正な銀行コード → 何のステータス？
   - 名義不一致 → どう振る舞う？
   - 残高不足 → 即時失敗？

---

## 📝 確認待ち（GMO担当者へヒアリング項目）

1. **名義照合API** の提供有無、精度
2. **仕向振込結果のWebhook** 提供予定（無いことが現状確定）
3. **組戻し依頼API** の有無、もしくは運用フロー
4. **2026/5/10 手数料改定** の詳細
5. **レート制限**：同時並列リクエスト数、1日上限
6. **エラーコード体系** の全量（`errorCode`の値リスト）
7. **TLS/IP制限**：呼び出し元IP固定の必要性
8. **テスト用Webhookの受信** はsunabarで可能か（プライベートIPで受けるなら ngrok等が必要？）

## 📚 参考リソース

- [GMOあおぞらネット銀行 API連携TOP](https://gmo-aozora.com/business/api-cooperation/)
- [APIラインアップ](https://gmo-aozora.com/business/api-cooperation/apilineup.html)
- [オープンAPI仕様書 法人口座編 v1.8.0](https://gmo-aozora.com/business/service/pdf/api-spec-corporate.pdf)
- [オープンAPI仕様書 認可編 v1.8.0](https://gmo-aozora.com/business/service/pdf/auth-openid.pdf)
- [オープンAPI仕様書 イベント通知編 v1.8.0](https://gmo-aozora.com/business/service/pdf/api-spec-webhooks.pdf)
- [sunabar はじめてガイド](https://gmo-aozora.com/sunabar/tutorial/01.html)
- [GMO Aozora Go SDK (GitHub)](https://github.com/gmo-aozora/ganb-api-sdk-go)
- [振込料金 とくとく会員](https://gmo-aozora.com/business/service/transfer-tokutoku.html)
