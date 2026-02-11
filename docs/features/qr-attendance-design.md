# QRコード勤怠管理機能 - システム設計書

> **作成日**: 2026-01-15
> **最終更新**: 2026-01-15
> **ステータス**: 設計中
> **ブランチ**: `feature/qr-attendance`
> **関連**: [要件定義書](./qr-attendance.md)

---

## 1. 設計概要

### 1.1 設計方針

- **既存アーキテクチャとの整合性**: Next.js App Router + Server Actions パターンを踏襲
- **段階的実装**: フェーズ分けによる漸進的リリース
- **型安全性**: TypeScript strict mode での実装
- **パフォーマンス**: インデックス最適化、キャッシュ戦略の適用

### 1.2 影響範囲

| 領域 | 変更内容 |
|------|---------|
| DBスキーマ | Attendance拡張、AttendanceModificationRequest新規、Facility拡張 |
| API | 出退勤API改修、勤怠変更申請API新規 |
| ワーカー画面 | 出退勤リーダー改修、勤怠変更申請新規 |
| 施設管理画面 | QR印刷改修、勤怠承認新規 |
| システム管理画面 | 勤務実績管理新規 |

---

## 2. データベース設計

### 2.1 ER図

```
┌──────────────────┐         ┌────────────────────────────────┐
│    Facility      │         │          Attendance            │
├──────────────────┤         ├────────────────────────────────┤
│ id               │◄────────│ facility_id (FK)               │
│ ...              │         │ user_id (FK)                   │
│ emergency_code   │         │ application_id (FK, nullable)  │
│ qr_secret_token  │         │ job_id (FK, nullable)          │
│ qr_generated_at  │         │                                │
└──────────────────┘         │ check_in_time                  │
                             │ check_out_time                 │
                             │ check_in_method                │
┌──────────────────┐         │ check_out_method               │
│      User        │         │ status                         │
├──────────────────┤         │ ...                            │
│ id               │◄────────│                                │
│ ...              │         └────────────┬───────────────────┘
└──────────────────┘                      │ 1:0..1
                                          │
                             ┌────────────▼───────────────────┐
                             │ AttendanceModificationRequest  │
                             ├────────────────────────────────┤
                             │ attendance_id (FK, unique)     │
                             │ requested_start_time           │
                             │ requested_end_time             │
                             │ requested_break_time           │
                             │ worker_comment                 │
                             │ status                         │
                             │ admin_comment                  │
                             │ reviewed_by                    │
                             │ reviewed_at                    │
                             │ original_amount                │
                             │ requested_amount               │
                             └────────────────────────────────┘
```

### 2.2 テーブル定義

#### 2.2.1 Attendance（既存拡張）

```prisma
model Attendance {
  id                Int       @id @default(autoincrement())
  user_id           Int       @map("user_id")
  facility_id       Int       @map("facility_id")
  application_id    Int?      @map("application_id")
  job_id            Int?      @map("job_id")

  // 打刻時間
  check_in_time     DateTime  @map("check_in_time")
  check_out_time    DateTime? @map("check_out_time")

  // 位置情報
  check_in_lat      Float?    @map("check_in_lat")
  check_in_lng      Float?    @map("check_in_lng")
  check_out_lat     Float?    @map("check_out_lat")
  check_out_lng     Float?    @map("check_out_lng")

  // 打刻方法（新規追加）
  check_in_method   String    @default("QR") @map("check_in_method")   // "QR" | "EMERGENCY_CODE"
  check_out_method  String?   @map("check_out_method")                 // "QR" | "EMERGENCY_CODE"

  // 退勤タイプ（新規追加）
  check_out_type    String?   @map("check_out_type")  // "ON_TIME" | "MODIFICATION_REQUIRED"

  // ステータス
  status            String    @default("CHECKED_IN") // "CHECKED_IN" | "CHECKED_OUT"

  // 実績時間（承認後に設定、新規追加）
  actual_start_time DateTime? @map("actual_start_time")
  actual_end_time   DateTime? @map("actual_end_time")
  actual_break_time Int?      @map("actual_break_time")  // 分単位

  // 給与計算結果（承認後に設定、新規追加）
  calculated_wage   Int?      @map("calculated_wage")

  created_at        DateTime  @default(now()) @map("created_at")
  updated_at        DateTime  @updatedAt @map("updated_at")

  // リレーション
  user              User        @relation(fields: [user_id], references: [id], onDelete: Cascade)
  facility          Facility    @relation(fields: [facility_id], references: [id], onDelete: Cascade)
  application       Application? @relation(fields: [application_id], references: [id], onDelete: SetNull)
  job               Job?        @relation(fields: [job_id], references: [id], onDelete: SetNull)
  modificationRequest AttendanceModificationRequest?

  @@index([user_id, created_at])
  @@index([facility_id, created_at])
  @@index([application_id])
  @@index([status])
  @@map("attendances")
}
```

