# 応募管理画面のリデザイン指示書

## 概要

`/admin/applications` ページを「求人ベースの応募管理画面」にリデザインする。
現在は「ワーカー別」に応募を表示しているが、「求人別」に応募者を管理できるように変更する。

## 現状の問題点

1. 現在の画面はワーカー単位で応募を表示している
2. どの求人に何人応募が来ているか一目でわからない
3. 複数日程の求人において、どの日にどれだけ枠が埋まっているかわからない

## 要件

### 画面構成（2段階表示）

#### 第1段階: 求人カード一覧
- `/admin/jobs` と同様のカード形式で求人を表示
- 各カードには以下の情報を含める:
  - ステータスバッジ（公開中/停止中）
  - 求人タイトル
  - 応募数の合計（例: 「応募: 5名 / マッチング: 2/10名」）
  - 時給
  - 勤務期間・時間
  - 業務内容タグ
  - 必要資格タグ
- カードをクリックすると第2段階（詳細ビュー）を表示

#### 第2段階: 求人詳細 + 日程別応募者ビュー
求人カードをクリックしたときに表示するモーダルまたは展開ビュー

**必要な情報:**
1. 求人の基本情報（タイトル、時給、勤務時間など）
2. 日程別の応募状況を視覚的に表示
   - 各勤務日（JobWorkDate）ごとに:
     - 日付と曜日
     - 募集人数
     - 応募済み人数
     - マッチング済み人数
     - 枠の充足状況（視覚的にわかりやすく: 例えばプログレスバーや色分け）
3. 各日程に紐づく応募者一覧
   - ワーカー名（プロフィールリンク）
   - 顔写真
   - 評価（星）
   - 直前キャンセル率
   - 応募ステータス（応募中/マッチング済み/キャンセル）
   - マッチング/キャンセルボタン

### デザイン要件

- デザインは開発者が最適と考えるものを提案してください
- 以下の点を重視:
  - どの日が人が足りていないか一目でわかる
  - どの応募者をマッチングすべきか判断しやすい
  - 複数日程をまたいで応募しているワーカーがわかる（あれば）

### 機能要件

1. **求人一覧表示**
   - フィルタ: ステータス（全て/公開中/停止中）、期間
   - 検索: 求人タイトル
   - ソート: 応募数順、勤務日順

2. **日程別応募管理**
   - 各日程の応募状況を色分け表示
     - 募集枠が埋まっている: 緑
     - 一部埋まっている: 黄
     - まだ応募なし: 赤/グレー
   - 日程ごとに応募者リストを展開/折りたたみ

3. **マッチング操作**
   - 個別マッチング
   - 日程内の全応募者を一括マッチング
   - マッチング取消
   - 応募キャンセル

## 技術情報

### 使用ファイル

- メインページ: `app/admin/applications/page.tsx`
- 参考: `app/admin/jobs/page.tsx`（求人カード表示の参考）

### データ取得

既存の関数を参考に、新しいデータ取得関数が必要:

```typescript
// src/lib/actions.ts に追加

// 求人ベースで応募情報を取得する関数
export async function getJobsWithApplications(facilityId: number) {
  // Job → JobWorkDate → Application の構造でデータ取得
  // 各JobWorkDateごとの応募者情報を含める
}
```

### データ構造（参考）

```typescript
// 求人カード表示用
interface JobWithApplications {
  id: number;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  hourlyWage: number;
  workContent: string[];
  requiredQualifications: string[];
  totalRecruitment: number;  // 全日程の募集人数合計
  totalApplied: number;      // 全日程の応募数合計
  totalMatched: number;      // 全日程のマッチング数合計
  dateRange: string;         // 勤務期間（例: "12/1〜12/15"）

  // 日程別の詳細
  workDates: WorkDateWithApplications[];
}

// 日程別の応募情報
interface WorkDateWithApplications {
  id: number;
  date: string;             // 勤務日
  formattedDate: string;    // フォーマット済み（例: "12/1(月)"）
  recruitmentCount: number;  // 募集人数
  appliedCount: number;      // 応募数
  matchedCount: number;      // マッチング数

  // この日程への応募者一覧
  applications: ApplicationWithWorker[];
}

// 応募者情報
interface ApplicationWithWorker {
  id: number;
  status: 'APPLIED' | 'SCHEDULED' | 'CANCELLED' | ...;
  createdAt: string;
  worker: {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
  };
  rating: number | null;
  reviewCount: number;
  lastMinuteCancelRate: number;
}
```

### 既存のServer Actions（参考）

- `getAdminJobsList(facilityId)`: 求人一覧取得
- `getFacilityApplicationsByWorker(facilityId)`: ワーカー別応募一覧
- `updateApplicationStatus(applicationId, status, facilityId)`: 応募ステータス更新

### UIコンポーネント（プロジェクト内で使用可能）

- `Badge`: `@/components/ui/badge`
- `Tag`: `@/components/ui/tag`
- `EmptyState`: `@/components/ui/EmptyState`
- Lucide Icons: Calendar, Users, Clock, ChevronDown, ChevronUp など

### スタイリング

- Tailwind CSS を使用
- primaryカラー: `bg-primary`, `text-primary`
- 既存の管理画面のスタイルに合わせる

## 実装手順

1. `src/lib/actions.ts` に `getJobsWithApplications` 関数を追加
2. `app/admin/applications/page.tsx` を書き換え
   - 第1段階: 求人カード一覧を実装
   - 第2段階: モーダルまたは展開ビューで日程別応募者を表示
3. マッチング/キャンセル機能は既存の `updateApplicationStatus` を再利用

## 注意事項

- デザインの詳細は指定しない。開発者が最適なUIを設計してください
- 重要なのは「どの日が人手不足か」「誰をマッチングすべきか」が一目でわかること
- パフォーマンス: 大量の求人/応募があっても遅くならないよう配慮
