# 無料LLM指示書: 資格リスト統一

## 目的
ワーカーの保有資格と求人の資格条件を統一し、システム全体で一貫した資格リストを使用する。

## 作業概要
1. 新しい資格定数ファイルを作成
2. 既存の資格リストを新定数に置き換え
3. UIをグループ表示に対応

---

## STEP 1: 資格定数ファイルの作成

### ファイル: `constants/qualifications.ts`（新規作成）

```typescript
/**
 * 資格関連の定数定義
 * ワーカー保有資格・求人資格条件で共通使用
 */

// 資格グループ定義
export const QUALIFICATION_GROUPS = [
  {
    name: '介護系資格',
    qualifications: [
      '介護福祉士',
      '認定介護福祉士',
      '実務者研修',
      '初任者研修',
      '介護職員基礎研修',
      'ヘルパー1級',
      'ヘルパー2級',
      '介護支援専門員',
      '認知症介護基礎研修',
      '認知症介護実践者研修',
      '認知症介護実践リーダー研修',
      '喀痰吸引等研修',
      '福祉用具専門相談員',
      'レクリエーション介護士1級',
      'レクリエーション介護士2級',
    ],
  },
  {
    name: '障害福祉系資格',
    qualifications: [
      '重度訪問介護従業者養成研修 基礎課程',
      '重度訪問介護従業者養成研修 追加課程',
      '同行援護従事者養成研修',
      '行動援護従事者養成研修',
      '全身性障害者ガイドヘルパー養成研修',
      '難病患者等ホームヘルパー養成研修 基礎課程I',
      '難病患者等ホームヘルパー養成研修 基礎課程II',
    ],
  },
  {
    name: '看護系資格',
    qualifications: [
      '看護師',
      '准看護師',
      '認定看護師',
      '専門看護師',
      '保健師',
      '助産師',
      '看護助手認定実務者',
    ],
  },
  {
    name: 'リハビリ系資格',
    qualifications: [
      '理学療法士',
      '作業療法士',
      '言語聴覚士',
      '柔道整復師',
      'あん摩マッサージ指圧師',
      'はり師',
      'きゅう師',
    ],
  },
  {
    name: '福祉相談系資格',
    qualifications: [
      '社会福祉士',
      '社会福祉主事',
      '精神保健福祉士',
    ],
  },
  {
    name: '医療系資格',
    qualifications: [
      '医師',
      '薬剤師',
      '保険薬剤師登録票',
      '歯科衛生士',
      '管理栄養士',
      '栄養士',
      '調理師',
      '医療事務認定実務者',
    ],
  },
  {
    name: 'その他',
    qualifications: [
      '保育士',
      'ドライバー(運転免許証)',
    ],
  },
] as const;

// フラットな資格リスト（ワーカー用：証明書アップロード対象）
export const WORKER_QUALIFICATIONS = QUALIFICATION_GROUPS.flatMap(
  (group) => group.qualifications
);

// 求人用資格条件（ワーカー資格 + 無資格可）
export const JOB_QUALIFICATION_OPTIONS = [
  ...WORKER_QUALIFICATIONS,
  '無資格可',
] as const;

// 型定義
export type WorkerQualification = typeof WORKER_QUALIFICATIONS[number];
export type JobQualificationOption = typeof JOB_QUALIFICATION_OPTIONS[number];
```

---

## STEP 2: 既存ファイルの修正

### 2-1. `constants/job.ts` の修正

**変更内容**: `QUALIFICATION_OPTIONS`を削除し、新定数をインポート

```typescript
// 削除する部分（33行目付近）:
// export const QUALIFICATION_OPTIONS = [
//   '介護福祉士', '実務者研修', ...
// ] as const;
// export type QualificationOption = typeof QUALIFICATION_OPTIONS[number];

// 追加（ファイル先頭のインポート部分）:
export { JOB_QUALIFICATION_OPTIONS, QUALIFICATION_GROUPS } from './qualifications';
export type { JobQualificationOption } from './qualifications';

// 後方互換性のため（他のファイルで QUALIFICATION_OPTIONS を使っている場合）
import { JOB_QUALIFICATION_OPTIONS } from './qualifications';
export const QUALIFICATION_OPTIONS = JOB_QUALIFICATION_OPTIONS;
```

### 2-2. `app/register/worker/page.tsx` の修正

**変更箇所**: `qualificationsList`配列を削除し、新定数を使用

```typescript
// 削除（114行目付近）:
// const qualificationsList = [
//   '介護福祉士',
//   '介護職員初任者研修',
//   ...
// ];

// 追加（インポート部分）:
import { QUALIFICATION_GROUPS, WORKER_QUALIFICATIONS } from '@/constants/qualifications';

// UIの変更（資格選択部分をグループ表示に変更）:
// 既存のチェックボックスリストを以下のようなグループ表示に変更

{QUALIFICATION_GROUPS.map((group) => (
  <div key={group.name} className="mb-4">
    <h4 className="text-sm font-semibold text-gray-700 mb-2">{group.name}</h4>
    <div className="grid grid-cols-2 gap-2">
      {group.qualifications.map((qual) => (
        <label key={qual} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.qualifications.includes(qual)}
            onChange={() => handleCheckboxChange(qual)}
            className="rounded border-gray-300"
          />
          <span>{qual}</span>
        </label>
      ))}
    </div>
  </div>
))}
```

