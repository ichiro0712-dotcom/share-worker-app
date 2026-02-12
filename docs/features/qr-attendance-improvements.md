# QR勤怠管理機能 改善仕様書

## 1. 概要

カイテクヘルプセンターの勤怠変更申請フローを参考に、現在の実装における改善点を整理し、実装仕様を定義する。

**参考資料**: カイテク ヘルプセンター「勤務時間を修正・変更する方法（勤怠変更申請）」

---

## 2. 改善項目一覧

| # | 項目 | 優先度 | 現状 | 改善内容 |
|---|------|--------|------|----------|
| 1 | 通知設定の追加 | 高 | seed.tsに勤怠変更関連の通知設定がない | NotificationSettingに勤怠変更申請関連を追加 |
| 2 | マイページでの再申請導線 | 高 | メール通知のリンクのみ | 仕事管理画面に「勤怠変更申請却下」ステータス表示と再申請ボタン追加 |
| 3 | 申請状況確認画面 | 中 | 詳細確認画面がない | 申請詳細画面（却下理由、再申請ボタン含む）を追加 |
| 4 | 施設側の再申請表示 | 低 | 初回申請と区別が弱い | 再申請回数の表示を追加 |

---

## 3. 詳細仕様

### 3.1 通知設定の追加（優先度：高）

#### 3.1.1 追加する通知設定

**ワーカー向け（target_type: 'WORKER'）**

```typescript
// 勤怠変更申請承認
{
  notification_key: 'ATTENDANCE_MODIFICATION_APPROVED',
  name: '勤怠変更申請承認',
  description: '勤怠変更申請が施設に承認された時に送信',
  target_type: 'WORKER',
  chat_enabled: true,
  email_enabled: true,
  push_enabled: true,
  dashboard_enabled: false,
  chat_message: `【勤怠変更申請が承認されました】

勤務日: {{work_date}}
施設: {{facility_name}}

承認内容:
- 出勤時間: {{approved_start_time}}
- 退勤時間: {{approved_end_time}}
- 休憩時間: {{approved_break_time}}分
- 確定報酬: {{confirmed_wage}}円

施設コメント:
{{admin_comment}}`,
  email_subject: '【+タスタス】勤怠変更申請が承認されました',
  email_body: `{{worker_name}}様

勤怠変更申請が承認されました。

■ 勤務情報
勤務日: {{work_date}}
施設: {{facility_name}}

■ 承認内容
出勤時間: {{approved_start_time}}
退勤時間: {{approved_end_time}}
休憩時間: {{approved_break_time}}分
確定報酬: {{confirmed_wage}}円

■ 施設コメント
{{admin_comment}}

給与は承認されたタイミングで給与管理に反映されます。`,
  push_title: '勤怠変更申請が承認されました',
  push_body: '{{facility_name}}の勤怠変更申請が承認されました',
}

// 勤怠変更申請却下
{
  notification_key: 'ATTENDANCE_MODIFICATION_REJECTED',
  name: '勤怠変更申請却下',
  description: '勤怠変更申請が施設に却下された時に送信',
  target_type: 'WORKER',
  chat_enabled: true,
  email_enabled: true,
  push_enabled: true,
  dashboard_enabled: false,
  chat_message: `【勤怠変更申請が却下されました】

勤務日: {{work_date}}
施設: {{facility_name}}

却下理由:
{{admin_comment}}

内容を修正して再申請してください。
{{resubmit_url}}`,
  email_subject: '【+タスタス】勤怠変更申請が却下されました',
  email_body: `{{worker_name}}様

勤怠変更申請が却下されました。

■ 勤務情報
勤務日: {{work_date}}
施設: {{facility_name}}

■ 却下理由
{{admin_comment}}

■ 再申請について
内容を修正して再申請することができます。
以下のURLから再申請してください。

{{resubmit_url}}

ご不明点があれば、施設にメッセージでお問い合わせください。`,
  push_title: '勤怠変更申請が却下されました',
  push_body: '{{facility_name}}の勤怠変更申請が却下されました。再申請してください。',
}
```

**施設向け（target_type: 'FACILITY'）**

```typescript
// 勤怠変更申請（新規）
{
  notification_key: 'ATTENDANCE_MODIFICATION_REQUESTED',
  name: '勤怠変更申請',
  description: 'ワーカーから勤怠変更申請があった時に送信',
  target_type: 'FACILITY',
  chat_enabled: false,
  email_enabled: true,
  push_enabled: true,
  dashboard_enabled: true,
  chat_message: null,
  email_subject: '【+タスタス】勤怠変更申請がありました',
  email_body: `{{worker_name}}様から勤怠変更申請がありました。

■ 勤務情報
勤務日: {{work_date}}
ワーカー: {{worker_name}}

■ 申請内容
出勤時間: {{requested_start_time}}
退勤時間: {{requested_end_time}}
休憩時間: {{requested_break_time}}分