#### 2.2.2 AttendanceModificationRequest（新規）

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

#### 2.2.3 Facility（既存拡張）

```prisma
model Facility {
  // ... 既存フィールド ...

  // 勤怠関連（新規追加）
  emergency_attendance_code  String?   @map("emergency_attendance_code") // 4桁の緊急時出退勤番号
  qr_secret_token           String?   @map("qr_secret_token")           // QRコード検証用トークン
  qr_generated_at           DateTime? @map("qr_generated_at")          // QRコード生成日時

  // ... 既存リレーション ...
}
```

### 2.3 インデックス設計

| テーブル | インデックス | 用途 |
|---------|-------------|------|
| Attendance | `[user_id, created_at]` | ワーカー別勤怠履歴 |
| Attendance | `[facility_id, created_at]` | 施設別勤怠一覧 |
| Attendance | `[application_id]` | 応募との紐付け検索 |
| Attendance | `[status]` | ステータス別フィルタ |
| AttendanceModificationRequest | `[status]` | 承認待ち一覧 |
| AttendanceModificationRequest | `[created_at]` | 時系列ソート |

### 2.4 マイグレーション計画

```sql
-- Phase 1: Attendance拡張
ALTER TABLE attendances
ADD COLUMN check_in_method VARCHAR(20) DEFAULT 'QR',
ADD COLUMN check_out_method VARCHAR(20),
ADD COLUMN check_out_type VARCHAR(30),
ADD COLUMN actual_start_time TIMESTAMP,
ADD COLUMN actual_end_time TIMESTAMP,
ADD COLUMN actual_break_time INTEGER,
ADD COLUMN calculated_wage INTEGER;

-- Phase 2: Facility拡張
ALTER TABLE facilities
ADD COLUMN emergency_attendance_code VARCHAR(4),
ADD COLUMN qr_secret_token VARCHAR(64),
ADD COLUMN qr_generated_at TIMESTAMP;

-- Phase 3: AttendanceModificationRequest新規
CREATE TABLE attendance_modification_requests (
  id SERIAL PRIMARY KEY,
  attendance_id INTEGER UNIQUE NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
  requested_start_time TIMESTAMP NOT NULL,
  requested_end_time TIMESTAMP NOT NULL,
  requested_break_time INTEGER DEFAULT 0,
  worker_comment TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  admin_comment TEXT,
  reviewed_by INTEGER,
  reviewed_at TIMESTAMP,
  original_amount INTEGER NOT NULL,
  requested_amount INTEGER NOT NULL,
  resubmit_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_amr_status ON attendance_modification_requests(status);
CREATE INDEX idx_amr_created_at ON attendance_modification_requests(created_at);
```

---

## 3. API設計

### 3.1 API一覧

| エンドポイント | メソッド | 用途 | 認証 |
|---------------|---------|------|------|
| `/api/attendance/record` | POST | 出退勤打刻（既存改修） | Worker |
| `/api/attendance/check-in-status` | GET | 出勤状態確認 | Worker |
| `/api/attendance/modification` | POST | 勤怠変更申請作成 | Worker |
| `/api/attendance/modification` | GET | 勤怠変更申請一覧取得 | Worker |
| `/api/attendance/modification/[id]` | PUT | 勤怠変更申請更新（再申請） | Worker |
| `/api/admin/attendance/qr` | POST | QRコード再発行 | FacilityAdmin |
| `/api/admin/attendance/requests` | GET | 勤怠承認一覧 | FacilityAdmin |
| `/api/admin/attendance/requests/[id]` | GET | 勤怠承認詳細 | FacilityAdmin |
| `/api/admin/attendance/requests/[id]/approve` | POST | 承認 | FacilityAdmin |
| `/api/admin/attendance/requests/[id]/reject` | POST | 却下 | FacilityAdmin |
| `/api/system-admin/attendance` | GET | 勤務実績一覧 | SystemAdmin |
| `/api/system-admin/attendance/export` | GET | CSV出力 | SystemAdmin |

### 3.2 API詳細設計

#### 3.2.1 出退勤打刻 API（改修）

**POST `/api/attendance/record`**

```typescript
// Request
interface AttendanceRecordRequest {
  type: 'check_in' | 'check_out';
  method: 'QR' | 'EMERGENCY_CODE';

  // QRコードの場合
  facilityId?: number;
  qrToken?: string;

  // 緊急時番号の場合
  emergencyCode?: string;

  // 位置情報
  latitude?: number;
  longitude?: number;

  // 退勤の場合
  checkOutType?: 'ON_TIME' | 'MODIFICATION_REQUIRED';

  // 自動紐付け用
  applicationId?: number;
}

// Response
interface AttendanceRecordResponse {
  success: boolean;
  attendanceId: number;
  message: string;

  // 退勤時の追加情報
  requiresModification?: boolean;  // 勤怠変更申請が必要か
  isLate?: boolean;                // 遅刻だったか
  scheduledTime?: {
    startTime: string;
    endTime: string;
    breakTime: number;
  };
}
```

