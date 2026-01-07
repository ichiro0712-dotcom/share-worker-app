# 無料LLM作業指示書: 応募管理画面の改善

## 作業の目的と背景

`/admin/applications`（応募管理画面）の「ワーカーから」ビューにおいて、ワーカーカードの機能を拡充し、ユーザビリティを向上させる。

## 修正対象ファイル

1. `/app/admin/applications/page.tsx` - メインの修正対象
2. `/src/lib/actions.ts` - データ取得ロジックの修正

## 変更内容

### 1. `src/lib/actions.ts` - `getApplicationsByWorker`関数の修正

**目的**: ワーカーの経験分野（experienceFields）とお気に入り/ブロック状態を取得する

**変更箇所**: `getApplicationsByWorker`関数（約6146行目から開始）

**修正内容**:

#### 1-1. ユーザー取得時にexperience_fieldsを含める（約6160-6168行）

```typescript
// Before:
include: {
  user: {
    select: {
      id: true,
      name: true,
      profile_image: true,
      qualifications: true,
      prefecture: true,
      city: true,
    },
  },

// After:
include: {
  user: {
    select: {
      id: true,
      name: true,
      profile_image: true,
      qualifications: true,
      prefecture: true,
      city: true,
      experience_fields: true,  // 追加
    },
  },
```

#### 1-2. ワーカーのお気に入り・ブロック状態を取得（約6190行目の後、workerIds取得後に追加）

```typescript
// 2. ワーカーIDを収集
const workerIds = Array.from(new Set(applications.map(app => app.user.id)));

// 追加: ワーカーのお気に入り・ブロック状態を取得
const workerBookmarks = await prisma.bookmark.findMany({
  where: {
    facility_id: facilityId,
    target_user_id: { in: workerIds },
    type: { in: ['FAVORITE', 'WATCH_LATER'] },
  },
  select: {
    target_user_id: true,
    type: true,
  },
});

const favoriteWorkerIds = new Set(
  workerBookmarks.filter(b => b.type === 'FAVORITE').map(b => b.target_user_id)
);
const blockedWorkerIds = new Set(
  workerBookmarks.filter(b => b.type === 'WATCH_LATER').map(b => b.target_user_id)
);
```

#### 1-3. workerの型定義を修正（約6256行目）

```typescript
// Before:
const workerMap = new Map<number, {
  worker: {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    location: string | null;
    rating: number | null;
    reviewCount: number;
    totalWorkDays: number;
    lastMinuteCancelRate: number;
  };
  applications: { ... }[];
}>();

// After:
const workerMap = new Map<number, {
  worker: {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    location: string | null;
    rating: number | null;
    reviewCount: number;
    totalWorkDays: number;
    lastMinuteCancelRate: number;
    experienceFields: Array<{ field: string; years: string }>;  // 追加
    isFavorite: boolean;  // 追加
    isBlocked: boolean;   // 追加
  };
  applications: { ... }[];
}>();
```

#### 1-4. workerMap.setの部分を修正（約6301-6314行目）

```typescript
// Before:
workerMap.set(workerId, {
  worker: {
    id: workerId,
    name: app.user.name,
    profileImage: app.user.profile_image,
    qualifications: app.user.qualifications,
    location,
    rating,
    reviewCount,
    totalWorkDays,
    lastMinuteCancelRate,
  },
  applications: [],
});

// After:
// experience_fieldsをパース
let experienceFields: Array<{ field: string; years: string }> = [];
if (app.user.experience_fields) {
  try {
    const parsed = typeof app.user.experience_fields === 'string'
      ? JSON.parse(app.user.experience_fields)
      : app.user.experience_fields;
    if (Array.isArray(parsed)) {
      experienceFields = parsed;
    }
  } catch {
    experienceFields = [];
  }
}

workerMap.set(workerId, {
  worker: {
    id: workerId,
    name: app.user.name,
    profileImage: app.user.profile_image,
    qualifications: app.user.qualifications,
    location,
    rating,
    reviewCount,
    totalWorkDays,
    lastMinuteCancelRate,
    experienceFields,  // 追加
    isFavorite: favoriteWorkerIds.has(workerId),  // 追加
    isBlocked: blockedWorkerIds.has(workerId),    // 追加
  },
  applications: [],
});
```

---

### 2. `app/admin/applications/page.tsx` - UI部分の修正

#### 2-1. 必要なアイコンをインポートに追加（ファイル冒頭）

```typescript
// Before:
import { Search, Filter, X, CheckCircle, XCircle, Clock, Users, Calendar, AlertTriangle, Star, ChevronRight } from 'lucide-react';

// After:
import { Search, Filter, X, CheckCircle, XCircle, Clock, Users, Calendar, AlertTriangle, Star, ChevronRight, Heart, Ban, FileText } from 'lucide-react';
```