### 2-3. `app/mypage/profile/ProfileEditClient.tsx` の修正

**同様の変更**: 資格選択UIをグループ表示に変更

```typescript
// インポート追加:
import { QUALIFICATION_GROUPS } from '@/constants/qualifications';

// 既存のqualificationsListを削除し、QUALIFICATION_GROUPSを使用
```

### 2-4. `app/admin/jobs/new/page.tsx` の修正

**変更箇所**: 資格条件選択UIをグループ表示に変更

```typescript
// インポート変更:
import { QUALIFICATION_GROUPS, JOB_QUALIFICATION_OPTIONS } from '@/constants/qualifications';

// 資格条件選択部分をグループ表示に変更
// ※「無資格可」は最後に別枠で表示

{QUALIFICATION_GROUPS.map((group) => (
  <div key={group.name} className="mb-4">
    <h4 className="text-sm font-semibold text-gray-700 mb-2">{group.name}</h4>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {group.qualifications.map((qual) => (
        <label key={qual} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.qualifications.includes(qual)}
            onChange={() => handleQualificationChange(qual)}
            className="rounded border-gray-300"
          />
          <span>{qual}</span>
        </label>
      ))}
    </div>
  </div>
))}

{/* 無資格可オプション（求人のみ） */}
<div className="mt-4 pt-4 border-t">
  <label className="flex items-center gap-2 text-sm">
    <input
      type="checkbox"
      checked={formData.qualifications.includes('無資格可')}
      onChange={() => handleQualificationChange('無資格可')}
      className="rounded border-gray-300"
    />
    <span className="font-medium">無資格可</span>
  </label>
</div>
```

### 2-5. `app/admin/jobs/[id]/edit/page.tsx` の修正

**2-4と同様の変更を適用**

### 2-6. `app/admin/jobs/templates/new/page.tsx` の修正

**2-4と同様の変更を適用**

### 2-7. `app/admin/jobs/templates/[id]/edit/page.tsx` の修正

**2-4と同様の変更を適用**

---

## STEP 3: システム管理画面の修正

### 3-1. `app/system-admin/workers/page.tsx` の修正

**変更箇所**: 保有資格フィルターを新定数に変更

```typescript
// インポート追加:
import { QUALIFICATION_GROUPS, WORKER_QUALIFICATIONS } from '@/constants/qualifications';

// フィルターのセレクトボックスをグループ化されたオプションに変更
<select>
  <option value="">すべての資格</option>
  {QUALIFICATION_GROUPS.map((group) => (
    <optgroup key={group.name} label={group.name}>
      {group.qualifications.map((qual) => (
        <option key={qual} value={qual}>{qual}</option>
      ))}
    </optgroup>
  ))}
</select>
```

### 3-2. `components/system-admin/analytics/AnalyticsFilters.tsx` の修正

**同様の変更を適用**

---

## STEP 4: その他の影響ファイル確認・修正

以下のファイルで資格関連の参照がある場合は確認・修正:

- `src/lib/actions.ts`
- `src/lib/system-actions.ts`
- `types/job.ts`
- `types/worker.ts`
- `prisma/seed.ts`

**確認ポイント**:
- `QUALIFICATION_OPTIONS`を参照している箇所 → `JOB_QUALIFICATION_OPTIONS`に変更
- ハードコードされた資格名がある場合 → 新定数と一致するか確認

---

## 作業完了後チェックリスト（必須）

### 1. TypeScriptエラーチェック
```bash
npm run build
```
エラーがあれば修正してから次へ進む。

### 2. キャッシュクリアと再ビルド
```bash
rm -rf .next && npm run build
```

### 3. 開発サーバー再起動
```bash
rm -rf .next && npm run dev
```

### 4. 動作確認
以下の画面で資格選択がグループ表示になっていることを確認:
- [ ] ワーカー登録画面 `/register/worker`
- [ ] プロフィール編集画面 `/mypage/profile`
- [ ] 求人作成画面 `/admin/jobs/new`
- [ ] 求人編集画面 `/admin/jobs/[id]/edit`
- [ ] テンプレート作成画面 `/admin/jobs/templates/new`
- [ ] テンプレート編集画面 `/admin/jobs/templates/[id]/edit`
- [ ] システム管理ワーカー一覧 `/system-admin/workers`（フィルター）

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること。

---

## 注意事項

1. **既存データとの互換性**: DBに保存されている資格名は変更しない。新しい資格リストに含まれない古い資格名がある場合、表示はされるが選択肢には出ない状態になる。

2. **証明書アップロード**: ワーカー登録/プロフィール編集では、資格を選択すると証明書アップロードUIが表示される。すべての資格で証明書アップロードが必要。

3. **無資格可の扱い**:
   - ワーカー側: 表示しない（選択肢に含めない）
   - 求人側: 最後に別枠で表示