**ビジネスロジック:**

```typescript
// 出勤処理
async function processCheckIn(request: AttendanceRecordRequest): Promise<AttendanceRecordResponse> {
  // 1. QRコード/緊急番号の検証
  const facility = await validateAttendanceMethod(request);

  // 2. 当日の応募を自動紐付け
  const application = await findTodayApplication(userId, facility.id);

  // 3. 出勤打刻時間 vs 定刻開始時間
  const scheduledStartTime = getScheduledStartTime(application);
  const isLate = new Date() > scheduledStartTime;

  // 4. 出勤記録作成
  const attendance = await createAttendance({
    userId,
    facilityId: facility.id,
    applicationId: application?.id,
    jobId: application?.jobId,
    checkInTime: new Date(),
    checkInMethod: request.method,
    checkInLat: request.latitude,
    checkInLng: request.longitude,
    status: 'CHECKED_IN'
  });

  return {
    success: true,
    attendanceId: attendance.id,
    isLate,
    message: isLate
      ? '出勤を記録しました。遅刻のため退勤時に勤怠変更申請が必要です。'
      : '出勤を記録しました。'
  };
}

// 退勤処理
async function processCheckOut(request: AttendanceRecordRequest): Promise<AttendanceRecordResponse> {
  // 1. 出勤記録の取得
  const attendance = await getActiveAttendance(userId);

  // 2. 遅刻判定（出勤時に記録済み）
  const isLate = checkIsLate(attendance);

  // 3. 緊急番号使用判定
  const usedEmergencyCode = attendance.check_in_method === 'EMERGENCY_CODE'
    || request.method === 'EMERGENCY_CODE';

  // 4. 勤怠変更申請が必要か判定
  const requiresModification = isLate
    || usedEmergencyCode
    || request.checkOutType === 'MODIFICATION_REQUIRED';

  // 5. 退勤記録更新
  await updateAttendance(attendance.id, {
    checkOutTime: new Date(),
    checkOutMethod: request.method,
    checkOutType: request.checkOutType,
    checkOutLat: request.latitude,
    checkOutLng: request.longitude,
    status: 'CHECKED_OUT',
    // 定刻退勤の場合は実績時間を自動設定
    ...(request.checkOutType === 'ON_TIME' && !requiresModification ? {
      actualStartTime: scheduledStartTime,
      actualEndTime: scheduledEndTime,
      actualBreakTime: scheduledBreakTime,
      calculatedWage: calculateWage(...)
    } : {})
  });

  return {
    success: true,
    attendanceId: attendance.id,
    requiresModification,
    message: requiresModification
      ? '退勤を記録しました。勤怠変更申請を行ってください。'
      : '退勤を記録しました。'
  };
}
```

#### 3.2.2 勤怠変更申請 API

**POST `/api/attendance/modification`**

```typescript
// Request
interface CreateModificationRequest {
  attendanceId: number;
  requestedStartTime: string;  // ISO 8601
  requestedEndTime: string;    // ISO 8601
  requestedBreakTime: number;  // 分
  workerComment: string;
}

// Response
interface CreateModificationResponse {
  success: boolean;
  modificationId: number;
  originalAmount: number;
  requestedAmount: number;
  difference: number;
}
```

**ビジネスロジック:**

```typescript
async function createModificationRequest(
  request: CreateModificationRequest
): Promise<CreateModificationResponse> {
  const attendance = await getAttendance(request.attendanceId);
  const application = await getApplication(attendance.applicationId);

  // 定刻の金額計算
  const originalAmount = calculateSalary({
    startTime: application.scheduledStartTime,
    endTime: application.scheduledEndTime,
    breakMinutes: application.scheduledBreakTime,
    hourlyRate: application.hourlyWage
  }).totalPay;

  // 申請内容の金額計算
  const requestedAmount = calculateSalary({
    startTime: new Date(request.requestedStartTime),
    endTime: new Date(request.requestedEndTime),
    breakMinutes: request.requestedBreakTime,
    hourlyRate: application.hourlyWage
  }).totalPay;

  // 勤怠変更申請を作成
  const modification = await prisma.attendanceModificationRequest.create({
    data: {
      attendanceId: request.attendanceId,
      requestedStartTime: new Date(request.requestedStartTime),
      requestedEndTime: new Date(request.requestedEndTime),
      requestedBreakTime: request.requestedBreakTime,
      workerComment: request.workerComment,
      status: 'PENDING',
      originalAmount,
      requestedAmount
    }
  });

  // 施設への通知（アプリ内 + メール）
  await sendNotification({
    type: 'ATTENDANCE_MODIFICATION_REQUESTED',
    facilityId: attendance.facilityId,
    data: { modificationId: modification.id }
  });

  return {
    success: true,
    modificationId: modification.id,
    originalAmount,
    requestedAmount,
    difference: requestedAmount - originalAmount
  };
}
```

