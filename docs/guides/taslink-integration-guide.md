# TasLink API連携 開発者ガイド

> 対象読者: TasLink側の開発者、およびタスタス側でこの連携機能を保守する開発者
> 最終更新: 2026-04-11

---

## 1. この連携は何をしているのか

タスタス（+タスタス）は看護師・介護士向けの求人マッチングWebサービスです。
この連携機能は、**タスタスでワーカー（求職者）がプロフィールを登録・変更したとき、そのデータを自動的にTasLink APIへ送信する**仕組みです。

```
┌──────────────┐        POST /api/v1/external/workers        ┌──────────┐
│   タスタス     │  ─────────────────────────────────────────>  │  TasLink  │
│  (基幹システム) │     x-api-key ヘッダーで認証                  │  (外部)   │
│              │  <─────────────────────────────────────────  │          │
│              │     200/201 + TasLink内部ID                   │          │
└──────────────┘                                              └──────────┘
```

**ポイント:**
- データの流れは **タスタス → TasLink** の一方向（タスタスが送信側）
- TasLinkからタスタスへの逆方向の同期は今回のスコープ外
- 対象は **ワーカー（求職者）のみ**。施設・案件の連携は未実装

---

## 2. いつデータが送信されるのか（トリガー）

以下の **3つのタイミング** でTasLink APIが呼ばれます:

| # | タイミング | ファイル | 送信データ |
|---|-----------|---------|-----------|
| 1 | **新規会員登録** | `app/api/auth/register/route.ts` | 登録時に入力された全フィールド |
| 2 | **プロフィール編集** | `src/lib/actions/user-profile.ts` (`updateUserProfile`) | 編集画面の全フィールド |
| 3 | **自己PR編集** | `src/lib/actions/user-profile.ts` (`updateUserSelfPR`) | DBから最新の全フィールドを取得して送信 |

### 処理フローの詳細

#### トリガー1: 新規会員登録

```
ワーカーが登録フォームを送信
  ↓
1. パスワードハッシュ化
2. DBにユーザーレコード作成 (prisma.user.create)
3. 操作ログ記録
4. 認証メール送信
5. 管理者に新規登録通知
6. ★ TasLink APIへ同期 ← ここで呼ばれる
7. レスポンス返却（登録完了画面へ）
```

#### トリガー2: プロフィール編集

```
ワーカーがマイページでプロフィールを保存
  ↓
1. 認証チェック
2. バリデーション
3. 住所のジオコーディング（緯度経度取得）
4. DBにユーザーレコード更新 (prisma.user.update)
5. キャッシュ無効化
6. 操作ログ記録
7. ★ TasLink APIへ同期 ← ここで呼ばれる
8. レスポンス返却（更新完了）
```

#### トリガー3: 自己PR編集

```
ワーカーが自己PR入力欄を保存
  ↓
1. 認証チェック
2. DBの自己PRフィールドのみ更新
3. ★ DBから最新の全プロフィールを再取得
4. ★ TasLink APIへ同期（全フィールド送信）← ここで呼ばれる
5. レスポンス返却
```

> **なぜ自己PRだけ全フィールドを再取得するのか？**
> TasLink APIは `POST` でupsert（新規 or 更新）を行います。部分的なフィールドだけ送ると、
> 送らなかったフィールドが空で上書きされるリスクがあります。そのため、自己PR編集時も
> DBから最新のフルプロフィールを取得して全フィールドを送信しています。

---

## 3. エラーが起きたらどうなるのか

**最も重要な設計方針: TasLink同期が失敗しても、タスタス側の処理は正常に完了する。**

```
タスタスの処理（登録/更新）
  ↓ 成功
TasLink APIへ同期
  ├── 成功 → タスタスDBにTasLink IDを保存 → 正常終了
  ├── TasLink API失敗（400/401/429/500等）→ ログ出力のみ → 正常終了
  ├── ネットワークエラー → ログ出力のみ → 正常終了
  ├── 環境変数未設定 → warn出力してスキップ → 正常終了
  └── TasLink成功 + DB保存失敗 → API同期は成功扱い、DB保存エラーをログ → 正常終了
```

つまり、**ワーカーがプロフィール登録や編集をしたとき、TasLinkの状態に関係なく必ず成功します。**
TasLink側の障害がタスタスのユーザー体験に影響することはありません。

### ログの確認方法

Vercelのログで以下のプレフィックスを検索してください:

| ログ | 意味 |
|------|------|
| `[TasLink] Worker synced successfully` | 同期成功 |
| `[TasLink] Not configured` | 環境変数が未設定（開発環境では正常） |
| `[TasLink] Validation error` | TasLink APIが400を返した（ペイロードの問題） |
| `[TasLink] Authentication failed` | APIキーが無効 |
| `[TasLink] Rate limited` | レート制限に到達 |
| `[TasLink] DB update failed (API sync succeeded)` | API同期は成功したがDB保存に失敗 |
| `[TasLink] Network error` | TasLinkサーバーに接続できない |
| `[TasLink] Registration sync failed` | 登録時の同期でエラー |
| `[TasLink] Profile sync failed` | プロフィール更新時の同期でエラー |
| `[TasLink] Self-PR sync failed` | 自己PR更新時の同期でエラー |

---

## 4. 送信されるデータ（フィールドマッピング）

### 4.1 全体像

タスタスのDBフィールドは、TasLink APIの形式に変換されて送信されます。

```
タスタスDB (users テーブル)          TasLink API ペイロード
─────────────────────────         ───────────────────────
id: 42                      →    externalId: "42"
name: "田中 花子"             →    lastName: "田中", firstName: "花子"
last_name_kana: "たなか"      →    lastNameKana: "たなか"
first_name_kana: "はなこ"     →    firstNameKana: "はなこ"
gender: "女性"               →    gender: "FEMALE"
birth_date: 1990-01-15       →    dateOfBirth: "1990-01-15"
phone_number: "090-1234-5678" →   phone: "090-1234-5678"
email: "tanaka@example.com"  →    email: "tanaka@example.com"
qualifications: ["看護師"]    →    jobTypes: ["看護師"]
                                   qualifications: ["看護師免許"]
desired_work_style: "単発希望" →   workPreference: "ONE_TIME"
self_pr: "自己紹介文..."      →    notes: "自己紹介文..."
```

### 4.2 フィールド変換の詳細

#### externalId（ID連携）

```
タスタス user.id (数値) → String(user.id) → TasLink externalId (文字列)

例: user.id = 42 → externalId = "42"
```

- TasLink側でこの `externalId` を使ってupsert（同じIDなら更新、新しければ作成）
- タスタス側では、TasLinkから返されるIDを `taslink_id` カラムに保存

#### 名前（name → lastName / firstName）

タスタスでは名前が1つのフィールド（`name`）に "姓 名" の形で保存されています。
これをスペース区切りで分割してTasLinkへ送信します。

```
"田中 花子"   → lastName: "田中",  firstName: "花子"
"田中　花子"  → lastName: "田中",  firstName: "花子"    (全角スペースも対応)
"田中"       → lastName: "田中",  firstName: ""         (姓のみ)
""           → 同期スキップ（TasLink APIの必須フィールドを満たせないため）
```

> **注意:** 名前が空のワーカーはTasLinkに同期されません。
> タスタスでは登録時に名前は任意項目のため、名前未入力のワーカーが存在します。

#### 性別（gender）

| タスタス側の値 | TasLink APIに送信される値 |
|-------------|----------------------|
| `"男性"` | `"MALE"` |
| `"女性"` | `"FEMALE"` |
| `"その他"` | `"OTHER"` |
| `null` / 未設定 | `"UNSPECIFIED"` |
| 上記以外の値 | `"UNSPECIFIED"` |

#### 就業形態希望（workPreference）

| タスタス側の値 | TasLink APIに送信される値 |
|-------------|----------------------|
| `"単発"` / `"単発希望"` | `"ONE_TIME"` |
| `"継続"` / `"継続希望"` | `"ONGOING"` |
| `"どちらも"` / `"どちらも可"` | `"BOTH"` |
| `null` / 未設定 / 上記以外 | フィールド自体が送信されない |

#### 資格 → 職種マスタ（jobTypes）

タスタスの `qualifications` 配列を、TasLinkの職種マスタ値に変換します。

| タスタス側の資格名 | TasLink jobTypes |
|----------------|-----------------|
| `"看護師"` | `"看護師"` |
| `"准看護師"` | `"准看護師"` |
| `"介護士"` | `"介護士"` |
| `"介護福祉士"` | `"介護福祉士"` |
| `"初任者研修"` | `"初任者研修"` |
| `"実務者研修"` | `"実務者研修"` |
| `"理学療法士"` | `"理学療法士"` |
| `"作業療法士"` | `"作業療法士"` |
| 上記以外 | `"その他"` |

#### 資格 → 資格マスタ（qualifications）

同じ `qualifications` 配列を、TasLinkの資格マスタ値に変換します（名称が異なる点に注意）。

| タスタス側の資格名 | TasLink qualifications |
|----------------|----------------------|
| `"看護師"` | `"看護師免許"` |
| `"准看護師"` | `"准看護師免許"` |
| `"介護福祉士"` | `"介護福祉士"` |
| `"初任者研修"` | `"介護職員初任者研修"` |
| `"実務者研修"` | `"介護職員実務者研修"` |
| `"社会福祉士"` | `"社会福祉士"` |
| `"理学療法士"` | `"理学療法士"` |
| `"作業療法士"` | `"作業療法士"` |
| `"言語聴覚士"` | `"言語聴覚士"` |
| `"管理栄養士"` | `"管理栄養士"` |
| `"栄養士"` | `"栄養士"` |
| `"保育士"` | `"保育士"` |
| 上記以外 | `"その他"` |

