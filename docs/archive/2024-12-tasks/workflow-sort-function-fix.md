# ソート機能修正ワークフロー (#72)

## 概要
求人管理・応募管理ページにソート機能を追加する。

## 対象ページ

### Phase 1: 求人管理ページ (`/admin/jobs`)
### Phase 2: 応募管理・求人ビュー (`/admin/applications`)
### Phase 3: 応募管理・シフトビュー (`/admin/applications`)

---

## Phase 1: 求人管理ページ

### 1.1 要件
- ソートオプション:
  - 作成日順（新しい順/古い順）
  - 応募数順（多い順/少い順）
  - 時給順（高い順/低い順）
  - 勤務日順（近い順/遠い順）
- URLパラメータで状態保持 (`?sort=created_desc`)
- ページネーション時にソート維持

### 1.2 実装ファイル
```
app/admin/jobs/page.tsx          # ソートUI追加
src/lib/actions/job-admin.ts     # ソートロジック（サーバー側）
```

### 1.3 UI設計
```tsx
<select value={sort} onChange={handleSortChange}>
  <option value="created_desc">作成日（新しい順）</option>
  <option value="created_asc">作成日（古い順）</option>
  <option value="applied_desc">応募数（多い順）</option>
  <option value="applied_asc">応募数（少ない順）</option>
  <option value="wage_desc">時給（高い順）</option>
  <option value="wage_asc">時給（低い順）</option>
  <option value="workDate_asc">勤務日（近い順）</option>
</select>
```

### 1.4 テスト
```typescript
// tests/e2e/fix/admin-jobs-sort.spec.ts
test.describe('求人管理ソート機能', () => {
  test('作成日順でソートできる', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs?sort=created_desc');
    // ソートセレクトの値を確認
    await expect(page.locator('select[name="sort"]')).toHaveValue('created_desc');
  });

  test('ソート変更でURLが更新される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs');
    await page.selectOption('select[name="sort"]', 'wage_desc');
    await expect(page).toHaveURL(/sort=wage_desc/);
  });

  test('ページネーション時にソートが維持される', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs?sort=wage_desc');
    await page.click('[data-testid="next-page"]');
    await expect(page).toHaveURL(/sort=wage_desc/);
  });
});
```

---

## Phase 2: 応募管理・求人ビュー

### 2.1 要件
- ソートオプション:
  - 応募数順（多い順/少ない順）
  - 未確認応募順（多い順）
  - 勤務日順（近い順/遠い順）
- 既存のタブ切替と連携

### 2.2 実装ファイル
```
app/admin/applications/page.tsx  # ソートUI追加（求人ビュー）
```

### 2.3 テスト
```typescript
// tests/e2e/fix/admin-applications-sort.spec.ts
test.describe('応募管理・求人ビューソート機能', () => {
  test('応募数順でソートできる', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/applications?view=jobs');
    await page.selectOption('select[name="jobSort"]', 'applied_desc');
    // ソート結果を確認
  });
});
```

---

## Phase 3: 応募管理・シフトビュー

### 3.1 要件
- ソートオプション:
  - 日付順（近い順/遠い順）
  - 確定人数順
- カレンダー表示との整合性

### 3.2 実装ファイル
```
app/admin/applications/page.tsx  # ソートUI追加（シフトビュー）
```

### 3.3 テスト
```typescript
test.describe('応募管理・シフトビューソート機能', () => {
  test('日付順でソートできる', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/applications?view=shifts');
    // シフト一覧が日付順に表示されることを確認
  });
});
```

---

## 実装手順

### Step 1: 求人管理ページ
1. `app/admin/jobs/page.tsx` にソートセレクト追加
2. URLパラメータからソート状態を読み取り
3. ソート変更時にURLを更新
4. サーバー側でソート処理（必要に応じて）
5. テスト作成・実行

### Step 2: 応募管理・求人ビュー
1. `app/admin/applications/page.tsx` の求人ビューにソート追加
2. 既存フィルタとの連携確認
3. テスト作成・実行

### Step 3: 応募管理・シフトビュー
1. シフトビューにソート追加
2. カレンダー表示との整合性確認
3. テスト作成・実行

---

## チェックリスト

### 共通
- [ ] ソートUIが表示される
- [ ] ソート変更でデータが並び替わる
- [ ] URLパラメータにソート状態が保存される
- [ ] ページネーション時にソートが維持される
- [ ] TypeScriptエラーなし
- [ ] E2Eテスト通過

### 求人管理
- [ ] 作成日順ソート
- [ ] 応募数順ソート
- [ ] 時給順ソート
- [ ] 勤務日順ソート

### 応募管理
- [ ] 求人ビュー: 応募数順ソート
- [ ] シフトビュー: 日付順ソート