#### 3.2.3 勤怠承認 API

**POST `/api/admin/attendance/requests/[id]/approve`**

```typescript
// Request
interface ApproveRequest {
  adminComment: string;  // 必須
}

// Response
interface ApproveResponse {
  success: boolean;
  message: string;
}
```

**ビジネスロジック:**

```typescript
async function approveModification(
  modificationId: number,
  request: ApproveRequest,
  adminId: number
): Promise<ApproveResponse> {
  const modification = await getModificationRequest(modificationId);

  // トランザクション処理
  await prisma.$transaction(async (tx) => {
    // 1. 申請を承認
    await tx.attendanceModificationRequest.update({
      where: { id: modificationId },
      data: {
        status: 'APPROVED',
        adminComment: request.adminComment,
        reviewedBy: adminId,
        reviewedAt: new Date()
      }
    });

    // 2. Attendanceの実績時間を更新
    await tx.attendance.update({
      where: { id: modification.attendanceId },
      data: {
        actualStartTime: modification.requestedStartTime,
        actualEndTime: modification.requestedEndTime,
        actualBreakTime: modification.requestedBreakTime,
        calculatedWage: modification.requestedAmount
      }
    });
  });

  // 3. ワーカーへの通知（アプリ内 + メール）
  await sendNotification({
    type: 'ATTENDANCE_MODIFICATION_APPROVED',
    userId: modification.attendance.userId,
    data: { modificationId }
  });

  return {
    success: true,
    message: '勤怠変更申請を承認しました'
  };
}
```

### 3.3 Server Actions

既存パターンに合わせ、Server Actions も実装。

```typescript
// src/lib/actions/attendance.ts

'use server';

export async function recordAttendance(
  formData: FormData
): Promise<ActionResult<AttendanceRecordResponse>> {
  // ... implementation
}

export async function createModificationRequest(
  formData: FormData
): Promise<ActionResult<CreateModificationResponse>> {
  // ... implementation
}

export async function approveModificationRequest(
  modificationId: number,
  adminComment: string
): Promise<ActionResult> {
  // ... implementation
}

export async function rejectModificationRequest(
  modificationId: number,
  adminComment: string
): Promise<ActionResult> {
  // ... implementation
}
```

---

## 4. コンポーネント設計

### 4.1 コンポーネント階層図

```
app/
├── my-jobs/                             # 仕事管理
│   ├── page.tsx                         # 仕事管理（タブ、出勤/退勤ボタン）
│   ├── AttendanceButton.tsx             # 出勤/退勤ボタン（右上ヘッダー）
│   └── MyJobsContent.tsx                # 仕事一覧コンテンツ
│
├── attendance/                          # ワーカー向け出退勤
│   ├── page.tsx                         # 出退勤リーダー
│   └── modify/
│       └── page.tsx                     # 勤怠変更申請（差額確認含む）
│
├── admin/
│   ├── attendance/
│   │   └── page.tsx                     # QR印刷
│   └── tasks/
│       └── attendance/
│           ├── page.tsx                 # 勤怠承認一覧
│           └── [id]/
│               └── page.tsx             # 勤怠承認詳細
│
└── system-admin/
    └── attendance/
        └── page.tsx                     # 勤務実績管理

components/
├── attendance/
│   ├── EmergencyCodeInput.tsx           # 緊急時番号入力
│   ├── AttendanceStatus.tsx             # 出退勤状態表示
│   ├── CheckOutSelector.tsx             # 退勤タイプ選択
│   ├── ModificationForm.tsx             # 勤怠変更申請フォーム
│   └── DifferenceConfirm.tsx            # 差額確認
│
└── admin/
    └── attendance/
        ├── ModificationRequestList.tsx  # 承認一覧
        └── ModificationRequestDetail.tsx # 承認詳細
```

### 4.1.1 導線設計

**ワーカー: 出退勤へのアクセス**

```
仕事管理 (/my-jobs)
  └─ ヘッダー右上「出勤」「退勤」ボタン
       └─ 出退勤リーダー (/attendance)
```

- 「出勤」ボタン: 勤務当日のみ表示（SCHEDULED状態の仕事がある場合）
- 「退勤」ボタン: 出勤中のみ表示（CHECKED_IN状態の場合）
- 勤務当日以外は出勤/退勤ボタンは非表示

### 4.2 主要コンポーネント詳細

#### 4.2.1 QRScanner

```typescript
// components/attendance/QRScanner.tsx

interface QRScannerProps {
  onScan: (data: QRScanResult) => void;
  onError: (error: Error) => void;
  isActive: boolean;
}

interface QRScanResult {
  facilityId: number;
  secretToken: string;
}

export function QRScanner({ onScan, onError, isActive }: QRScannerProps) {
  // html5-qrcode を使用
  // QRコードデータ形式: "attendance:{facilityId}:{secretToken}"
}
```

#### 4.2.2 EmergencyCodeInput

