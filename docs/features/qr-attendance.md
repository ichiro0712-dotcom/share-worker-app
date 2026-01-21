# QRコード勤怠管理機能 - 要件定義

> **作成日**: 2026-01-15
> **最終更新**: 2026-01-21
> **ステータス**: 実装完了（テスト中）
> **ブランチ**: `feature/qr-attendance`
> **参照資料**: カイテクヘルプセンター仕様

---

## 1. 機能概要

ワーカーが施設に掲示されたQRコードをスキャンして出勤・退勤を記録するシステム。
打刻実績が定刻と異なる場合は「勤怠変更申請」を行い、施設側が承認する。

### 1.1 主要ユーザーと操作

| ユーザー | 主な操作 |
|---------|---------|
| **ワーカー** | QRコードスキャン/緊急時番号入力で出退勤、勤怠変更申請 |
| **施設管理者** | QRコード印刷、勤怠変更申請の承認/却下、利用明細確認 |
| **システム管理者** | 勤務実績管理、CSV出力、全体の勤怠データ管理 |

---

## 2. 現状の実装状況

### 2.1 実装済み

| コンポーネント | ファイル | 状態 |
|---------------|---------|------|
| DBスキーマ（Attendance） | `prisma/schema.prisma` | ✅ 完成 |
| DBスキーマ（AttendanceModificationRequest） | `prisma/schema.prisma` | ✅ 完成 |
| Facilityモデル（緊急時番号・QRトークン） | `prisma/schema.prisma` | ✅ 完成 |
| QR印刷ページ（施設側） | `app/admin/attendance/page.tsx` | ✅ 完成 |
| QRスキャンページ（ワーカー側） | `app/attendance/page.tsx` | ✅ 完成 |
| 勤怠変更申請ページ（ワーカー側） | `app/attendance/modify/page.tsx` | ✅ 完成 |
| 勤怠承認一覧（施設側） | `app/admin/tasks/attendance/page.tsx` | ✅ 完成 |
| 勤怠承認詳細（施設側） | `app/admin/tasks/attendance/[id]/page.tsx` | ✅ 完成 |
| 出退勤記録API | `src/lib/actions/attendance.ts` | ✅ 完成 |
| 勤怠管理API（施設側） | `src/lib/actions/attendance-admin.ts` | ✅ 完成 |
| 施設情報取得API | `app/api/admin/facility/route.ts` | ✅ 完成 |
| 型定義 | `src/types/attendance.ts` | ✅ 完成 |
| 給与計算ユーティリティ | `src/lib/salary-calculator.ts` | ✅ 完成 |
| ライブラリ | `qrcode`, `html5-qrcode` | ✅ 導入済み |

### 2.2 コンポーネント（実装済み）

| コンポーネント | ファイル | 説明 |
|---------------|---------|------|
| EmergencyCodeInput | `components/attendance/EmergencyCodeInput.tsx` | 緊急時番号入力 |
| CheckOutSelector | `components/attendance/CheckOutSelector.tsx` | 退勤タイプ選択 |
| AttendanceStatus | `components/attendance/AttendanceStatus.tsx` | 出勤状態表示 |
| ModificationForm | `components/attendance/ModificationForm.tsx` | 勤怠変更申請フォーム |
| DifferenceConfirm | `components/attendance/DifferenceConfirm.tsx` | 差額確認画面 |
| ModificationRequestList | `components/admin/attendance/ModificationRequestList.tsx` | 申請一覧（施設側） |
| ModificationRequestDetail | `components/admin/attendance/ModificationRequestDetail.tsx` | 申請詳細（施設側） |

### 2.3 未実装・今後の課題

| 項目 | 優先度 | 備考 |
|------|--------|------|
| 利用明細（施設管理者側） | 中 | CSV出力機能 |
| 勤務実績管理（システム管理者側） | 中 | クロスナビ連携用 |
| ワーカー向け勤怠履歴 | 低 | マイページ統合 |
| 未出勤アラート | 中 | 勤務開始時間超過時の警告 |
| 通知機能（承認/却下時） | 中 | アプリ内通知・メール通知 |

---

## 3. 施設管理者向け機能

### 3.1 QRコード印刷ページ

**アクセス**: `/admin/attendance`

#### 3.1.1 表示内容

