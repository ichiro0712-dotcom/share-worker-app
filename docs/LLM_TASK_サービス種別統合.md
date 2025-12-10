# LLM作業指示書: サービス種別の統合

## 作業概要
「施設種別」と「サービス種別」の用語と選択肢リストを統一する。
新しく作成した `constants/serviceTypes.ts` を使用して、カテゴリ→詳細の2段階フィルターを実装する。

## 背景
- 施設登録画面では詳細なサービス種別（約40種類）を使用
- システム管理画面のフィルターでは大カテゴリ（4種類）を使用
- DBには詳細サービス名が保存されているため、現状ではフィルタリングが機能しない

## 新しい定数ファイル
`constants/serviceTypes.ts` が作成済み:
- `SERVICE_CATEGORIES`: カテゴリ → 詳細サービス種別のマッピング
- `SERVICE_TYPES`: 全サービス種別のフラットリスト
- `SERVICE_CATEGORY_LIST`: 全カテゴリ名のリスト
- `getCategoryByServiceType()`: 詳細 → カテゴリの逆引き
- `getServiceTypesByCategory()`: カテゴリ → 詳細リスト取得

---

## 作業1: 施設登録画面のサービス種別リストを定数から取得

### 対象ファイル
`app/admin/facility/page.tsx`

### 変更内容

**1. インポート追加（ファイル先頭）:**
```typescript
import { SERVICE_TYPES } from '@/constants/serviceTypes';
```

**2. ローカル定義を削除（145-188行目付近）:**
```typescript
// 削除: const serviceTypes = [ ... ];
```

**3. select部分の修正（1096行目付近）:**
変更前:
```typescript
{serviceTypes.map((type) => (
```
変更後:
```typescript
{SERVICE_TYPES.map((type) => (
```

---

## 作業2: システム管理画面 - 施設管理のフィルター修正

### 対象ファイル
`app/system-admin/facilities/page.tsx`

### 変更内容

**1. インポート追加:**
```typescript
import {
  SERVICE_CATEGORY_LIST,
  getServiceTypesByCategory,
  ServiceCategory
} from '@/constants/serviceTypes';
```

**2. State追加（既存のfacilityType stateの近く）:**
```typescript
const [serviceCategory, setServiceCategory] = useState('');
const [serviceType, setServiceType] = useState('');
```

**3. 詳細サービス種別リスト取得:**
```typescript
const serviceTypesInCategory = serviceCategory
  ? getServiceTypesByCategory(serviceCategory as ServiceCategory)
  : [];
```

**4. フィルター部分のUI変更（319行目付近）:**
変更前:
```tsx
<div>
    <label className="block text-xs font-medium text-slate-500 mb-1">サービス種別</label>
    <select
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={facilityType}
        onChange={(e) => setFacilityType(e.target.value)}
    >
        <option value="">すべて</option>
        <option value="介護施設">介護施設</option>
        <option value="医療機関">医療機関</option>
        <option value="保育施設">保育施設</option>
        <option value="障がい者支援施設">障がい者支援施設</option>
    </select>
</div>
```

変更後:
```tsx
<div>
    <label className="block text-xs font-medium text-slate-500 mb-1">サービスカテゴリ</label>
    <select
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={serviceCategory}
        onChange={(e) => {
            setServiceCategory(e.target.value);
            setServiceType(''); // カテゴリ変更時に詳細をリセット
        }}
    >
        <option value="">すべて</option>
        {SERVICE_CATEGORY_LIST.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
        ))}
    </select>
</div>
<div>
    <label className="block text-xs font-medium text-slate-500 mb-1">サービス種別</label>
    <select
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={serviceType}
        onChange={(e) => setServiceType(e.target.value)}
        disabled={!serviceCategory}
    >
        <option value="">すべて</option>
        {serviceTypesInCategory.map(type => (
            <option key={type} value={type}>{type}</option>
        ))}
    </select>
</div>
```

**5. fetchFacilities関数内のfiltersを修正:**
現在の `facilityType` の代わりに `serviceType` を使用:
```typescript
const filters = {
    // facilityType: facilityType || undefined,  // 削除
    facilityType: serviceType || undefined,  // 詳細サービス種別でフィルター
    // ...他のフィルター
};
```