```typescript
// components/attendance/EmergencyCodeInput.tsx

interface EmergencyCodeInputProps {
  onSubmit: (code: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  errorCount: number;  // 連続エラー回数
  maxErrors: number;   // 最大エラー回数（5回）
}

export function EmergencyCodeInput({
  onSubmit,
  onError,
  disabled,
  errorCount,
  maxErrors
}: EmergencyCodeInputProps) {
  // 4桁数字入力
  // 5回連続エラーで入力欄非表示
  // 注意文表示
}
```

#### 4.2.3 CheckOutSelector

```typescript
// components/attendance/CheckOutSelector.tsx

interface CheckOutSelectorProps {
  isLate: boolean;            // 遅刻の場合は選択肢なし
  usedEmergencyCode: boolean; // 緊急番号使用の場合も選択肢なし
  onSelect: (type: 'ON_TIME' | 'MODIFICATION_REQUIRED') => void;
}

export function CheckOutSelector({
  isLate,
  usedEmergencyCode,
  onSelect
}: CheckOutSelectorProps) {
  // 遅刻/緊急番号使用の場合は「勤怠変更申請する」のみ表示
  // 正常の場合は2つのボタンを表示
}
```

#### 4.2.4 ModificationForm

```typescript
// components/attendance/ModificationForm.tsx

interface ModificationFormProps {
  attendance: Attendance;
  application: Application;
  onSubmit: (data: ModificationFormData) => void;
  isResubmit?: boolean;
  previousRejection?: {
    adminComment: string;
    rejectedAt: Date;
  };
}

interface ModificationFormData {
  startTime: string;
  endTime: string;
  breakTime: number;
  hasBreak: boolean;
  comment: string;
}

export function ModificationForm({
  attendance,
  application,
  onSubmit,
  isResubmit,
  previousRejection
}: ModificationFormProps) {
  // 勤務時間入力（時:分 セレクター）
  // 休憩時間（あり/なし + 時間入力）
  // コメント入力（必須）
  // 再申請の場合は前回却下理由を表示
}
```

#### 4.2.5 UnattendedAlert

```typescript
// components/attendance/UnattendedAlert.tsx

interface UnattendedAlertProps {
  application: Application;
  facility: Facility;
  onCheckIn: () => void;
  onContactSupport: () => void;
}

export function UnattendedAlert({
  application,
  facility,
  onCheckIn,
  onContactSupport
}: UnattendedAlertProps) {
  // 未出勤警告画面
  // 出勤ボタン
  // 緊急連絡先表示
  // Google Map埋め込み
  // お問い合わせフォームリンク
}
```

### 4.3 状態管理

```typescript
// lib/stores/attendance-store.ts

interface AttendanceState {
  // 出退勤リーダー状態
  currentAttendance: Attendance | null;
  isCheckedIn: boolean;
  isLate: boolean;
  usedEmergencyCode: boolean;

  // 緊急番号エラー
  emergencyCodeErrorCount: number;
  isEmergencyCodeLocked: boolean;

  // 勤怠変更申請
  modificationRequest: ModificationRequest | null;
  modificationStatus: 'idle' | 'submitting' | 'submitted';

  // アクション
  checkIn: (params: CheckInParams) => Promise<void>;
  checkOut: (params: CheckOutParams) => Promise<void>;
  submitModification: (data: ModificationFormData) => Promise<void>;
  incrementEmergencyCodeError: () => void;
  resetEmergencyCodeError: () => void;
}
```

---

## 5. 画面遷移設計

### 5.1 ワーカー: 出勤フロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                        仕事管理画面                                 │
│                          /my-jobs                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 仕事管理                              [出勤] ← 右上ボタン   │   │
│  │ ─────────────────────────────────────────────────           │   │
│  │ 審査中 │ 仕事の予定 │ 勤務中 │ 完了 │ キャンセル          │   │
│  │ ─────────────────────────────────────────────────           │   │
│  │ (予定の仕事カード一覧)                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ※「出勤」ボタンは勤務当日のみ表示                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ [出勤]ボタンをタップ
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      出退勤リーダー                                 │
│                        /attendance                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  カメラプレビュー                                           │   │
│  │  (QRコードスキャン中...)                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  QRコードが読み取れない場合:                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  緊急時番号入力: [ _ _ _ _ ]                                │   │
│  │  ※5回連続で誤入力すると入力欄が非表示になります             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                    [ 仕事開始 ]                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ スキャン成功 or 番号入力成功
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      出勤完了                                       │
│  「出勤を記録しました」                                             │
│  (遅刻の場合: 「退勤時に勤怠変更申請が必要です」)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 ワーカー: 退勤フロー（正常出勤の場合）

