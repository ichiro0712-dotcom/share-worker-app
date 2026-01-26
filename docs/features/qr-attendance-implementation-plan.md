# QR勤怠管理機能 改善 - 実装計画

## 概要

**目的**: カイテクのUXを参考に、勤怠変更申請の再申請フローを改善し、ワーカーが迷わず操作できるようにする

**ブランチ**: `feature/qr-attendance`

**参照仕様書**: `docs/features/qr-attendance-improvements.md`

---

## 実装フェーズ

### Phase 1: 通知設定の追加 ✅ 完了

| タスク | ファイル | 状態 |
|--------|----------|------|
| seed.tsに通知設定追加 | `prisma/seed.ts` | ✅ 完了 |
| 通知管理画面の変数追加 | `app/system-admin/content/notifications/page.tsx` | ✅ 完了 |
| 本番DBへのseed実行 | - | 📋 デプロイ後に実行 |

---

### Phase 2: マイページ改善（優先度：高）✅ 完了

#### 2.1 仕事管理画面（完了タブ）の改善

**対象ファイル**: `app/my-jobs/MyJobsContent.tsx`

| # | タスク | 詳細 | 状態 |
|---|--------|------|------|
| 2.1.1 | 勤怠変更申請ステータス取得 | `getMyApplications`の戻り値に`modificationRequest`情報を含める | ✅ 完了 |
| 2.1.2 | ステータスバッジコンポーネント作成 | `components/mypage/AttendanceStatusBadge.tsx` を新規作成 | ✅ 完了 |
| 2.1.3 | 完了タブにバッジ表示 | 完了タブのカードに勤怠変更申請ステータスバッジを追加 | ✅ 完了 |
| 2.1.4 | 再申請ボタン追加 | 却下時に「再申請する」ボタンと却下理由を表示 | ✅ 完了 |

#### 2.2 新規コンポーネント

```
components/
└── mypage/
    └── AttendanceStatusBadge.tsx  # ✅ 作成済み
```

#### 2.3 Server Action 修正

**対象ファイル**: `src/lib/actions/application-worker.ts`

| # | タスク | 詳細 | 状態 |
|---|--------|------|------|
| 2.3.1 | 勤怠変更申請情報の取得追加 | `getMyApplications`に`modificationRequest`を含める | ✅ 完了 |

---

### Phase 3: 勤怠詳細画面（優先度：中）✅ 完了

#### 3.1 新規ページ作成

**新規ファイル**: `app/mypage/attendance/[attendanceId]/page.tsx`

| # | タスク | 詳細 | 状態 |
|---|--------|------|------|
| 3.1.1 | ページ作成 | 勤怠詳細画面を新規作成 | ✅ 完了 |
| 3.1.2 | Server Action追加 | `getAttendanceDetailForWorker`関数を追加 | ✅ 完了 |
| 3.1.3 | UI実装 | 勤務情報、打刻情報、申請情報、却下理由を表示 | ✅ 完了 |
| 3.1.4 | 再申請ボタン | 却下時に再申請ページへのリンクを表示 | ✅ 完了 |
| 3.1.5 | 仕事管理画面からのリンク | 完了タブに「勤怠詳細」ボタンを追加 | ✅ 完了 |

#### 3.2 ファイル構成

```
app/
└── mypage/
    └── attendance/
        └── [attendanceId]/
            └── page.tsx  # ✅ 作成済み
```

---

### Phase 4: 施設側改善（優先度：低）

#### 4.1 再申請表示の改善

**対象ファイル**: `components/admin/attendance/ModificationRequestDetail.tsx`

| # | タスク | 詳細 |
|---|--------|------|
| 4.1.1 | 再申請回数表示 | `resubmit_count > 0`の場合、再申請回数を表示 |
| 4.1.2 | 再申請バナー | 「この申請は再申請です（○回目）」を表示 |

---

## 実装順序（推奨）

```
Phase 1 ────────────────────────────────────────────────
  ✅ 1.1 seed.ts 通知設定追加
  ✅ 1.2 通知管理画面の変数追加
  📋 1.3 本番DBへのseed実行（デプロイ後）
        │
Phase 2 ────────────────────────────────────────────────
        ▼
  ✅ 2.1 AttendanceStatusBadge.tsx 作成
        │
        ▼
  ✅ 2.2 getMyApplications 修正（modificationRequest追加）
        │
        ▼
  ✅ 2.3 仕事管理画面（完了タブ）にバッジ表示
        │
        ▼
  ✅ 2.4 再申請ボタン追加（却下時に表示）
        │
Phase 3 ────────────────────────────────────────────────
        ▼
  ✅ 3.1 getAttendanceDetailForWorker Server Action作成
        │
        ▼
  ✅ 3.2 勤怠詳細画面 作成
        │
        ▼
  ✅ 3.3 仕事管理画面からのリンク追加
        │
Phase 4 ────────────────────────────────────────────────
        ▼
  4.1 施設側の再申請表示改善
```