**6. clearFilters関数の修正:**
```typescript
const clearFilters = () => {
    setSearch('');
    setServiceCategory('');
    setServiceType('');
    setPrefecture('');
    setCity('');
    // ...
};
```

**7. 空状態の条件修正（493行目付近）:**
```typescript
{(search || serviceCategory || serviceType || prefecture || city || distanceSearchEnabled) && (
```

---

## 作業3: システム管理画面 - 求人管理のフィルター修正

### 対象ファイル
`app/system-admin/jobs/page.tsx`

### 変更内容
作業2と同様のパターンで修正:

**1. インポート変更:**
```typescript
// 削除: import { FACILITY_TYPES } from '@/constants/job';
import {
  SERVICE_CATEGORY_LIST,
  getServiceTypesByCategory,
  ServiceCategory
} from '@/constants/serviceTypes';
```

**2. State変更:**
```typescript
// 変更前: const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
const [serviceCategoryFilter, setServiceCategoryFilter] = useState('');
const [serviceTypeFilter, setServiceTypeFilter] = useState('');
```

**3. UI修正（301行目付近）:**
施設管理と同じパターンで2段階セレクトに変更

**4. filters修正:**
```typescript
facilityType: serviceTypeFilter || undefined,
```

**5. clearFilters修正**

---

## 作業4: システム管理画面 - 施設新規登録

### 対象ファイル
`app/system-admin/facilities/new/page.tsx`

### 変更内容

**1. インポート追加:**
```typescript
import { SERVICE_TYPES } from '@/constants/serviceTypes';
```

**2. select部分の修正（110行目付近）:**
変更前:
```tsx
<option value="">選択してください</option>
<option value="介護施設">介護施設</option>
<option value="医療機関">医療機関</option>
<option value="保育施設">保育施設</option>
<option value="障がい者支援施設">障がい者支援施設</option>
<option value="その他">その他</option>
```

変更後:
```tsx
<option value="">選択してください</option>
{SERVICE_TYPES.map(type => (
    <option key={type} value={type}>{type}</option>
))}
```

---

## 作業5: アナリティクス画面のフィルター修正

### 対象ファイル
`components/system-admin/analytics/AnalyticsFilters.tsx`

### 変更内容

**1. インポート変更:**
```typescript
// 変更前: import { FACILITY_TYPES } from '@/constants/job';
import { SERVICE_CATEGORY_LIST } from '@/constants/serviceTypes';
```

**2. チェックボックス部分の修正（223行目付近）:**
変更前:
```tsx
{FACILITY_TYPES.map(t => (
```
変更後:
```tsx
{SERVICE_CATEGORY_LIST.map(t => (
```

**注意**: アナリティクスではカテゴリ単位での集計が適切なので、カテゴリリストを使用

---

## 作業6: 求人検索フィルターの確認

### 対象ファイル
`components/job/FilterModal.tsx`

### 確認内容
このファイルは既に `serviceTypes` を使用している可能性があるが、定数からインポートするように統一する。

---

## 作業完了後チェックリスト（必須）

### 1. TypeScriptエラーチェック
```bash
npm run build
```
エラーがあれば修正してから次へ進む。

### 2. キャッシュクリアと再起動
```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null
rm -rf .next && npm run dev
```

### 3. 動作確認
以下の画面で確認:
- [ ] `/admin/facility` - 施設登録画面でサービス種別リストが表示される
- [ ] `/system-admin/facilities` - カテゴリ→詳細の2段階フィルターが動作する
- [ ] `/system-admin/jobs` - カテゴリ→詳細の2段階フィルターが動作する
- [ ] `/system-admin/facilities/new` - サービス種別リストが表示される
- [ ] フィルタリングで実際にデータが絞り込まれる

### 4. 変更ファイルの報告
変更したファイル一覧を報告すること。

---

## 注意事項

1. **DBカラム名は変更しない**: `facility_type` はそのまま維持
2. **後方互換性**: `constants/job.ts` の `FACILITY_TYPES` は削除せず残す（他で使用している可能性）
3. **グリッドレイアウト**: 2段階フィルターを追加するとカラム数が増える。必要に応じて `md:grid-cols-5` などに調整