```
┌─────────────────────────────────────────────────┐
│  [+TASTASロゴ]                    [施設名]      │
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌─────────────┐     出退勤方法（+TASTASアプリ）│
│   │             │     ① ログイン               │
│   │  QRコード   │     ② 仕事管理画面           │
│   │             │     ③ 出勤/退勤ボタン        │
│   └─────────────┘     ④ QRコード読取           │
│                                                 │
│   緊急時出退勤番号：XXXX                        │
│   □ 出退勤番号を印刷する                       │
│                                                 │
│   [QRコードを再発行]                            │
├─────────────────────────────────────────────────┤
│  下記の場合必ず勤怠変更申請が必要です           │
│  ┌──────────────────┬──────────────────┐        │
│  │ 遅刻・早退       │ QR読取：必要    │        │
│  │ 前残業・後残業   │ QR読取：必要    │        │
│  │ 読み取りエラー   │ QR読取：不要    │        │
│  │ 携帯が利用不可   │ QR読取：不要    │        │
│  │ 番号での出退勤   │ QR読取：不要    │        │
│  └──────────────────┴──────────────────┘        │
├─────────────────────────────────────────────────┤
│  +TASTASよりワーカーの皆様へ       [お問合せQR] │
│  本日はご勤務くださり...                        │
├─────────────────────────────────────────────────┤
│                  [印刷]                         │
└─────────────────────────────────────────────────┘
```

#### 3.1.2 機能（実装済み）

| 機能 | 説明 | 実装状況 |
|------|------|---------|
| QRコード表示 | 施設固有のQRコードを表示 | ✅ |
| 緊急時番号表示 | 4桁の緊急時出退勤番号を表示（トグルで表示/非表示切替） | ✅ |
| 番号印刷トグル | 緊急時番号を印刷に含めるか選択 | ✅ |
| 再発行ボタン | QRコードを再発行（緊急時番号は変更されない） | ✅ |
| 印刷ボタン | ブラウザ印刷機能で印刷 | ✅ |

#### 3.1.3 QRコード仕様

- **形式**: 施設単位で固定
- **データ**: `attendance:{facilityId}:{secretToken}`
- **再発行**: ボタンクリックで`secretToken`を更新（緊急時番号は維持）

### 3.2 勤怠承認機能（タスクメニュー）

**アクセス**: `/admin/tasks/attendance`

#### 3.2.1 一覧画面（実装済み）

| 表示項目 | 説明 |
|---------|------|
| ステータスフィルター | すべて / 未承認 / 再申請 / 承認済み / 却下 |
| ワーカー名 | 申請者名 |
| 求人名 | 勤務した求人のタイトル |
| 勤務日 | 勤務日 |
| 申請状況 | PENDING / RESUBMITTED / APPROVED / REJECTED |
| 申請日時 | ワーカーが申請を登録した日時 |

#### 3.2.2 詳細画面（実装済み）

**表示内容**:
- 定刻の出勤時間、退勤時間、休憩時間
- 打刻時間（実際のQR読取/番号入力時刻）
- 申請の出勤時間、退勤時間、休憩時間
- 金額計算（定刻金額、申請金額、差額）
- ワーカーの申請コメント

**操作**:
- 事業所管理者コメント欄（**入力必須**）
- 「承認する」ボタン
- 「却下する」ボタン

#### 3.2.3 承認却下フロー

```
ワーカー申請 → 施設が却下 → ワーカーに通知（未実装）
                          → 再申請ボタン表示
                          → 再申請後、ステータス「RESUBMITTED」に
```

### 3.3 利用明細（帳票）

**ステータス**: ❌ 未実装

**アクセス**: 管理画面右上「帳票」→「利用明細」（予定）

---

## 4. 勤怠実績の決定ロジック（重要）

### 4.1 打刻時間と実績時間の違い

| 項目 | 説明 |
|------|------|
| **打刻時間** | 実際にQRコードを読み取った/番号を入力した時刻。常に記録・保持する |
| **実績時間** | 給与計算の基準となる勤務時間。ロジックに基づいて決定される |

### 4.2 出勤実績の決定ロジック

```
出勤打刻時間 vs 定刻開始時間
├─ 打刻 ≤ 定刻 → 出勤実績 = 定刻開始時間（早く来ても定刻扱い）
└─ 打刻 > 定刻 → 遅刻扱い → 退勤時に勤怠変更申請が必須
```

| 出勤打刻 | 定刻開始 | 出勤実績 | 退勤時の処理 |
|---------|---------|---------|-------------|
| 08:50 | 09:00 | **09:00**（定刻） | 通常退勤可 |
| 09:00 | 09:00 | **09:00**（定刻） | 通常退勤可 |
| 09:05 | 09:00 | - | **勤怠変更申請必須** |

### 4.3 退勤実績の決定ロジック

#### 4.3.1 正常出勤の場合（出勤打刻 ≤ 定刻開始）