■ ワーカーコメント
{{worker_comment}}

■ 承認・却下
以下のURLから確認・承認してください。
{{approval_url}}`,
  push_title: '勤怠変更申請',
  push_body: '{{worker_name}}様から勤怠変更申請がありました',
}
```

#### 3.1.2 通知設定で使用可能な変数

| 変数名 | 説明 | 使用通知 |
|--------|------|----------|
| `{{worker_name}}` | ワーカー名 | 全て |
| `{{facility_name}}` | 施設名 | 全て |
| `{{work_date}}` | 勤務日 | 全て |
| `{{requested_start_time}}` | 申請出勤時間 | REQUESTED |
| `{{requested_end_time}}` | 申請退勤時間 | REQUESTED |
| `{{requested_break_time}}` | 申請休憩時間 | REQUESTED |
| `{{approved_start_time}}` | 承認出勤時間 | APPROVED |
| `{{approved_end_time}}` | 承認退勤時間 | APPROVED |
| `{{approved_break_time}}` | 承認休憩時間 | APPROVED |
| `{{confirmed_wage}}` | 確定報酬 | APPROVED |
| `{{admin_comment}}` | 施設コメント | APPROVED, REJECTED |
| `{{worker_comment}}` | ワーカーコメント | REQUESTED |
| `{{approval_url}}` | 承認URL | REQUESTED |
| `{{resubmit_url}}` | 再申請URL | REJECTED |

---

### 3.2 マイページでの再申請導線（優先度：高）

#### 3.2.1 カイテクの仕様（参考）

カイテクでは「仕事管理」→「勤怠」タブで以下のステータスを表示：
- **勤怠変更未申請**: 申請が必要な状態
- **勤怠変更申請中**: 承認待ち
- **勤怠変更申請却下**: 却下され再申請が必要

#### 3.2.2 実装仕様

**対象画面**: `app/mypage/applications/page.tsx`（仕事管理画面）

**表示するステータスバッジ**:

| ステータス | バッジ表示 | 色 | 動作 |
|-----------|-----------|-----|------|
| 勤怠変更未申請 | `勤怠変更未申請` | 赤（bg-red-100 text-red-800） | タップで申請画面へ |
| 申請中（PENDING/RESUBMITTED） | `勤怠変更申請中` | 黄（bg-yellow-100 text-yellow-800） | タップで詳細表示 |
| 承認済（APPROVED） | なし（または完了マーク） | - | - |
| 却下（REJECTED） | `勤怠変更申請却下` | 赤（bg-red-100 text-red-800） | タップで再申請画面へ |

**UI設計**:

```
┌─────────────────────────────────────────┐
│ 仕事管理                    [出勤ボタン] │
├─────────────────────────────────────────┤
│ 予定 | 勤怠 | 未評価 | 完了 | キャンセル │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 📅 01/26(日) ⏰ 09:00-18:00        │ │
│ │ テスト施設                          │ │
│ │ 10,400円         [勤怠変更申請却下] │ │
│ │                                     │ │
│ │ ⚠️ 再申請が必要です                 │ │
│ │ [再申請する →]                      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**追加するコンポーネント**:

```tsx
// components/mypage/AttendanceStatusBadge.tsx
interface AttendanceStatusBadgeProps {
  status: 'PENDING' | 'RESUBMITTED' | 'APPROVED' | 'REJECTED' | 'REQUIRES_MODIFICATION' | null;
}