#### 2-2. toggleWorkerFavoriteとtoggleWorkerBlockをインポート

ファイル冒頭のインポート部分に追加:

```typescript
import { getApplicationsByWorker, getApplicationsByJob, toggleWorkerFavorite, toggleWorkerBlock } from '@/src/lib/actions';
```

#### 2-3. WorkerWithApplications型を更新（約74行目付近）

```typescript
// Before:
interface WorkerWithApplications {
  worker: {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    location: string | null;
    rating: number | null;
    reviewCount: number;
    totalWorkDays: number;
    lastMinuteCancelRate: number;
  };
  applications: ApplicationData[];
}

// After:
interface WorkerWithApplications {
  worker: {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    location: string | null;
    rating: number | null;
    reviewCount: number;
    totalWorkDays: number;
    lastMinuteCancelRate: number;
    experienceFields: Array<{ field: string; years: string }>;  // 追加
    isFavorite: boolean;  // 追加
    isBlocked: boolean;   // 追加
  };
  applications: ApplicationData[];
}
```

#### 2-4. ヘルパー関数を追加（WorkerWithApplications型定義の後、コンポーネント定義の前）

```typescript
// 経験分野の省略名を取得
const getAbbreviation = (field: string): string => {
  const abbreviations: Record<string, string> = {
    '特別養護老人ホーム': '特養',
    '介護老人保健施設': '老健',
    'グループホーム': 'GH',
    'デイサービス': 'デイ',
    '訪問介護': '訪介',
    '有料老人ホーム': '有料',
    'サービス付き高齢者向け住宅': 'サ高住',
  };
  return abbreviations[field] || field;
};

// 経験分野の色を取得
const getExperienceColor = (field: string): string => {
  const colors: Record<string, string> = {
    '特別養護老人ホーム': 'bg-blue-600',
    '介護老人保健施設': 'bg-indigo-600',
    'グループホーム': 'bg-purple-600',
    'デイサービス': 'bg-orange-500',
    '訪問介護': 'bg-green-600',
    '有料老人ホーム': 'bg-pink-600',
    'サービス付き高齢者向け住宅': 'bg-teal-600',
  };
  return colors[field] || 'bg-gray-600';
};
```

#### 2-5. お気に入り/ブロック状態を管理するstateを追加

コンポーネント内、他のstateの定義箇所（約160行目付近）に追加:

```typescript
// お気に入り・ブロック状態のローカル管理
const [workerStates, setWorkerStates] = useState<Record<number, { isFavorite: boolean; isBlocked: boolean }>>({});
```

#### 2-6. お気に入り/ブロック切り替えハンドラーを追加

コンポーネント内、他のハンドラー関数の近くに追加:

```typescript
// お気に入り切り替え
const handleToggleFavorite = async (workerId: number, currentState: boolean) => {
  const result = await toggleWorkerFavorite(workerId, facilityId);
  if (result.success) {
    setWorkerStates(prev => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        isFavorite: result.isFavorite ?? !currentState,
        isBlocked: prev[workerId]?.isBlocked ?? false,
      }
    }));
  }
};

// ブロック切り替え
const handleToggleBlock = async (workerId: number, currentState: boolean) => {
  const result = await toggleWorkerBlock(workerId, facilityId);
  if (result.success) {
    setWorkerStates(prev => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        isFavorite: prev[workerId]?.isFavorite ?? false,
        isBlocked: result.isBlocked ?? !currentState,
      }
    }));
  }
};
```

#### 2-7. ワーカーカードのUI変更（約496-583行目付近）

現在のワーカーカード部分を以下のように置き換え:

```tsx
{/* ワーカーカード */}
{filteredWorkerApplications.map((item) => {
  const localState = workerStates[item.worker.id];
  const isFavorite = localState?.isFavorite ?? item.worker.isFavorite;
  const isBlocked = localState?.isBlocked ?? item.worker.isBlocked;

  return (
    <div
      key={item.worker.id}
      className={`bg-white rounded-lg shadow-sm border ${
        isBlocked ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
      } overflow-hidden hover:shadow-md transition-shadow cursor-pointer`}
      onClick={() => {
        // ワーカー詳細ページに遷移（タブ情報を含める）
        window.location.href = `/admin/workers/${item.worker.id}?returnTab=workers`;
      }}
    >
      <div className="p-4">
        {/* ヘッダー部分 */}
        <div className="flex items-start gap-3 mb-3">
          {/* プロフィール画像 */}
          <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
            {item.worker.profileImage ? (
              <img
                src={item.worker.profileImage}
                alt={item.worker.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                👤
              </div>
            )}
          </div>

          {/* 名前・評価・場所 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 truncate">{item.worker.name}</h3>
              {isFavorite && (
                <Heart className="w-4 h-4 text-pink-500 fill-current flex-shrink-0" />
              )}
              {isBlocked && (
                <Ban className="w-4 h-4 text-red-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {item.worker.rating !== null && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                  {item.worker.rating.toFixed(1)}
                  <span className="text-xs">({item.worker.reviewCount})</span>
                </span>
              )}
              {item.worker.location && (
                <span className="truncate">{item.worker.location}</span>
              )}
            </div>
          </div>

          {/* お気に入り・ブロックボタン */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(item.worker.id, isFavorite);
              }}
              className={`w-7 h-7 border rounded-full flex items-center justify-center transition-colors shadow-sm ${
                isFavorite
                  ? 'bg-pink-50 border-pink-200 text-pink-500'
                  : 'bg-white border-gray-200 hover:bg-pink-50 text-gray-400 hover:text-pink-500'
              }`}
              title="お気に入り"
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleBlock(item.worker.id, isBlocked);
              }}
              className={`w-7 h-7 border rounded-full flex items-center justify-center transition-colors shadow-sm ${
                isBlocked
                  ? 'bg-red-50 border-red-200 text-red-500'
                  : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-400 hover:text-gray-700'
              }`}
              title="ブロック"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 資格バッジ */}
        {item.worker.qualifications.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.worker.qualifications.map((qual, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {qual}
              </span>
            ))}
          </div>
        )}

        {/* 経験分野アイコン（ホバーでツールチップ表示） */}
        {item.worker.experienceFields && item.worker.experienceFields.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {item.worker.experienceFields.map((exp, i) => (
              <div
                key={i}
                className={`group relative px-2 py-1 ${getExperienceColor(exp.field)} text-white rounded-md cursor-help shadow-sm text-xs font-medium`}
              >
                {getAbbreviation(exp.field)} {exp.years}
                {/* ツールチップ */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {exp.field}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 統計情報 */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            勤務{item.worker.totalWorkDays}日
          </span>
          <span className={`flex items-center gap-1 ${
            item.worker.lastMinuteCancelRate > 10 ? 'text-red-500' : ''
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            直前キャンセル{item.worker.lastMinuteCancelRate.toFixed(1)}%
          </span>
        </div>

        {/* 応募一覧ボタン */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedWorker(item);
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          応募一覧を見る（{item.applications.length}件）
        </button>
      </div>
    </div>
  );
})}
```

---

### 3. ワーカー詳細ページからの戻り処理

#### 3-1. `/app/admin/workers/[id]/page.tsx` の戻るボタンを修正

戻るボタンのクリックハンドラーを修正（約180行目付近の戻るボタン）:

```tsx
// Before:
<button onClick={() => router.back()} ...>

// After:
<button
  onClick={() => {
    const params = new URLSearchParams(window.location.search);
    const returnTab = params.get('returnTab');
    if (returnTab === 'workers') {
      router.push('/admin/applications?tab=workers');
    } else if (returnTab === 'jobs') {
      router.push('/admin/applications?tab=jobs');
    } else {
      router.back();
    }
  }}
  ...
>
```

#### 3-2. 応募管理画面でURLパラメータからタブを復元

`/app/admin/applications/page.tsx`のコンポーネント冒頭、useEffectを追加:

```typescript
// URLパラメータからタブを復元
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam === 'workers' || tabParam === 'jobs') {
    setActiveTab(tabParam);
  }
}, []);
```

---

## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. キャッシュクリアと再ビルド
tailwind.config.ts、globals.css、その他スタイル関連ファイルを変更した場合：
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
# 既存のサーバーを停止してから
rm -rf .next && npm run dev
```

### 4. ブラウザ確認
- ハードリロード（Cmd+Shift+R または Ctrl+Shift+R）で確認
- DevToolsのNetworkタブで「Disable cache」をチェックして確認
- 以下の動作を確認:
  1. `/admin/applications`にアクセス
  2. 「ワーカーから」タブを選択
  3. ワーカーカードに経験分野アイコンが表示されることを確認
  4. アイコンにマウスホバーでツールチップが表示されることを確認
  5. お気に入り/ブロックボタンが機能することを確認
  6. カードクリックでワーカー詳細に遷移することを確認
  7. 「応募一覧を見る」ボタンでモーダルが開くことを確認
  8. ワーカー詳細から戻るボタンで「ワーカーから」タブに戻ることを確認

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること：
- `src/lib/actions.ts`
- `app/admin/applications/page.tsx`
- `app/admin/workers/[id]/page.tsx`

---

## 注意事項

- 既存のモーダル表示ロジック（`selectedWorker`ステート）は維持すること
- カードクリック時は`window.location.href`を使用すること（router.pushだとステートがリセットされる）
- お気に入り/ブロックボタンのクリックイベントは`e.stopPropagation()`で伝播を止めること
