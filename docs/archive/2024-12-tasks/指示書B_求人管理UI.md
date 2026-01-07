# 指示書B: システム管理画面 求人管理ページの実装

## 作業の目的と背景

システム管理画面に求人管理ページを新規作成します。
親求人（Job）単位で一覧表示し、検索・フィルター・ソート・各種アクションを提供します。

## 参考ファイル

実装の参考として以下のファイルを確認してください：
- `app/system-admin/workers/page.tsx` - ワーカー管理ページ（構造の参考）
- `app/system-admin/facilities/page.tsx` - 施設管理ページ（構造の参考）
- `src/lib/system-actions.ts` - Server Action（`getSystemJobsExtended`関数を使用）

## 実装する機能

### 1. 画面構成

**ファイル**: `app/system-admin/jobs/page.tsx`（既存ファイルを置き換え）

### 2. データ取得

Server Actionの`getSystemJobsExtended`を使用します。

```tsx
import { getSystemJobsExtended } from '@/src/lib/system-actions';

// 返されるデータ型
interface Job {
    id: number;
    title: string;
    status: 'DRAFT' | 'PUBLISHED' | 'STOPPED' | 'WORKING' | 'COMPLETED' | 'CANCELLED';
    facilityId: number;
    facilityName: string;
    facilityType: string;
    templateName: string | null;
    requiresInterview: boolean;
    applicationSlots: number;    // 応募枠（全勤務日の募集人数合計）
    applicationCount: number;    // 応募数
    matchingPeriod: number | null;  // マッチング期間（時間）
    createdAt: Date;
    updatedAt: Date;
}
```

### 3. UI要素

#### 3.1 ヘッダー部分
```tsx
<div className="flex justify-between items-center mb-6">
    <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-indigo-600" />
            求人管理
        </h1>
        <p className="text-slate-500">登録求人の一覧・管理</p>
    </div>
    <div className="text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-lg">
        全 <span className="font-bold text-slate-800">{totalCount}</span> 件
    </div>
</div>
```

#### 3.2 検索・フィルター

**フリーテキスト検索**:
- プレースホルダー: `ID、求人名、テンプレート名、施設名で検索`

**詳細フィルター**（展開式パネル）:
1. **ステータス**: すべて / 下書き(DRAFT) / 公開中(PUBLISHED) / 停止(STOPPED) / 勤務中(WORKING) / 完了(COMPLETED) / キャンセル(CANCELLED)
2. **日付範囲**: 開始日・終了日（作成日でフィルター）
3. **都道府県**: 施設の都道府県でフィルター
4. **市区町村**: 都道府県選択後に連動
5. **施設種別**: `constants/job.ts`の`FACILITY_TYPES`を使用
6. **審査あり**: すべて / 審査あり / 審査なし

```tsx
// フィルター状態
const [showFilters, setShowFilters] = useState(false);
const [statusFilter, setStatusFilter] = useState('ALL');
const [startDateFilter, setStartDateFilter] = useState('');
const [endDateFilter, setEndDateFilter] = useState('');
const [prefectureFilter, setPrefectureFilter] = useState('');
const [cityFilter, setCityFilter] = useState('');
const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
const [interviewFilter, setInterviewFilter] = useState<'all' | 'true' | 'false'>('all');
```

#### 3.3 テーブル表示

**カラム構成**:

| カラム | フィールド | ソート | 説明 |
|--------|-----------|--------|------|
| 求人名 | title | - | 求人タイトルを表示、IDも小さく表示 |
| 施設名 | facilityName | - | 施設名を表示 |
| ステータス | status | ✓ | バッジで色分け表示 |
| 応募枠 | applicationSlots | ✓ | 数値表示 |
| 応募数 | applicationCount | ✓ | 数値表示 |
| 作成日 | createdAt | ✓ | YYYY/MM/DD形式 |
| マッチング期間 | matchingPeriod | ✓ | ○○時間 or「-」 |
| アクション | - | - | ドロップダウンメニュー |

**ステータスバッジの色分け**:
```tsx
const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    PUBLISHED: 'bg-green-100 text-green-700',
    STOPPED: 'bg-red-100 text-red-700',
    WORKING: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-purple-100 text-purple-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
    DRAFT: '下書き',
    PUBLISHED: '公開中',
    STOPPED: '停止',
    WORKING: '勤務中',
    COMPLETED: '完了',
    CANCELLED: 'キャンセル',
};
```

#### 3.4 アクションメニュー

ドロップダウンメニューで以下のアクションを提供：

1. **詳細を見る**: ワーカー向け求人詳細ページを新しいタブで開く
   - URL: `/jobs/${job.id}`
   - `target="_blank"`で開く

2. **編集**: 施設管理者としてマスカレードして編集画面へ
   - 既存のマスカレード機能を使用
   - `generateMasqueradeToken(job.facilityId, adminId)`を呼び出し
   - `/masquerade?token=${token}&redirect=/admin/jobs/${job.id}/edit`へリダイレクト