---

## 詳細タスク一覧

### Phase 2 詳細

#### タスク 2.1: AttendanceStatusBadge コンポーネント作成

**ファイル**: `components/mypage/AttendanceStatusBadge.tsx`

```tsx
interface AttendanceStatusBadgeProps {
  status: 'PENDING' | 'RESUBMITTED' | 'APPROVED' | 'REJECTED' | 'REQUIRES_MODIFICATION' | null;
  attendanceId?: number;
  modificationId?: number;
}

// ステータスに応じたバッジを表示
// REJECTED の場合は再申請ボタンも表示
```

#### タスク 2.2: getWorkerApplications 修正

**ファイル**: `src/lib/actions/application-worker.ts`

```typescript
// 現在の戻り値に追加
modificationRequest: {
  id: number;
  status: string;
  adminComment: string | null;
  resubmitCount: number;
} | null;
```

#### タスク 2.3: 仕事管理画面の勤怠タブ改善

**ファイル**: `app/mypage/applications/page.tsx`

- 勤怠カードに `AttendanceStatusBadge` を追加
- 却下された申請に「再申請する」リンクを追加
- リンク先: `/attendance/modify?resubmit={modificationId}`

---

### Phase 3 詳細

#### タスク 3.1: getAttendanceDetail Server Action

**ファイル**: `src/lib/actions/attendance.ts`

```typescript
export async function getAttendanceDetail(attendanceId: number): Promise<{
  success: boolean;
  attendance?: {
    id: number;
    checkInTime: string;
    checkOutTime: string | null;
    facility: { id: number; name: string };
    application: {
      workDate: { workDate: string; job: { ... } };
    } | null;
    modificationRequest: {
      id: number;
      status: string;
      requestedStartTime: string;
      requestedEndTime: string;
      requestedBreakTime: number;
      workerComment: string;
      adminComment: string | null;
      originalAmount: number;
      requestedAmount: number;
      resubmitCount: number;
      reviewedAt: string | null;
    } | null;
  };
  message?: string;
}>
```

#### タスク 3.2: 勤怠詳細ページ

**ファイル**: `app/mypage/attendance/[attendanceId]/page.tsx`

```
表示内容:
├── 勤務情報セクション
│   ├── 施設名
│   ├── 勤務日
│   ├── 定刻時間
│   └── 定刻報酬
├── 打刻情報セクション
│   ├── 出勤時刻（遅刻の場合は警告表示）
│   └── 退勤時刻
├── 勤怠変更申請セクション（申請がある場合）
│   ├── ステータスバッジ
│   ├── 申請日時
│   ├── 申請内容（時間、休憩、報酬）
│   ├── ワーカーコメント
│   └── 施設コメント（却下時）
└── アクションボタン
    └── 再申請ボタン（却下時のみ）
```

---

## テスト計画

### 手動テスト項目

| # | テスト内容 | 期待結果 |
|---|-----------|----------|
| T1 | 勤怠タブで却下された申請を確認 | 「勤怠変更申請却下」バッジが表示される |
| T2 | 却下バッジから再申請 | 再申請画面に遷移し、前回の却下理由が表示される |
| T3 | 勤怠詳細画面を確認 | 打刻情報、申請情報、却下理由が正しく表示される |
| T4 | 却下メール内のリンク | 再申請画面に正しく遷移する |
| T5 | 再申請の送信 | 申請が受け付けられ、ステータスがRESUBMITTEDになる |
| T6 | 再申請回数上限 | 3回目の再申請でエラーが表示される |

---

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| 既存の勤怠データとの互換性 | 申請がない勤怠レコードでエラー | null チェックを徹底 |
| タイムゾーン問題 | 時刻表示のずれ | 先ほど修正したTZ非依存計算を使用 |
| 通知テンプレートの変数不一致 | メール送信失敗 | 変数名を仕様書と一致させる |

---

## デプロイ手順

1. **ステージングデプロイ**
   - developブランチにマージ
   - Vercel自動デプロイ
   - ステージングDBにseed実行: `npx prisma db seed`

2. **本番デプロイ**
   - mainブランチにマージ
   - 本番DBにseed実行（新しい通知設定のみ追加される）

---

## 見積もり

| フェーズ | 作業内容 | 工数目安 |
|---------|----------|----------|
| Phase 1 | 通知設定追加 | ✅ 完了 |
| Phase 2 | マイページ改善 | ✅ 完了 |
| Phase 3 | 勤怠詳細画面 | ✅ 完了 |
| Phase 4 | 施設側改善 | 小規模 |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-26 | 初版作成 |
| 2026-01-26 | Phase 2完了: 仕事管理画面にステータスバッジ・再申請ボタン追加 |
| 2026-01-26 | Phase 3完了: 勤怠詳細画面を作成、仕事管理画面からのリンク追加 |
