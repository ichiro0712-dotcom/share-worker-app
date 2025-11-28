# LLM Task Communication File

This file is used for communication between the Lead LLM (Claude Code) and Worker LLM.
Both LLMs read and write to this file.

---

## Current Task

### Status: `ASSIGNED`
<!-- Status values: ASSIGNED | IN_PROGRESS | COMPLETED | NEEDS_REVIEW | APPROVED | REJECTED -->

### Task ID: SYNC-001
### Branch: `main`
### Assigned: 2024-11-29

---

## Instructions from Lead LLM

### Overview
The job edit page (`app/admin/jobs/[id]/edit/page.tsx`) is missing many features and UI elements that exist in the job create page (`app/admin/jobs/new/page.tsx`).

**Goal**: Make the edit page match the create page's UI/UX while keeping edit-specific functionality (like handling existing work dates with applications).

### Reference Files
- **Source of Truth (Copy FROM)**: `app/admin/jobs/new/page.tsx` (1559 lines)
- **Target (Copy TO)**: `app/admin/jobs/[id]/edit/page.tsx` (1177 lines)

### Detailed Differences to Fix

#### 1. 基本セクション (Basic Section)

| Item | new/page.tsx | edit/page.tsx | Fix Required |
|------|-------------|---------------|--------------|
| 施設ラベル | `施設 <span className="text-red-500">*</span>` | `施設` (no asterisk) | Add `<span className="text-red-500">*</span>` |
| 求人種別 | EXISTS (line 563-576) | MISSING | Add jobType select with JOB_TYPES |
| テンプレート選択 | EXISTS (line 594-614) | MISSING | NOT needed for edit (already created from template) |
| TOP画像ラベル | `TOP画像登録（3枚まで） <span className="text-red-500">*</span>` | `TOP画像（3枚まで）` | Change to `TOP画像登録（3枚まで） <span className="text-red-500">*</span>` |
| TOP画像説明文 | Has 2 description lines (line 634-635) | MISSING | Add description lines |
| Grid layout | 3 columns (施設/求人種別/募集人数) | 2 columns (施設/募集人数) | Change to 3 columns with jobType |

**New page has** (around line 630-636):
```tsx
<label className="block text-sm font-medium text-gray-700 mb-2">
  TOP画像登録（3枚まで） <span className="text-red-500">*</span>
</label>
<p className="text-xs text-gray-500 mb-2">推奨画像サイズ: 1200×800px（比率 3:2）</p>
<p className="text-xs text-gray-500 mb-3">登録できるファイルサイズは5MBまでです</p>
```

**Edit page needs the same** (currently just has):
```tsx
<label className="block text-sm font-medium text-gray-700 mb-2">
  TOP画像（3枚まで）
</label>
```

#### 2. 勤務日選択カレンダー (Work Date Calendar Section)

| Item | new/page.tsx | edit/page.tsx | Fix Required |
|------|-------------|---------------|--------------|
| Section title | `勤務日選択` | `勤務日` | Change to `勤務日選択` |
| Description text | Long description (line 726-728) | Short description (line 599-600) | Use new page's description |
| この月全てを選択 checkbox | EXISTS (line 809-852) | MISSING | Add this checkbox |
| 勤務日条件 checkboxes | EXISTS (line 894-967) | MISSING | Add (but disable for edit - already published) |
| Preview card title | `選択された求人カード（{count}件）` | `選択中の勤務日` | Change to match new page |

**New page calendar description** (line 726-728):
```tsx
<p className="text-sm text-gray-600 mb-4">
  選択した日付で、この条件の求人が作成されます。複数選択すると、1つの求人に複数の勤務日が設定されます。または「日付を選ばずに募集」を選択してください。
</p>
```

**Edit page should show** (modified for edit context):
```tsx
<p className="text-sm text-gray-600 mb-4">
  求人の勤務日を編集できます。応募がある勤務日は削除できません。
</p>
```

#### 3. 勤務時間セクション (Working Hours Section)

| Item | new/page.tsx | edit/page.tsx | Fix Required |
|------|-------------|---------------|--------------|
| 募集開始日 | EXISTS (line 1016-1044) | MISSING | Add but make READONLY/DISABLED for edit |
| 募集開始時間 | EXISTS (conditional) | MISSING | Add but make READONLY/DISABLED |
| 募集終了日 | EXISTS (line 1047-1060) | MISSING | Add with edit capability |
| 募集終了時間 | EXISTS (conditional) | MISSING | Add with edit capability |

**Important**: For edit page, 募集開始日 should be shown but disabled (readonly) since the job is already published. 募集終了日/時間 can be editable.

Add after breakTime select in edit page:
```tsx
{/* 募集開始日 - 編集画面では変更不可 */}
<div className="grid grid-cols-2 gap-4 mt-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      募集開始日 <span className="text-gray-400 text-xs">（変更不可）</span>
    </label>
    <input
      type="text"
      value="公開と同時に開始"
      disabled
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100 text-gray-500"
    />
  </div>
</div>

{/* 募集終了日・時間 */}
<div className="grid grid-cols-2 gap-4 mt-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      募集終了日 <span className="text-red-500">*</span>
    </label>
    <select
      value={formData.recruitmentEndDay}
      onChange={(e) => handleInputChange('recruitmentEndDay', Number(e.target.value))}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
    >
      {RECRUITMENT_END_DAY_OPTIONS.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </div>
  {formData.recruitmentEndDay !== 0 && formData.recruitmentEndDay !== -1 && (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        募集終了時間 <span className="text-red-500">*</span>
      </label>
      <input
        type="time"
        value={formData.recruitmentEndTime}
        onChange={(e) => handleInputChange('recruitmentEndTime', e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
    </div>
  )}
</div>
```

#### 4. その他セクション (Other Section)

