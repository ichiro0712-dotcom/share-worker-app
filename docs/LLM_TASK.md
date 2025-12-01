# LLM Task Communication File

Lead LLM（Claude Code/有料）とWorker LLM（無料LLM）間の連携用ファイルです。

---

## Current Task

### Status: `ASSIGNED`
<!-- Status values: ASSIGNED | IN_PROGRESS | COMPLETED | NEEDS_REVIEW | APPROVED -->

### Task ID: PROFILE-002
### Assigned: 2024-12-01

---

## 🎯 タスク概要

プロフィール編集ページ（`/mypage/profile`）の以下の改修を行う：

1. **DB変更**: 新フィールド追加・型変更
2. **UI変更**: 選択肢の変更、入力バリデーション追加
3. **バリデーション**: カナ・メール・電話番号・郵便番号のリアルタイムチェック

---

## 📋 作業内容

### Part 1: DBスキーマ変更

ファイル: `prisma/schema.prisma`

**変更内容**:

```prisma
// User モデル内で以下を変更・追加

// 変更: desired_work_days_week を Int? から String? に変更
desired_work_days_week  String?   @map("desired_work_days_week")  // 希望勤務日数/週: "週1〜2日", "週3〜4日", "週5日以上"

// 追加: 勤務期間フィールド
desired_work_period     String?   @map("desired_work_period")     // 希望勤務期間: "1週間以内", "3週間以内", "1〜2ヶ月", "3〜4ヶ月", "4ヶ月以上"
```

**マイグレーション実行**:
```bash
cd /Users/kawashimaichirou/Desktop/バイブコーディング/シェアワーカーアプリ
npx prisma db push
npx prisma generate
npx prisma validate
```

---

### Part 2: ProfileEditClient.tsx の修正

ファイル: `app/mypage/profile/ProfileEditClient.tsx`

#### 2-1. UserProfile インターフェース更新

```typescript
interface UserProfile {
  // ... 既存フィールド ...
  desired_work_days_week: string | null;  // Int? → String? に変更
  desired_work_period: string | null;     // 新規追加
  // ... 他のフィールド ...
}
```

#### 2-2. formData 初期化の変更

```typescript
const [formData, setFormData] = useState({
  // ... 既存 ...
  desiredWorkDaysPerWeek: userProfile.desired_work_days_week || '',  // 型変更に対応
  desiredWorkPeriod: userProfile.desired_work_period || '',          // 新規追加
  // ... 他 ...
});
```

#### 2-3. 国籍の選択肢を変更

現在のテキスト入力を、以下のselectに変更:

```tsx
<div>
  <label className="block text-sm font-medium mb-2">国籍 <span className="text-red-500">*</span></label>
  <select
    value={formData.nationality}
    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
    required
  >
    <option value="">選択してください</option>
    <option value="日本">日本</option>
    <option value="その他">その他</option>
  </select>
</div>
```

#### 2-4. 希望勤務日数の選択肢を変更

現在の数値入力を、以下のselectに変更:

```tsx
<div>
  <label className="block text-sm font-medium mb-2">希望勤務日数（週）</label>
  <select
    value={formData.desiredWorkDaysPerWeek}
    onChange={(e) => setFormData({ ...formData, desiredWorkDaysPerWeek: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
  >
    <option value="">選択してください</option>
    <option value="週1〜2日">週1〜2日</option>
    <option value="週3〜4日">週3〜4日</option>
    <option value="週5日以上">週5日以上</option>
  </select>
</div>
```

#### 2-5. 勤務期間の選択肢を追加（希望勤務日数の下に配置）

```tsx
<div>
  <label className="block text-sm font-medium mb-2">希望勤務期間</label>
  <select
    value={formData.desiredWorkPeriod}
    onChange={(e) => setFormData({ ...formData, desiredWorkPeriod: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
  >
    <option value="">選択してください</option>
    <option value="1週間以内">1週間以内</option>
    <option value="3週間以内">3週間以内</option>
    <option value="1〜2ヶ月">1〜2ヶ月</option>
    <option value="3〜4ヶ月">3〜4ヶ月</option>
    <option value="4ヶ月以上">4ヶ月以上</option>
  </select>
</div>
```

#### 2-6. 希望曜日に「特になし」を追加

weekDays定数を変更:

```typescript
const weekDays = ['月', '火', '水', '木', '金', '土', '日', '特になし'];
```

「特になし」チェック時は他をクリアするロジックを追加:

```typescript
const handleCheckboxChange = (field: 'qualifications' | 'experienceFields' | 'desiredWorkDays', value: string) => {
  setFormData(prev => {
    // 希望曜日で「特になし」がチェックされた場合
    if (field === 'desiredWorkDays' && value === '特になし') {
      if (prev.desiredWorkDays.includes('特になし')) {
        // 「特になし」を解除
        return { ...prev, desiredWorkDays: [] };
      } else {
        // 「特になし」のみにする
        return { ...prev, desiredWorkDays: ['特になし'] };
      }
    }

    // 希望曜日で「特になし」以外がチェックされた場合、「特になし」を外す
    if (field === 'desiredWorkDays' && value !== '特になし') {
      const filtered = prev.desiredWorkDays.filter(d => d !== '特になし');
      const isRemoving = filtered.includes(value);
      return {
        ...prev,
        desiredWorkDays: isRemoving
          ? filtered.filter(item => item !== value)
          : [...filtered, value]
      };
    }

    // 既存のロジック（経験分野など）
    const isRemoving = prev[field].includes(value);
    const newFormData = {
      ...prev,
      [field]: isRemoving
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    };

    if (field === 'experienceFields' && isRemoving) {
      const newExperienceYears = { ...prev.experienceYears };
      delete newExperienceYears[value];
      newFormData.experienceYears = newExperienceYears;
    }

    return newFormData;
  });
};
```

#### 2-7. 希望開始・終了時刻を時間のみ選択に変更

```tsx
{/* 時間選択オプションを生成する関数 */}
const timeOptions = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

{/* 希望開始時刻 */}
<div>
  <label className="block text-sm font-medium mb-2">希望開始時刻</label>
  <select
    value={formData.desiredStartTime}
    onChange={(e) => setFormData({ ...formData, desiredStartTime: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
  >
    <option value="">選択してください</option>
    {timeOptions.map((time) => (
      <option key={time} value={time}>{time}</option>
    ))}
  </select>
</div>

{/* 希望終了時刻 */}
<div>
  <label className="block text-sm font-medium mb-2">希望終了時刻</label>
  <select
    value={formData.desiredEndTime}
    onChange={(e) => setFormData({ ...formData, desiredEndTime: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
  >
    <option value="">選択してください</option>
    {timeOptions.map((time) => (
      <option key={time} value={time}>{time}</option>
    ))}
  </select>
</div>
```

#### 2-8. 資格リストに「実務者研修」を追加

「介護職員実務者研修」が既にあるが、念のため確認。qualificationsListを確認:

```typescript
const qualificationsList = [
  '介護福祉士',
  '介護職員初任者研修',
  '介護職員実務者研修',  // これが「実務者研修」に該当
  'ケアマネージャー',
  '社会福祉士',
  '看護師',
  '准看護師',
  'その他',
];
```

※「介護職員実務者研修」が既に存在する。これをそのまま使用。

#### 2-9. handleSubmit に desiredWorkPeriod を追加

```typescript
// 働き方・希望
form.append('desiredWorkDaysPerWeek', formData.desiredWorkDaysPerWeek);  // Int→String変更対応
form.append('desiredWorkPeriod', formData.desiredWorkPeriod);             // 新規追加
```

---

### Part 3: バリデーション追加

#### 3-1. バリデーション用のstate追加

```typescript
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
```

#### 3-2. バリデーション関数を追加

```typescript
// カタカナのみ許可（全角カタカナ）
const validateKatakana = (value: string): boolean => {
  return /^[ァ-ヶー　\s]*$/.test(value);
};

// メールアドレス形式
const validateEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

// 電話番号形式（数字とハイフンのみ）
const validatePhone = (value: string): boolean => {
  return /^[0-9\-]+$/.test(value);
};

// 郵便番号形式（XXX-XXXX または XXXXXXX）
const validatePostalCode = (value: string): boolean => {
  return /^[0-9]{3}-?[0-9]{4}$/.test(value);
};

// バリデーションを実行してエラーメッセージを返す
const validateField = (field: string, value: string): string => {
  if (!value) return '';  // 空の場合はチェックしない

  switch (field) {
    case 'lastNameKana':
    case 'firstNameKana':
    case 'accountName':
      if (!validateKatakana(value)) {
        return 'カタカナで入力してください';
      }
      break;
    case 'email':
      if (!validateEmail(value)) {
        return '正しいメールアドレス形式で入力してください';
      }
      break;
    case 'phone':
    case 'emergencyContactPhone':
      if (!validatePhone(value)) {
        return '電話番号は数字とハイフンのみで入力してください';
      }
      break;
    case 'postalCode':
      if (!validatePostalCode(value)) {
        return '郵便番号は「123-4567」または「1234567」の形式で入力してください';
      }
      break;
  }
  return '';
};
```

#### 3-3. 入力変更時にバリデーション実行

各入力フィールドの onChange を修正して、バリデーションを追加:

```typescript
// 例: 姓カナの入力
<div>
  <label className="block text-sm font-medium mb-2">姓（カナ） <span className="text-red-500">*</span></label>
  <input
    type="text"
    value={formData.lastNameKana}
    onChange={(e) => {
      const value = e.target.value;
      setFormData({ ...formData, lastNameKana: value });
      const error = validateField('lastNameKana', value);
      setValidationErrors(prev => ({ ...prev, lastNameKana: error }));
    }}
    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
      validationErrors.lastNameKana ? 'border-red-500' : 'border-gray-300'
    }`}
    required
  />
  {validationErrors.lastNameKana && (
    <p className="text-red-500 text-xs mt-1">{validationErrors.lastNameKana}</p>
  )}