```
┌─────────────────────────────────────────────────────────────────────┐
│                        仕事管理画面                                 │
│                          /my-jobs                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 仕事管理                              [退勤] ← 右上ボタン   │   │
│  │ (出勤中に表示)                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ [退勤]ボタンをタップ
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      退勤タイプ選択                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  残業などを実施した場合                                     │   │
│  │  [ 退勤後、勤怠変更申請する ]                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  定刻通りの勤務であった場合                                 │   │
│  │  [ 定刻で退勤する ]                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
           ┌───────────────────┴───────────────────┐
           ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│ 「定刻で退勤する」  │               │「勤怠変更申請する」│
└──────────┬──────────┘               └──────────┬──────────┘
           │                                       │
           ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│   QRコード読取      │               │   QRコード読取      │
└──────────┬──────────┘               └──────────┬──────────┘
           │                                       │
           ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│   退勤完了          │               │  勤怠変更申請画面   │
│  （自動確定）       │               │  /attendance/modify │
└─────────────────────┘               └─────────────────────┘
```

### 5.3 ワーカー: 退勤フロー（遅刻の場合）

```
┌─────────────────────────────────────────────────────────────────────┐
│                        仕事管理画面                                 │
│                          /my-jobs                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 仕事管理                              [退勤] ← 右上ボタン   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ [退勤]ボタンをタップ
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      退勤案内（選択肢なし）                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  遅刻または早退が発生しています                             │   │
│  │  退勤後、勤怠変更申請してください                           │   │
│  │                                                             │   │
│  │  [ 退勤後、勤怠変更申請する ]                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      QRコード読取                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    勤怠変更申請画面                                 │
│                     /attendance/modify                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 ワーカー: 勤怠変更申請フロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                    勤怠変更申請画面                                 │
│                     /attendance/modify                              │
│                                                                     │
│  求人情報表示                                                       │
│  打刻時間表示: 09:20 - 18:15                                        │
│                                                                     │
│  勤務時間入力: [ 09 ] : [ 00 ] から [ 18 ] : [ 00 ]                │
│  休憩時間: ○ あり  ● なし                                         │
│  コメント: [________________________]                               │
│                                                                     │
│                    [ 差額を確認する ]                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    差額確認画面                                     │
│                     /attendance/modify/confirm                      │
│                                                                     │
│  勤務時間: 09:00-18:00                                              │
│  休憩時間: 休憩無し                                                 │
│                                                                     │
│  規定の給与:     ¥7,500                                             │
│  交通費:         ¥  800                                             │
│  規定額合計:     ¥8,300                                             │
│                                                                     │
│  変更後の給与:   ¥7,375                                             │
│  交通費:         ¥  800                                             │
│  変更申請額合計: ¥8,175                                             │
│                                                                     │
│  差額:           ¥ -125                                             │
│                                                                     │
│  ☑ 報酬の差額を確認しました                                        │
│                                                                     │
│  [ 勤怠変更申請を提出する ]  [ 入力画面に戻る ]                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    申請完了                                         │
│  「勤怠変更申請を提出しました」                                     │
│  → 仕事管理画面へ                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.5 施設管理者: 勤怠承認フロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                    タスクメニュー                                   │
│                      /admin/tasks                                   │
│                                                                     │
│  ・勤怠変更申請 (3件)                                               │
│  ・レビュー依頼 (5件)                                               │
│  ・...                                                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ 「勤怠変更申請」をクリック
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    勤怠承認一覧                                     │
│                     /admin/tasks/attendance                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 詳細 │ 案件ID │ 応募ID │ 状況      │ 申請日時              │   │
│  ├──────┼────────┼────────┼───────────┼───────────────────────┤   │
│  │ [>]  │ 1234   │ 5678   │ 未承認    │ 2026-01-15 18:30      │   │
│  │ [>]  │ 1235   │ 5679   │ 再申請    │ 2026-01-15 17:45      │   │
│  │ [>]  │ 1236   │ 5680   │ 承認済み  │ 2026-01-14 19:00      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ 「詳細」をクリック
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    勤怠承認詳細                                     │
│                     /admin/tasks/attendance/[id]                    │
│                                                                     │
│  ワーカー: 山田 太郎                                                │
│  勤務日: 2026-01-15                                                 │
│                                                                     │
│  ┌───────────┬────────────┬────────────┬────────────┐              │
│  │           │   出勤     │   退勤     │   休憩     │              │
│  ├───────────┼────────────┼────────────┼────────────┤              │
│  │ 定刻      │  09:00     │  18:00     │  60分      │              │
│  │ 打刻      │  09:20     │  18:15     │    -       │              │
│  │ 申請      │  09:00     │  18:00     │  0分       │              │
│  └───────────┴────────────┴────────────┴────────────┘              │
│                                                                     │
│  ワーカーコメント:                                                  │
│  「バスに乗り遅れてしまい遅刻しました。スタッフ様からの...」        │
│                                                                     │
│  管理者コメント（必須）:                                            │
│  [________________________]                                          │
│                                                                     │
│  [ 承認する ]  [ 拒否する ]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.6 未出勤アラートフロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                        アプリ起動時                                 │
│              （勤務開始時間を過ぎている場合）                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ 即時発動
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    未出勤アラート                                   │
│                                                                     │
│  ⚠️ 未出勤のお仕事があります！                                      │
│  早急に出勤処理を行ってください                                     │
│                                                                     │
│                    [ 出勤する ]                                     │
│                                                                     │
│  ─────────────────────────────────────────                          │
│  緊急連絡先                                                         │
│  事業所名：カイクマDS                                               │
│  事業所担当者名：介護好子                                           │
│  事業所緊急連絡先：〇〇〇                                           │
│  事業所住所：東京都大田区                                           │
│                                                                     │
│  [Google Map]                                                       │
│                                                                     │
│  キャンセルの場合                                                   │
│  運営事務局へお問い合わせください                                   │
│  [ お問い合わせフォーム ]                                           │
│                                                                     │
│  お仕事終了日から1週間ご連絡がない場合                              │
│  一時的にアカウントが利用停止となります                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ [出勤する]をタップ
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      出退勤リーダー                                 │
│                        /attendance                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 通知設計

### 6.1 通知一覧

| 通知キー | 発火タイミング | 対象 | チャネル |
|---------|---------------|------|----------|
| `ATTENDANCE_MODIFICATION_REQUESTED` | 勤怠変更申請時 | 施設 | アプリ内, メール |
| `ATTENDANCE_MODIFICATION_APPROVED` | 承認時 | ワーカー | アプリ内, メール |
| `ATTENDANCE_MODIFICATION_REJECTED` | 却下時 | ワーカー | アプリ内, メール |
| `ATTENDANCE_UNATTENDED_ALERT` | 勤務開始時間超過 | ワーカー | アプリ内, プッシュ |

### 6.2 通知テンプレート

```typescript
// NotificationSetting レコード