> **暫定実装について:** タスタスの資格リストとTasLinkのマスタが完全には一致しません。
> マッピングにない資格は全て `"その他"` になります。
> 新しい資格が追加された場合は `src/lib/taslink.ts` の `JOB_TYPE_MAP` と `QUALIFICATION_MAP` を更新してください。

#### 生年月日（dateOfBirth）

```
タスタスDB: birth_date (DateTime型、UTC保存)
   ↓ JST (UTC+9) に変換してから日付部分のみ取得
TasLink API: dateOfBirth = "1990-01-15" (ISO 8601 日付文字列)
```

> **なぜJST変換が必要か:** サーバーはUTC環境で動作しています。DBに `1990-01-15T00:00:00+09:00` (JST)
> として保存された日付を `.toISOString()` で変換すると `1989-01-14T15:00:00.000Z` となり、
> 日付部分が1日ズレます。これを防ぐためJST (+9時間) に補正してから日付文字列を生成しています。

#### 送信されないフィールド

以下のタスタス側フィールドはTasLinkに**送信されません**:

| フィールド | 理由 |
|-----------|------|
| `password_hash` | セキュリティ上送信不可 |
| `profile_image` / `id_document` / `bank_book_image` | ファイルURL（Supabase Storage内部URL） |
| `bank_code` / `bank_name` / `account_number` 等 | 銀行口座情報（機密性が高い） |
| `emergency_*` | 緊急連絡先（機密性が高い） |
| `pension_number` | 年金番号（機密性が高い） |
| `lat` / `lng` | 緯度経度（TasLink側で住所からジオコーディングする） |
| `is_suspended` / `deleted_at` | タスタス側のアカウント状態（TasLink側で別管理） |

---

## 5. API呼び出しの詳細

### リクエスト

```
POST {TASLINK_API_URL}/api/v1/external/workers
Content-Type: application/json
x-api-key: {TASLINK_API_KEY}
```

```json
{
  "externalId": "42",
  "lastName": "田中",
  "firstName": "花子",
  "lastNameKana": "たなか",
  "firstNameKana": "はなこ",
  "gender": "FEMALE",
  "dateOfBirth": "1990-01-15",
  "phone": "090-1234-5678",
  "email": "tanaka@example.com",
  "postalCode": "160-0023",
  "prefecture": "東京都",
  "city": "新宿区",
  "address": "西新宿1-1-1",
  "jobTypes": ["看護師"],
  "qualifications": ["看護師免許"],
  "availableDays": ["月", "火", "水", "木", "金"],
  "workPreference": "ONGOING",
  "workHistory": "○○病院 3年\n△△クリニック 2年",
  "notes": "日勤のみ希望です。"
}
```

### レスポンスの扱い

```
200 or 201 → 成功。レスポンスJSONから id を取得してDBに保存
400        → バリデーションエラー。ログ出力のみ
401        → APIキー無効。ログ出力のみ
429        → レート制限。ログ出力のみ
その他      → 汎用エラー。ログ出力のみ
```

**レスポンスのパース（要確認ポイント）:**

現在、レスポンスのIDを以下のように取得しています:

```typescript
const tasLinkId = String(data.id ?? data.data?.id ?? '');
```

TasLink APIの実際のレスポンス形式によっては調整が必要です:

| レスポンス形式 | 現在のコードで取得できるか |
|-------------|---------------------|
| `{ "id": "abc123" }` | OK |
| `{ "data": { "id": "abc123" } }` | OK |
| `{ "data": { "workerId": "abc123" } }` | NG → `data.data?.workerId` を追加する必要あり |
| `{ "worker": { "id": "abc123" } }` | NG → `data.worker?.id` を追加する必要あり |

---

## 6. 環境変数の設定

| 環境変数名 | 説明 | 例 |
|-----------|------|---|
| `TASLINK_API_URL` | TasLink APIのベースURL（末尾スラッシュなし） | `https://taslink.example.com` |
| `TASLINK_API_KEY` | TasLinkから発行されたAPIキー | `tlk_xxxxxxxxxx` |

### 設定方法

1. **Vercelダッシュボード** → Settings → Environment Variables
2. 上記2つの環境変数を追加
3. 対象環境を選択（Production / Preview / Development）
4. **Redeploy** して反映

### 環境変数が未設定の場合

同期処理は自動的にスキップされます（エラーにはなりません）。
ログに `[TasLink] Not configured` と出力されます。

```
開発環境で環境変数を設定しない → TasLink同期はスキップされる → 開発作業に影響なし
```

---