3. **停止する** (status === 'PUBLISHED'の場合のみ表示):
   - 確認ダイアログを表示
   - `forceStopJob(job.id)`を呼び出し

4. **停止解除** (status === 'STOPPED'の場合のみ表示):
   - 確認ダイアログを表示
   - `forceResumeJob(job.id)`を呼び出し

5. **削除**: 赤色で表示、確認ダイアログ必須
   - `forceDeleteJob(job.id)`を呼び出し

```tsx
// アクションメニューの実装例
const [openMenuId, setOpenMenuId] = useState<number | null>(null);

// メニュー外クリックで閉じる
useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
}, []);
```

### 4. import文

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    getSystemJobsExtended,
    forceStopJob,
    forceResumeJob,
    forceDeleteJob,
    generateMasqueradeToken
} from '@/src/lib/system-actions';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import {
    Search,
    Filter,
    Eye,
    Edit,
    Trash2,
    MoreVertical,
    ChevronDown,
    X,
    ArrowUpDown,
    Briefcase,
    StopCircle,
    PlayCircle,
    Calendar,
    Clock
} from 'lucide-react';
import { PREFECTURES, FACILITY_TYPES } from '@/constants/job';
import { getCitiesByPrefecture, Prefecture } from '@/constants/prefectureCities';
import toast from 'react-hot-toast';
```

### 5. 完成イメージ

ワーカー管理ページ（`/system-admin/workers`）と同様のUIで：
- 上部に検索バーとフィルターボタン
- フィルターボタンクリックで詳細フィルターパネルが展開
- アクティブなフィルターはバッジで表示
- テーブルは横スクロール対応
- ページネーション付き

### 6. ソート機能

ソート可能なカラムは以下：
- `status` - ステータス
- `applicationSlots` - 応募枠
- `applicationCount` - 応募数
- `created_at` - 作成日（デフォルト）
- `matchingPeriod` - マッチング期間

```tsx
type SortField = 'status' | 'applicationSlots' | 'applicationCount' | 'created_at' | 'matchingPeriod';
type SortOrder = 'asc' | 'desc';

const [sortField, setSortField] = useState<SortField>('created_at');
const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
```

### 7. Server Action呼び出し例

```tsx
const fetchJobs = async () => {
    setLoading(true);
    try {
        const filters = {
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            startDate: startDateFilter || undefined,
            endDate: endDateFilter || undefined,
            prefecture: prefectureFilter || undefined,
            city: cityFilter || undefined,
            facilityType: facilityTypeFilter || undefined,
            requiresInterview: interviewFilter === 'all' ? undefined : interviewFilter === 'true',
        };

        const data = await getSystemJobsExtended(
            page,
            20,          // limit
            search,
            sortField,
            sortOrder,
            filters
        );

        setJobs(data.jobs);
        setTotalPages(data.totalPages);
        setTotalCount(data.total);
    } catch (error) {
        console.error(error);
        toast.error('求人の取得に失敗しました');
    } finally {
        setLoading(false);
    }
};
```

### 8. マスカレード編集の実装

```tsx
const handleEdit = async (job: Job) => {
    try {
        // 施設管理者としてマスカレード
        const token = await generateMasqueradeToken(job.facilityId, admin?.id || 1);
        // 編集画面へリダイレクト
        window.open(`/masquerade?token=${token}&redirect=/admin/jobs/${job.id}/edit`, '_blank');
    } catch (error) {
        toast.error('編集画面を開けませんでした');
    }
};
```

### 9. 日付フォーマット

```tsx
const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

const formatMatchingPeriod = (hours: number | null) => {
    if (hours === null) return '-';
    if (hours < 1) return `${Math.round(hours * 60)}分`;
    return `${hours.toFixed(1)}時間`;
};
```

## 完了条件

1. `/system-admin/jobs` にアクセスすると求人一覧が表示されること
2. フリーテキスト検索が機能すること（ID、求人名、テンプレート名、施設名）
3. 詳細フィルターが正しく動作すること
4. ソートが正しく動作すること
5. アクションメニューの全機能が動作すること
   - 詳細を見る → 新規タブで求人詳細ページが開く
   - 編集 → マスカレードして編集画面が開く
   - 停止/停止解除 → ステータスが更新される
   - 削除 → 求人が削除される
6. TypeScriptエラーがないこと

## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. キャッシュクリアと再ビルド
```bash
rm -rf .next && npm run build
```

### 2. TypeScriptエラーチェック
```bash
npm run build
```
エラーがあれば修正してから次へ進む。

### 3. 開発サーバー再起動
```bash
rm -rf .next && npm run dev
```

### 4. ブラウザ確認
- ハードリロード（Cmd+Shift+R または Ctrl+Shift+R）で確認
- `/system-admin/jobs` にアクセス
- 以下を確認：
  - 求人一覧が表示される
  - 検索が動作する
  - フィルターが動作する
  - ソートが動作する
  - アクションメニューが動作する
  - ページネーションが動作する

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること。