退勤時に2つのボタンが表示される（CheckOutSelectorコンポーネント）：

```
┌─────────────────────────────────────┐
│  残業などを実施した場合             │
│  [退勤後、勤怠変更申請する]         │
│                                     │
│  定刻通りの勤務であった場合         │
│  [定刻で退勤する]                   │
└─────────────────────────────────────┘
```

| 選択 | 退勤タイプ | 勤怠変更申請 |
|------|---------|-------------|
| 【定刻で退勤する】 | `ON_TIME` | 不要（自動確定） |
| 【退勤後、勤怠変更申請する】 | `MODIFICATION_REQUIRED` | 必要（施設承認必要） |

#### 4.3.2 遅刻または緊急番号使用の場合

退勤時に「勤怠変更申請する」ボタンのみ表示（選択肢なし）

### 4.4 勤怠変更申請が必要なケース

| ケース | 定義 | 申請 |
|--------|------|------|
| 定刻どおり | 出勤打刻≤定刻開始 かつ 「定刻で退勤する」選択 | **不要** |
| 遅刻 | 出勤打刻 > 定刻開始 | **必須** |
| 早退 | 定刻終了時間より前に退勤したい | **必須** |
| 残業 | 定刻終了時間より後に退勤したい | **必須** |
| 緊急時番号使用 | QRではなく4桁番号で出退勤 | **必須** |

---

## 5. ワーカー向け機能

### 5.1 出退勤リーダー

**アクセス**: `/attendance`

#### 5.1.1 機能（実装済み）

| 機能 | 説明 | 実装状況 |
|------|------|---------|
| 出勤/退勤切替 | 出勤中の場合は退勤モードに自動切替 | ✅ |
| QRコードスキャン | カメラでQRコードを読み取り | ✅ |
| 緊急時番号入力 | 4桁の番号を手入力 | ✅ |
| 退勤タイプ選択 | 定刻退勤 or 勤怠変更申請 | ✅ |
| 出勤状態表示 | 現在の出勤状態を表示 | ✅ |
| 位置情報取得 | GPS座標を記録（任意） | ✅ |

#### 5.1.2 出退勤リーダー画面

```
┌─────────────────────────────────────────┐
│              出退勤記録                  │
│  QRコードをスキャンしてください          │
├─────────────────────────────────────────┤
│  [出勤状態表示エリア]                   │
├─────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐                │
│  │  出勤  │  │  退勤  │                │
│  └────────┘  └────────┘                │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │       [カメラプレビュー]        │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ▼ QRコードが読み取れない場合           │
│         ┌────────────────┐             │
│         │     0000       │             │
│         └────────────────┘             │
│         [  出退勤を記録  ]              │
└─────────────────────────────────────────┘
```

### 5.2 勤怠変更申請

**アクセス**: `/attendance/modify?attendanceId={id}`

#### 5.2.1 申請が必要なケース

| ケース | 定義 |
|--------|------|
| 遅刻 | お仕事開始時間から**1分以上**経過して出勤 |
| 早退 | お仕事終了時間より**前**に退勤 |
| 残業 | お仕事終了時間を**1分以上**超過して退勤 |
| 緊急時番号使用 | 4桁の番号を入力して出退勤 |
| その他 | 何らかの事情で勤怠にズレが発生 |

#### 5.2.2 申請フォーム（実装済み）

- 勤務時間入力（開始・終了）
- 休憩時間入力（あり/なし、分数）
- コメント入力（必須）
- 差額確認画面で金額差を表示

#### 5.2.3 申請ステータス

| ステータス | DB値 | 説明 |
|-----------|------|------|
| 申請中 | `PENDING` | 施設が確認中 |
| 再申請 | `RESUBMITTED` | 却下後に再申請 |
| 承認済み | `APPROVED` | 施設が承認、給与に反映 |
| 却下 | `REJECTED` | 施設が却下、再申請可能 |

#### 5.2.4 再申請ルール

- **再申請回数**: **無制限**（何度でも再申請可能）
- 却下時は却下理由を確認し、修正して再申請
- 再申請カウントは`resubmit_count`フィールドで管理

### 5.3 緊急時出退勤番号

#### 5.3.1 仕様

- **形式**: 4桁の数字
- **用途**: QRコードが読み取れない場合の代替手段
- **制限**: **5回連続**で誤入力すると入力欄が非表示になる
- **注意文**: 入力画面に「5回連続で誤入力すると入力欄が非表示になります」と注意文を表示
- **注意**: 番号使用時は**必ず**勤怠変更申請が必要

---

## 6. DBスキーマ

### 6.1 Attendanceモデル