const statusConfig = {
  REQUIRES_MODIFICATION: {
    label: '勤怠変更未申請',
    className: 'bg-red-100 text-red-800',
  },
  PENDING: {
    label: '勤怠変更申請中',
    className: 'bg-yellow-100 text-yellow-800',
  },
  RESUBMITTED: {
    label: '勤怠変更申請中',
    className: 'bg-yellow-100 text-yellow-800',
  },
  APPROVED: {
    label: null, // 表示しない
    className: '',
  },
  REJECTED: {
    label: '勤怠変更申請却下',
    className: 'bg-red-100 text-red-800',
  },
};
```

---

### 3.3 申請状況確認画面（優先度：中）

#### 3.3.1 カイテクの仕様（参考）

カイテクでは「勤怠」タブから該当のお仕事をタップすると詳細画面に遷移し、
- 却下された場合は却下コメントを確認
- 再申請ボタンから再申請可能

#### 3.3.2 実装仕様

**新規画面**: `app/mypage/attendance/[attendanceId]/page.tsx`

**画面構成**:

```
┌─────────────────────────────────────────┐
│ ← 勤怠詳細                              │
├─────────────────────────────────────────┤
│ ■ 勤務情報                              │
│ 施設: テスト施設                         │
│ 勤務日: 2026年1月26日（日）              │
│ 定刻: 09:00 - 18:00（休憩60分）          │
│ 定刻報酬: 10,400円                       │
├─────────────────────────────────────────┤
│ ■ 打刻情報                              │
│ 出勤: 09:15（15分遅刻）                  │
│ 退勤: 18:00                              │
├─────────────────────────────────────────┤
│ ■ 勤怠変更申請                          │
│ ステータス: [却下]                       │
│ 申請日時: 2026/1/26 18:30               │
│                                          │
│ 申請内容:                                │
│ - 出勤: 09:00                            │
│ - 退勤: 18:00                            │
│ - 休憩: 60分                             │
│ - 申請報酬: 10,400円                     │
│                                          │
│ あなたのコメント:                        │
│ 「遅刻しましたが、施設の許可を得て      │
│   定刻通りの勤務としました」            │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠️ 施設からのコメント                │ │
│ │ 「申請時間が実際と異なります。       │ │
│ │   正しい時間で再申請してください」   │ │
│ │ 却下日時: 2026/1/26 20:00            │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ [────── 再申請する ──────]              │
└─────────────────────────────────────────┘
```

---

### 3.4 施設側の再申請表示（優先度：低）

#### 3.4.1 改善内容

**対象画面**: `components/admin/attendance/ModificationRequestDetail.tsx`

**追加表示項目**:
- 再申請回数（`resubmit_count`）
- 「この申請は再申請です（○回目）」の表示
- 前回の却下理由（参考表示）

**UI例**:

```
┌─────────────────────────────────────────┐
│ 勤怠変更申請詳細                        │
├─────────────────────────────────────────┤
│ 🔄 この申請は再申請です（2回目）        │
│                                          │
│ 前回の却下理由:                          │
│ 「申請時間が実際と異なります」          │
├─────────────────────────────────────────┤
│ ... 申請詳細 ...                         │
└─────────────────────────────────────────┘
```

---

## 4. データベース変更

### 4.1 NotificationSetting テーブル

**追加レコード**（prisma/seed.ts に追加）:

1. `ATTENDANCE_MODIFICATION_REQUESTED`（施設向け）
2. `ATTENDANCE_MODIFICATION_APPROVED`（ワーカー向け）
3. `ATTENDANCE_MODIFICATION_REJECTED`（ワーカー向け）

### 4.2 スキーマ変更

なし（既存のスキーマで対応可能）

---

## 5. 実装タスク

### Phase 1: 通知設定の追加（必須）

- [ ] prisma/seed.ts に勤怠変更申請関連の通知設定を追加
- [ ] 通知管理画面で使用可能な変数リストを更新
- [ ] 本番DBにseedを実行

### Phase 2: マイページ改善（必須）

- [ ] 仕事管理画面に勤怠変更申請ステータスバッジを追加
- [ ] 却下された申請の再申請ボタンを追加
- [ ] 申請詳細画面へのリンクを追加

### Phase 3: 申請詳細画面（推奨）

- [ ] 勤怠詳細画面（`/mypage/attendance/[id]`）を新規作成
- [ ] 打刻情報、申請内容、却下理由を表示
- [ ] 再申請ボタンを配置

### Phase 4: 施設側改善（オプション）

- [ ] 再申請回数の表示を追加
- [ ] 前回却下理由の参考表示を追加

---

## 6. テスト項目

### 6.1 通知テスト

- [ ] 勤怠変更申請時に施設にメール通知が届く
- [ ] 承認時にワーカーにメール・プッシュ通知が届く
- [ ] 却下時にワーカーにメール・プッシュ通知が届く
- [ ] 却下メールに再申請URLが含まれる

### 6.2 再申請フローテスト

- [ ] 却下後、メールのリンクから再申請画面に遷移できる
- [ ] マイページから却下された申請を確認できる
- [ ] マイページから再申請画面に遷移できる
- [ ] 再申請が正常に処理される
- [ ] 再申請回数が上限に達した場合、エラーが表示される

---

## 7. 参考：カイテクとの機能比較

| 機能 | カイテク | +タスタス（現状） | +タスタス（改善後） |
|------|---------|----------------|------------------|
| QRコード出退勤 | ○ | ○ | ○ |
| 緊急番号出退勤 | ○ | ○ | ○ |
| 遅刻判定 | ○ | ○ | ○ |
| 勤怠変更申請 | ○ | ○ | ○ |
| 差額確認画面 | ○ | ○ | ○ |
| 施設承認/却下 | ○ | ○ | ○ |
| 却下通知（メール） | ○ | ○ | ○ |
| 却下通知（プッシュ） | ○ | △（設定なし） | ○ |
| 再申請機能 | ○ | ○ | ○ |
| 仕事管理での状態表示 | ○ | △（不十分） | ○ |
| 再申請ボタン（マイページ） | ○ | ✕ | ○ |
| 申請詳細画面 | ○ | ✕ | ○ |
| 再申請回数制限 | 不明 | ○（3回） | ○（3回） |

---

## 8. 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-01-26 | 1.0 | 初版作成 |