</div>
```

以下のフィールドに同様のバリデーションを追加:
- `lastNameKana` (姓カナ)
- `firstNameKana` (名カナ)
- `email` (メールアドレス)
- `phone` (電話番号)
- `postalCode` (郵便番号)
- `emergencyContactPhone` (緊急連絡先電話番号)
- `accountName` (口座名義カナ)

---

### Part 4: actions.ts の更新

ファイル: `src/lib/actions.ts`

#### 4-1. getUserProfile に desiredWorkPeriod を追加

```typescript
return {
  // ... 既存フィールド ...
  desired_work_days_week: user.desired_work_days_week,  // Int→String対応済み
  desired_work_period: user.desired_work_period,         // 新規追加
  // ...
};
```

#### 4-2. updateUserProfile に desiredWorkPeriod を追加

FormDataから取得:
```typescript
const desiredWorkPeriod = formData.get('desiredWorkPeriod') as string | null;
```

prisma.user.update の data に追加:
```typescript
data: {
  // ... 既存フィールド ...
  desired_work_days_week: desiredWorkDaysPerWeek || null,  // Int→String対応（parseIntを削除）
  desired_work_period: desiredWorkPeriod || null,           // 新規追加
  // ...
}
```

#### 4-3. getWorkerDetail にも同様に追加

```typescript
return {
  // ... 既存フィールド ...
  desiredWorkDaysPerWeek: user.desired_work_days_week,  // String型に変更
  desiredWorkPeriod: user.desired_work_period,           // 新規追加
  // ...
};
```

---

## ✅ 完了条件

1. `npx prisma db push` がエラーなく完了
2. `npx prisma generate` がエラーなく完了
3. `npx prisma validate` がエラーなく完了
4. `npx tsc --noEmit` がエラーなく完了
5. プロフィール編集画面で以下が動作確認できる:
   - 国籍が「日本」「その他」の選択式になっている
   - 希望勤務日数が選択式になっている
   - 勤務期間の選択肢が追加されている
   - 希望曜日に「特になし」がある
   - 時刻選択が時間単位（0:00〜23:00）になっている
   - カナ入力時に漢字/ひらがなを入力するとエラーメッセージが表示される
   - メール、電話番号、郵便番号の形式チェックが動作する

---

## 📊 Worker LLM Report Section

### 作業完了後、以下を記入してください：

**作業ステータス**:

**実行したコマンドと結果**:
```

```

**変更したファイル一覧**:
| ファイル | 変更内容 |
|---------|---------|
| | |

**エラーがあった場合**:
```

```

**動作確認結果**:
- [ ] 国籍が選択式になっている
- [ ] 希望勤務日数が選択式になっている
- [ ] 勤務期間の選択肢がある
- [ ] 希望曜日に「特になし」がある
- [ ] 時刻選択が時間単位になっている
- [ ] バリデーションが動作する

### Task Execution Status
- [x] DB Schema Changes
- [x] UI Implementation (`ProfileEditClient.tsx`)
- [x] Backend Logic Update (`actions.ts`)
- [x] Validation Implementation
- [x] Verification (`tsc`, `prisma validate`)

### Executed Commands
```bash
npx prisma db push
npx prisma generate
npx prisma validate
npx tsc --noEmit
```

### Implementation Details
1. **Schema Changes**:
   - Changed `desired_work_days_week` from `Int` to `String`.
   - Added `desired_work_period` (String).
   - Added all other requested fields (address, emergency contact, experience, etc.).

2. **UI Updates**:
   - Converted Nationality, Desired Work Days, and Time inputs to Select dropdowns.
   - Added "特になし" option for Desired Days.
   - Implemented real-time validation for Kana, Email, Phone, and Postal Code.

3. **Backend Updates**:
   - Updated `getUserProfile` and `updateUserProfile` to handle new fields.
   - Updated `getWorkerDetail` to include new fields.
   - Fixed type mismatch in `app/admin/workers/[id]/page.tsx` (`desiredWorkDaysPerWeek`).

### Notes
- `npx tsc --noEmit` passed successfully.
- `desired_work_days` defaults to an empty array `[]`.
- `desired_work_days_week` is now stored as a string (e.g., "週3〜4日").

---

## 🔄 Lead LLM Review Section

### Review Status: `PENDING`

**確認項目**:
- [ ] DBスキーマが正しく変更されている
- [ ] 型変更（Int→String）が全箇所で対応されている
- [ ] 新フィールドが追加されている
- [ ] バリデーションが正しく動作している

---

## 📜 History

| Date | Action | By |
|------|--------|-----|
| 2024-12-01 | SCHEMA-001 completed - User model extension | Worker LLM |
| 2024-12-01 | SCHEMA-001 approved by Lead LLM | Lead LLM |
| 2024-12-01 | PROFILE-002 assigned - Profile form improvements | Lead LLM |
```