// 勤怠変更申請（施設向け）
{
  notification_key: 'ATTENDANCE_MODIFICATION_REQUESTED',
  name: '勤怠変更申請',
  target_type: 'FACILITY',
  chat_enabled: false,
  email_enabled: true,
  push_enabled: true,
  email_subject: '【+タスタス】勤怠変更申請がありました',
  email_body: `
    {{workerName}}様から勤怠変更申請がありました。

    勤務日: {{workDate}}
    申請内容:
    - 出勤時間: {{requestedStartTime}}
    - 退勤時間: {{requestedEndTime}}
    - 休憩時間: {{requestedBreakTime}}分

    コメント:
    {{workerComment}}

    以下のURLから確認・承認してください。
    {{approvalUrl}}
  `,
  push_title: '勤怠変更申請',
  push_body: '{{workerName}}様から勤怠変更申請がありました'
}

// 承認完了（ワーカー向け）
{
  notification_key: 'ATTENDANCE_MODIFICATION_APPROVED',
  name: '勤怠変更申請承認',
  target_type: 'WORKER',
  chat_enabled: true,
  email_enabled: true,
  push_enabled: true,
  chat_message: `
    【勤怠変更申請が承認されました】

    勤務日: {{workDate}}
    施設: {{facilityName}}

    承認内容:
    - 出勤時間: {{approvedStartTime}}
    - 退勤時間: {{approvedEndTime}}
    - 休憩時間: {{approvedBreakTime}}分
    - 確定報酬: {{confirmedWage}}円

    施設コメント:
    {{adminComment}}
  `,
  email_subject: '【+タスタス】勤怠変更申請が承認されました',
  // ... email_body
}

// 却下（ワーカー向け）
{
  notification_key: 'ATTENDANCE_MODIFICATION_REJECTED',
  name: '勤怠変更申請却下',
  target_type: 'WORKER',
  chat_enabled: true,
  email_enabled: true,
  push_enabled: true,
  chat_message: `
    【勤怠変更申請が却下されました】

    勤務日: {{workDate}}
    施設: {{facilityName}}

    却下理由:
    {{adminComment}}

    内容を修正して再申請してください。
    {{resubmitUrl}}
  `,
  // ...
}
```

---

## 7. セキュリティ設計

### 7.1 QRコード/緊急番号のセキュリティ

| 項目 | 対策 |
|------|------|
| QRコード改ざん | secretToken による検証 |
| QRコード流出 | 再発行機能、secretToken 更新 |
| 緊急番号総当たり | 5回連続エラーで入力欄非表示 |
| 不正な位置情報 | 位置情報は参考情報として記録（強制しない） |

### 7.2 認可チェック

```typescript
// 各APIでの認可チェック

// ワーカー向けAPI
async function checkWorkerAuth(attendanceId: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError();

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId }
  });

  if (attendance?.user_id !== session.user.id) {
    throw new ForbiddenError();
  }
}

// 施設管理者向けAPI
async function checkFacilityAdminAuth(attendanceId: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError();

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId }
  });

  // 施設管理者の所属施設と一致するか確認
  if (attendance?.facility_id !== session.user.facilityId) {
    throw new ForbiddenError();
  }
}
```

### 7.3 入力バリデーション

```typescript
// Zodスキーマ例