```prisma
model Attendance {
  id              Int       @id @default(autoincrement())
  user_id         Int       @map("user_id")
  facility_id     Int       @map("facility_id")
  application_id  Int?      @map("application_id")
  job_id          Int?      @map("job_id")

  // 打刻時間
  check_in_time   DateTime  @map("check_in_time")
  check_out_time  DateTime? @map("check_out_time")

  // 位置情報
  check_in_lat    Float?    @map("check_in_lat")
  check_in_lng    Float?    @map("check_in_lng")
  check_out_lat   Float?    @map("check_out_lat")
  check_out_lng   Float?    @map("check_out_lng")

  // 打刻方法
  check_in_method   String    @default("QR") @map("check_in_method")   // "QR" | "EMERGENCY_CODE"
  check_out_method  String?   @map("check_out_method")                 // "QR" | "EMERGENCY_CODE"

  // 退勤タイプ
  check_out_type    String?   @map("check_out_type")  // "ON_TIME" | "MODIFICATION_REQUIRED"

  // ステータス
  status          String    @default("CHECKED_IN") // "CHECKED_IN" | "CHECKED_OUT"

  // 実績時間（承認後に設定）
  actual_start_time DateTime? @map("actual_start_time")
  actual_end_time   DateTime? @map("actual_end_time")
  actual_break_time Int?      @map("actual_break_time")  // 分単位

  // 給与計算結果（承認後に設定）
  calculated_wage   Int?      @map("calculated_wage")

  created_at      DateTime  @default(now()) @map("created_at")
  updated_at      DateTime  @updatedAt @map("updated_at")

  // リレーション
  user            User        @relation(fields: [user_id], references: [id], onDelete: Cascade)
  facility        Facility    @relation(fields: [facility_id], references: [id], onDelete: Cascade)
  application     Application? @relation(fields: [application_id], references: [id], onDelete: SetNull)
  job             Job?        @relation(fields: [job_id], references: [id], onDelete: SetNull)
  modificationRequest AttendanceModificationRequest?

  @@index([user_id, created_at])
  @@index([facility_id, created_at])
  @@index([application_id])
  @@index([status])
  @@map("attendances")
}
```

### 6.2 AttendanceModificationRequestモデル

```prisma
model AttendanceModificationRequest {
  id                    Int       @id @default(autoincrement())
  attendance_id         Int       @unique @map("attendance_id")

  // 申請内容
  requested_start_time  DateTime  @map("requested_start_time")
  requested_end_time    DateTime  @map("requested_end_time")
  requested_break_time  Int       @default(0) @map("requested_break_time") // 分単位
  worker_comment        String    @db.Text @map("worker_comment")

  // ステータス
  // PENDING: 申請中
  // APPROVED: 承認済み
  // REJECTED: 却下済み
  // RESUBMITTED: 再申請
  status                String    @default("PENDING")

  // 承認情報
  admin_comment         String?   @db.Text @map("admin_comment")
  reviewed_by           Int?      @map("reviewed_by")
  reviewed_at           DateTime? @map("reviewed_at")

  // 金額計算
  original_amount       Int       @map("original_amount")    // 定刻での金額
  requested_amount      Int       @map("requested_amount")   // 申請での金額

  // 再申請回数
  resubmit_count        Int       @default(0) @map("resubmit_count")

  created_at            DateTime  @default(now()) @map("created_at")
  updated_at            DateTime  @updatedAt @map("updated_at")

  // リレーション
  attendance            Attendance @relation(fields: [attendance_id], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([created_at])
  @@map("attendance_modification_requests")
}
```

### 6.3 Facilityモデル（勤怠関連フィールド）

```prisma
model Facility {
  // ... 既存フィールド ...

  // 勤怠関連
  emergency_attendance_code  String?   @map("emergency_attendance_code") // 4桁の緊急時出退勤番号
  qr_secret_token           String?   @map("qr_secret_token")           // QRコード検証用トークン
  qr_generated_at           DateTime? @map("qr_generated_at")          // QRコード生成日時

  // ... 既存リレーション ...
}
```

---

## 7. 画面一覧

### 7.1 ワーカー向け

| パス | 画面名 | 状態 |
|------|--------|------|
| `/attendance` | 出退勤リーダー | ✅ 実装済み |
| `/attendance/modify` | 勤怠変更申請 | ✅ 実装済み |
| `/mypage/applications` | 仕事管理（勤怠状態表示） | ✅ 実装済み |

### 7.2 施設管理者向け