| Item | new/page.tsx | edit/page.tsx | Fix Required |
|------|-------------|---------------|--------------|
| アイコンの説明文 | `チェックが多いほどより多くのワーカーから応募がきます!` | MISSING | Add blue explanation text |
| アイコンの必須マーク | `アイコン <span className="text-red-500">*</span>` | `アイコン` | Add asterisk |
| 添付ファイルラベル | `その他添付文章（3つまで）` | `添付ファイル（3つまで）` | Change label |
| 添付ファイル説明文 | `登録された文章は公開されます` (red text) | MISSING | Add red warning text |
| 労働条件通知書 | EXISTS (line 1510-1529) | MISSING | Add entire section |

**New page その他 section** (line 1410-1530):
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    アイコン <span className="text-red-500">*</span>
  </label>
  <p className="text-xs text-blue-600 mb-2">チェックが多いほどより多くのワーカーから応募がきます!</p>
  {/* icons checkboxes */}
</div>

<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    その他添付文章（3つまで）
  </label>
  <p className="text-xs text-red-500 mb-2">登録された文章は公開されます</p>
  {/* file upload */}
</div>

<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    労働条件通知書 <span className="text-red-500">*</span>
  </label>
  <p className="text-xs text-gray-500 mb-2">入力いただいた情報を元に作成しています。</p>
  <p className="text-xs text-gray-500 mb-3">「解雇の事由/その他関連する事項」のみ下記から変更可能です</p>
  <button
    type="button"
    onClick={() => toast('労働条件通知書の表示機能は開発中です', { icon: '🚧' })}
    className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors mb-3"
  >
    労働条件通知書
  </button>
  <textarea
    value={formData.dismissalReasons}
    onChange={(e) => handleInputChange('dismissalReasons', e.target.value)}
    rows={12}
    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
  />
</div>
```

#### 5. FormData State Additions

Add these fields to edit page's formData state:
```tsx
const [formData, setFormData] = useState({
  // ... existing fields ...
  jobType: '単発', // ADD
  recruitmentEndDay: 1, // ADD
  recruitmentEndTime: '12:00', // ADD
});
```

#### 6. Import Additions

Add these imports to edit page:
```tsx
import {
  // ... existing imports ...
  RECRUITMENT_END_DAY_OPTIONS, // ADD
} from '@/constants';
```

### Step-by-Step Instructions

1. **Open** `app/admin/jobs/[id]/edit/page.tsx`

2. **Add imports** at top:
   - Add `RECRUITMENT_END_DAY_OPTIONS` to the import from '@/constants'

3. **Update formData state** (around line 45-71):
   - Add `jobType: '単発'`
   - Add `recruitmentEndDay: 1`
   - Add `recruitmentEndTime: '12:00'`

4. **Update 基本セクション** (around line 490-590):
   - Add asterisk to 施設 label
   - Change grid from 2 columns to 3 columns
   - Add jobType select (but make it readonly for edit)
   - Update TOP画像 label and add description text
   - Add drag & drop functionality to image upload

5. **Update 勤務日選択セクション** (around line 593-743):
   - Change title from `勤務日` to `勤務日選択`
   - Update description text
   - Add "この月全てを選択" checkbox
   - Change preview title from `選択中の勤務日` to `選択された求人カード（{count}件）`
   - Add 勤務日条件 section (disabled for edit)

6. **Update 勤務時間セクション** (around line 745-788):
   - Add 募集開始日 (disabled/readonly)
   - Add 募集終了日/時間 selects

7. **Update その他セクション** (around line 1083-1162):
   - Add asterisk and blue text to アイコン
   - Change 添付ファイル label to その他添付文章
   - Add red warning text
   - Add entire 労働条件通知書 section

8. **Run build** to verify no errors:
   ```bash
   npm run build
   ```

9. **Test in browser**:
   - Go to http://localhost:3000/admin/jobs
   - Click 編集 on any job
   - Verify all UI elements match the 新規作成 page

### After Fixing

1. Run `npm run build` - must pass
2. Test edit page visually against new page
3. Update this file with your progress in the Worker Report Section
4. Commit with message: `UI統一: 求人編集画面を作成画面と統一`

---

## Worker LLM Report Section

### Progress Log
- Analyzed requirements for SYNC-001.
- Created implementation plan.
- Updated `app/admin/jobs/[id]/edit/page.tsx` to match `app/admin/jobs/new/page.tsx`.
- Verified build with `npm run build`.

### Fixes Applied
- **Basic Section**: Added asterisk to facility label, added job type select (readonly), updated TOP image label and description, changed grid to 3 columns.
- **Work Date Selection**: Changed title, updated description, added "Select All Month" checkbox, added "Work Date Conditions" (disabled), updated preview card title.
- **Work Time**: Added recruitment start day (readonly), recruitment end day/time (editable).
- **Other Section**: Added icon description and asterisk, changed attachment label and added warning, added Labor Condition Notification section.
- **State/Logic**: Added `jobType`, `recruitmentEndDay`, `recruitmentEndTime` to formData state.

### Files Changed
- `app/admin/jobs/[id]/edit/page.tsx`

### Build Status
- [x] `npm run build` passes
- [x] Visual comparison passed

### Commit Info
- **Commit Hash**:
- **Branch**: main

---

## Lead LLM Review Section

### Review Status: `PENDING`

---

## History

| Date | Action | By |
|------|--------|-----|
| 2024-11-29 | BUG-001 completed | Worker LLM |
| 2024-11-29 | BUG-002 - CSS fixed via cache clear | Lead LLM |
| 2024-11-29 | BUG-003 completed - admin/jobs/page.tsx fixed | Lead LLM |
| 2024-11-29 | SYNC-001 assigned - Sync edit page with new page UI | Lead LLM |