## 7. DBスキーマの変更

`users` テーブルに2つのカラムが追加されています:

| カラム名 | 型 | 説明 |
|---------|---|------|
| `taslink_id` | `String?` (nullable) | TasLink APIから返された内部ID |
| `taslink_synced_at` | `DateTime?` (nullable) | 最後に同期が成功した日時 |

- 未連携のワーカーは両方 `null`
- 同期成功時に自動的に値がセットされる
- **手動で変更する必要はありません**

### デプロイ時の適用方法

```bash
npx prisma db push
```

> このコマンドはユーザー（管理者）が手動で実行する必要があります。

---

## 8. ファイル構成

```
src/lib/taslink.ts                        ← メインのAPIクライアント（全ロジックがここ）
app/api/auth/register/route.ts            ← 登録フローからの呼び出し（4行追加）
src/lib/actions/user-profile.ts           ← プロフィール更新からの呼び出し（2箇所）
prisma/schema.prisma                      ← DBスキーマ（taslink_id, taslink_synced_at 追加）
```

### `src/lib/taslink.ts` の構造

```
行 1-12    : ファイルヘッダー（TasLink開発者向けメモ）
行 14-17   : 環境変数の読み込み
行 19-71   : 型定義（TasLinkWorkerPayload, TasLinkSyncResult, UserDataForSync）
行 73-107  : マッピング定数（JOB_TYPE_MAP, QUALIFICATION_MAP）
行 109-169 : マッピング関数（gender, workPreference, jobTypes, qualifications, name分割, 日付変換）
行 171-210 : mapUserToTasLinkPayload() — Userデータ → APIペイロード変換
行 212-289 : syncWorkerToTasLink() — API呼び出し + DB保存
```

---

## 9. TasLink開発者向け: 要確認・要調整ポイント

### 必須確認

| # | 項目 | 詳細 | 対応ファイル・行 |
|---|------|------|----------------|
| 1 | **APIレスポンス形式** | 成功時のレスポンスで、ワーカーIDがどのキーで返されるか確認。現在は `data.id` または `data.data.id` を想定 | `src/lib/taslink.ts` L244 |
| 2 | **必須フィールドの空文字許容** | `firstName` が空文字 `""` でも受け入れるか。姓のみのワーカーが存在する | TasLink API仕様 |
| 3 | **upsert時の部分更新** | 同じ `externalId` で再送信時、送信しなかったフィールドはどうなるか（null上書き or 維持）。現在は全フィールドを毎回送信している | TasLink API仕様 |

### 推奨確認

| # | 項目 | 詳細 |
|---|------|------|
| 4 | **jobTypes/qualificationsマッピング** | 現在のマッピング表（上記セクション4.2参照）に不足がないか確認。タスタスに存在するがTasLinkマスタにない資格は `"その他"` になる |
| 5 | **workPreferenceマッピング** | タスタス側の就業形態の選択肢が今後追加された場合、マッピングの更新が必要 |
| 6 | **レート制限** | 大量の会員が同時にプロフィール更新した場合の429対応。現在はリトライなし |
| 7 | **registrationSourceフィールド** | TasLink API仕様に `registrationSource` があるが、現在は未送信。必要であれば追加可能 |

---

## 10. よくある質問（FAQ）

### Q: TasLink APIが落ちていたら、ワーカーの登録やプロフィール更新もできなくなりますか？

**A: いいえ。** TasLink同期は try-catch で囲まれており、エラーはログ出力のみです。タスタス側の処理は必ず正常に完了します。

### Q: 環境変数を設定しないとエラーになりますか？

**A: いいえ。** 環境変数 `TASLINK_API_URL` / `TASLINK_API_KEY` が未設定の場合、同期処理は自動的にスキップされます。開発環境では設定不要です。

### Q: 同じワーカーが何度もプロフィールを更新したら、TasLinkにデータが重複しますか？

**A: いいえ。** `externalId`（タスタスの user.id）を毎回送信しているため、TasLink側でupsert（同じIDなら更新）されます。

### Q: 管理者がワーカーのプロフィールを編集した場合も同期されますか？

**A: 現時点ではいいえ。** 現在はワーカー自身の操作（登録・プロフィール編集・自己PR編集）のみがトリガーです。管理者によるプロフィール直接編集機能は現時点で存在しません。将来追加された場合は、その箇所にも同期フックを追加する必要があります。

### Q: 新しい資格がタスタスに追加されたら？

**A: `src/lib/taslink.ts` の `JOB_TYPE_MAP` と `QUALIFICATION_MAP` を更新してください。** マッピングにない資格は自動的に `"その他"` として送信されます。

### Q: TasLinkのAPIキーをローテーションしたら？

**A: Vercelダッシュボードで `TASLINK_API_KEY` を更新し、Redeployしてください。** コード変更は不要です。