const modificationRequestSchema = z.object({
  attendanceId: z.number().int().positive(),
  requestedStartTime: z.string().datetime(),
  requestedEndTime: z.string().datetime(),
  requestedBreakTime: z.number().int().min(0).max(480), // 最大8時間
  workerComment: z.string().min(1).max(1000)
}).refine(
  (data) => new Date(data.requestedEndTime) > new Date(data.requestedStartTime),
  { message: '退勤時間は出勤時間より後である必要があります' }
);

const emergencyCodeSchema = z.string()
  .length(4)
  .regex(/^\d{4}$/, '4桁の数字を入力してください');
```

---

## 8. エラーハンドリング

### 8.1 エラーコード一覧

| コード | メッセージ | 対処 |
|--------|----------|------|
| `ATT001` | QRコードが無効です | 施設に再発行を依頼 |
| `ATT002` | 緊急時番号が一致しません | 正しい番号を確認 |
| `ATT003` | 出勤記録が見つかりません | 先に出勤処理が必要 |
| `ATT004` | 本日の勤務予定がありません | マッチング済みの勤務を確認 |
| `ATT005` | 緊急番号入力がロックされました | 施設に連絡 |
| `ATT006` | 勤怠変更申請は既に存在します | 既存の申請を確認 |
| `ATT007` | この申請は承認権限がありません | 別の管理者に依頼 |

### 8.2 エラーレスポンス形式

```typescript
interface AttendanceErrorResponse {
  success: false;
  error: {
    code: string;      // エラーコード
    message: string;   // ユーザー向けメッセージ
    details?: string;  // 詳細（開発時のみ）
  };
}
```

---

## 9. テスト計画

### 9.1 単体テスト

| 対象 | テスト内容 |
|------|----------|
| `calculateSalary()` | 深夜・残業計算、休憩控除 |
| `validateQRCode()` | QRコード検証ロジック |
| `validateEmergencyCode()` | 緊急番号検証、ロック機能 |
| `determineCheckOutType()` | 退勤タイプ判定ロジック |

### 9.2 統合テスト

| シナリオ | テスト内容 |
|---------|----------|
| 正常出勤→定刻退勤 | 申請不要、自動確定 |
| 遅刻出勤→退勤 | 申請必須、承認フロー |
| 緊急番号出勤→退勤 | 申請必須 |
| 申請→承認 | 通知、金額反映 |
| 申請→却下→再申請 | 再申請フロー |

### 9.3 E2Eテスト

```typescript
// Playwrightテスト例

test('遅刻した場合、退勤時に勤怠変更申請が必須', async ({ page }) => {
  // 1. ワーカーとしてログイン
  await loginAsWorker(page);

  // 2. 出勤処理（遅刻）
  await page.goto('/attendance');
  await page.getByTestId('qr-scanner').click();
  // ... QRスキャンモック

  // 3. 退勤処理
  await page.getByRole('button', { name: '退勤' }).click();

  // 4. 退勤タイプ選択肢が「勤怠変更申請」のみであること
  await expect(page.getByText('定刻で退勤する')).not.toBeVisible();
  await expect(page.getByText('退勤後、勤怠変更申請する')).toBeVisible();

  // 5. 勤怠変更申請画面へ遷移
  await page.getByRole('button', { name: '退勤後、勤怠変更申請する' }).click();
  await expect(page).toHaveURL('/attendance/modify');
});
```

---

## 10. 実装フェーズ

### フェーズ1: 基盤整備（1週目）

- [ ] DBスキーマ拡張（マイグレーション作成）
- [ ] 型定義ファイル作成
- [ ] Server Actions 基盤実装
- [ ] 給与計算ユーティリティ（実装済み）

### フェーズ2: 出退勤リーダー改修（2週目）

- [ ] QRスキャナー改修
- [ ] 緊急番号入力コンポーネント
- [ ] 退勤タイプ選択UI
- [ ] 出退勤API改修

### フェーズ3: 勤怠変更申請（3週目）

- [ ] 勤怠変更申請フォーム
- [ ] 差額確認画面
- [ ] 申請API実装
- [ ] 仕事管理画面の勤怠タブ

### フェーズ4: 施設側機能（4週目）

- [ ] QR印刷ページ改修
- [ ] 勤怠承認一覧
- [ ] 勤怠承認詳細・承認/拒否
- [ ] 通知実装

### フェーズ5: システム管理機能（5週目）

- [ ] 勤務実績管理画面
- [ ] フィルター機能
- [ ] CSV出力（クロスナビ形式）

### フェーズ6: テスト・品質保証（6週目）

- [ ] 単体テスト
- [ ] 統合テスト
- [ ] E2Eテスト
- [ ] バグ修正

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-15 | 初版作成。DBスキーマ、API、コンポーネント、画面遷移を設計。 |