| パス | 画面名 | 状態 |
|------|--------|------|
| `/admin/attendance` | QR印刷 | ✅ 実装済み |
| `/admin/tasks/attendance` | 勤怠承認一覧 | ✅ 実装済み |
| `/admin/tasks/attendance/[id]` | 勤怠承認詳細 | ✅ 実装済み |
| `/admin/reports/usage` | 利用明細 | ❌ 未実装 |

### 7.3 システム管理者向け

| パス | 画面名 | 状態 |
|------|--------|------|
| `/system-admin/attendance` | 勤務実績管理 | ❌ 未実装 |

---

## 8. 開発フェーズ

### フェーズ1: 基本機能（高優先度） - ✅ 完了

- [x] 施設：QRコード再発行機能
- [x] 施設：緊急時出退勤番号の発行・表示
- [x] ワーカー：出退勤リーダー改修（緊急時番号対応）
- [x] ワーカー：応募との自動紐付け
- [x] ワーカー：退勤時の状況選択UI

### フェーズ2: 勤怠変更申請（高優先度） - ✅ 完了

- [x] ワーカー：勤怠変更申請フォーム
- [x] ワーカー：差額確認画面
- [x] ワーカー：申請ステータス表示（仕事管理の勤怠タブ）
- [ ] ワーカー：未出勤アラート

### フェーズ3: 施設側承認機能（高優先度） - ✅ 完了

- [x] 施設：タスクメニュー追加
- [x] 施設：勤怠変更承認一覧
- [x] 施設：勤怠変更承認詳細・承認/却下
- [x] ワーカー：再申請機能
- [ ] ワーカー：承認却下通知

### フェーズ4: 管理・出力機能（中優先度） - 未着手

- [ ] 施設：利用明細画面
- [ ] 施設：CSV出力
- [ ] システム管理者：勤務実績管理画面
- [ ] システム管理者：CSV出力（クロスナビ形式）

### フェーズ5: 履歴・その他（低優先度） - 未着手

- [ ] ワーカー：勤怠履歴画面
- [ ] 給与管理への反映（将来のVerUP）

---

## 9. 給与計算ロジック

### 9.1 計算の基本構造（3つのブロック）

給与は以下の3つのブロックに分けて計算し、最後に合算する。

| ブロック | 説明 | 倍率 |
|---------|------|------|
| ① ベース給与 | 実働時間すべてに対する基本給 | 1.0倍 |
| ② 残業手当 | 8時間超過分に対する割増 | +0.25倍 |
| ③ 深夜手当 | 22:00〜翌5:00の勤務に対する割増 | +0.25倍 |

### 9.2 倍率の適用パターン

| 時間帯 | 8時間以内 | 8時間超過 |
|--------|----------|----------|
| 通常時間帯（5:00〜22:00） | 1.0倍 | 1.25倍（残業） |
| 深夜時間帯（22:00〜翌5:00） | 1.25倍（深夜） | 1.5倍（深夜+残業） |

### 9.3 実装ファイル

**ファイル**: `src/lib/salary-calculator.ts`

---

## 10. 注意事項・ビジネスルール

### 10.1 勤怠変更申請

- 申請が**承認されるまで**給与に反映されない
- 早期引出は申請中は不可
- 承認が翌月以降になった場合、承認された月の給与として反映

### 10.2 残業について

- **必ず事業所様と合意の上**で残業を行うこと
- ワーカーの判断で残業しても却下される可能性あり
- 残業依頼がない場合は速やかに退勤処理を行う

### 10.3 緊急時出退勤番号

- 番号使用時は**必ず**勤怠変更申請が必要
- **5回連続**で誤入力すると入力欄が非表示になる
- 入力画面に注意文を表示

### 10.4 未出勤アラート（未実装）

- 勤務開始時間を**即時過ぎた時点**でアラート画面に切り替わる（QR未読み取りの場合）
- 出勤処理 or お問い合わせフォーム以外の操作が不可になる
- お仕事終了日から1週間ご連絡がない場合、一時的にアカウント利用停止

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-15 | 初版作成。現状の実装を整理。 |
| 2026-01-15 | PDF資料（TASTAS仕様書、カイテクヘルプ）を基に詳細仕様を追記。 |
| 2026-01-15 | 給与計算ロジック（セクション9）を追加。深夜・残業手当の計算方式を明記。 |
| 2026-01-15 | 未確定事項を確定：緊急時番号誤入力制限(5回)、未出勤アラート(即時)、再申請(無制限)、通知(アプリ内+メール)。 |
| 2026-01-21 | 実装完了に伴い全面更新。実装済みコンポーネント一覧追加、DBスキーマを実装版に更新、画面一覧・開発フェーズの状態更新。 |
