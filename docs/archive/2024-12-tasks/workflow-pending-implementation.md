# 未完了作業の対応ワークフロー

デバッグシートで未対応・調査中の項目を優先度順に対応するためのワークフロー。

## ブランチ戦略

```
main
  ├── fix/critical-bugs          # 緊急バグ対応
  ├── fix/high-priority-bugs     # 高優先度バグ
  ├── feature/notifications      # 通知機能実装
  ├── feature/limited-jobs       # 限定・指名求人機能
  └── improve/ux-enhancements    # UX改善（普通優先度）
```

## 優先度別対応一覧

### 🚨 緊急（Critical）- 即時対応

| ID | 種別 | 概要 | ステータス | 対応ブランチ |
|----|------|------|------------|-------------|
| #69 | バグ | 求人一覧の表示問題（遅い、表示バグ） | 調査中 | fix/critical-bugs |
| #71 | その他 | メール・通知機能未実装 | 調査中 | feature/notifications |
| #72 | バグ | 求人管理・応募管理のソート問題 | 未対応 | fix/critical-bugs |
| #64 | 機能 | 限定・指名求人機能 | 対応・未チェック | feature/limited-jobs |

### 🔴 高（High）- 1週間以内対応

| ID | 種別 | 概要 | ステータス | 対応ブランチ |
|----|------|------|------------|-------------|
| #67 | バグ | 仕事を探すページnetlifyエラー | 調査中 | fix/high-priority-bugs |
| #70 | その他 | 全体的なスピード遅い | 調査中 | improve/performance |
| #35 | 提案 | 求人ページ左寄り | 未対応 | improve/ux-enhancements |
| #58 | 提案 | 身分証撮影機能 | 未対応 | feature/id-verification |
| #38 | 提案 | メールアドレス有効性確認 | 未対応 | feature/email-verification |

### 🟡 普通（Medium）- 2週間以内対応

| ID | 種別 | 概要 | ステータス |
|----|------|------|------------|
| #9 | 提案 | 求人詳細ページ余白問題 | 未対応 |
| #27 | 提案 | 施設名・法人名ヘッダー表示 | 未対応 |
| #45 | 提案 | パスワード同一設定エラーメッセージ | 未対応 |
| #48 | 提案 | 実働時間自動計算 | 未対応 |
| #62 | 提案 | ダイレクト流入時ナビゲーション | 未対応 |
| #65 | 提案 | 求人1列表示 | 未対応 |
| #16 | 提案 | 交通費0円表示 | 未対応 |
| #28 | 提案 | 業務設定と仕事詳細テンプレ連携 | 未対応 |
| #36 | 提案 | 求人プレビュー左寄り | 未対応 |
| #61 | 提案 | 不採用通知 | 未対応 |
| #63 | 提案 | マッチング確認ポップアップ | 未対応 |
| #7 | 提案 | 時給コンマ表示 | 未対応 |
| #32 | 提案 | 経験追加ボタン | 未対応 |
| #42 | 提案 | 希望時刻不要検討 | 未対応 |
| #47 | 提案 | 緊急連絡先任意化 | 未対応 |
| #57 | 提案 | メッセージURLタブ遷移 | 未対応 |
| #10 | バグ | リアルタイムメッセージ更新 | 要ヒアリング |

### 🟢 低（Low）- バックログ

| ID | 種別 | 概要 |
|----|------|------|
| #24 | 提案 | PW変更6桁/8桁整合性 |
| #12 | 提案 | タブ色統一 |
| #59 | 提案 | プロフィール項目分離 |
| #13 | 提案 | 希望開始時刻デフォルト |
| #56 | 提案 | 通帳コピー不要・銀行選択 |

### ❓ 要ヒアリング

| ID | 概要 | 確認事項 |
|----|------|----------|
| #44 | ワーカー登録情報整理 | 各段階の必要情報の詳細 |
| #25 | 法人番号での勤務時間管理 | 複数施設管理の仕様 |
| #39 | 経験入力方法改善 | UIの複雑さと操作性のバランス |

---

## Phase 1: 緊急バグ対応

### ブランチ: `fix/critical-bugs`

#### #72: 求人管理・応募管理のソート問題

**問題**: ソートが正しく機能していない

**調査ポイント**:
```typescript
// 確認ファイル
app/admin/jobs/page.tsx        // 求人管理
app/admin/applications/page.tsx // 応募管理
```

**対応方針**:
1. 現在のソートロジック確認
2. 期待する仕様の明確化
3. ソート条件の修正

**テスト**:
```typescript
// tests/e2e/fix/sort-fix.spec.ts
test.describe('ソート機能修正', () => {
  test('求人一覧が作成日順にソートされる', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs');

    // 作成日でソート
    await page.click('[data-sort="createdAt"]');

    const dates = await page.locator('[data-created-at]').allTextContents();
    // 降順確認
    for (let i = 0; i < dates.length - 1; i++) {
      expect(new Date(dates[i]) >= new Date(dates[i + 1])).toBeTruthy();
    }
  });

  test('応募一覧がステータス順にソートされる', async ({ page }) => {
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/applications');

    await page.click('[data-sort="status"]');
    // 期待されるソート順の確認
  });
});
```

#### #69: 求人一覧の表示問題

**問題**:
- 表示が遅い
- 応募できないはずの求人が表示される
- 表示されるべき求人が出てこない

**調査ポイント**:
```typescript
// 確認ファイル
app/jobs/page.tsx              // 求人一覧
app/api/jobs/route.ts          // API
lib/actions/job-actions.ts     // Server Actions
```

**対応方針**:
1. クエリ最適化（インデックス確認）
2. フィルタリングロジック修正
3. キャッシュ戦略見直し

**テスト**:
```typescript
// tests/e2e/fix/job-list-fix.spec.ts
test.describe('求人一覧表示修正', () => {
  test('過去の求人が表示されない', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForSelector('.job-card');

    const today = new Date().toISOString().split('T')[0];
    const workDates = await page.locator('[data-work-date]').allTextContents();

    for (const date of workDates) {
      expect(date >= today).toBeTruthy();
    }
  });

  test('3秒以内に求人一覧が表示される', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/jobs');
    await page.waitForSelector('.job-card');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });
});
```

---

## Phase 2: 限定・指名求人機能

### ブランチ: `feature/limited-jobs`

#### #64: 限定・指名求人機能

**機能要件**:
1. 限定求人（特定条件のワーカーのみ表示）
2. 指名求人（特定ワーカーのみに送信）

**実装計画**:

```typescript
// 1. DBスキーマ拡張
// prisma/schema.prisma
model Job {
  // 既存フィールド
  ...

  // 限定・指名関連
  visibility       JobVisibility @default(PUBLIC)
  targetWorkerIds  String[]      @default([])
  targetConditions Json?
}

enum JobVisibility {
  PUBLIC      // 公開
  LIMITED     // 限定（条件付き）
  NOMINATED   // 指名（特定ワーカーのみ）
}

// 2. 求人作成フォーム拡張
// components/admin/JobForm.tsx
const visibilityOptions = [
  { value: 'PUBLIC', label: '一般公開' },
  { value: 'LIMITED', label: '限定公開' },
  { value: 'NOMINATED', label: '指名' },
];

// 3. ワーカー選択UI
// components/admin/WorkerSelector.tsx
export function WorkerSelector({
  onSelect
}: {
  onSelect: (workerIds: string[]) => void
}) {
  // ワーカー検索・選択UI
}

// 4. 求人一覧フィルタリング
// lib/actions/job-actions.ts
export async function getVisibleJobs(workerId: string) {
  // PUBLIC: 全員に表示
  // LIMITED: 条件に合致するワーカーに表示
  // NOMINATED: targetWorkerIdsに含まれるワーカーに表示
}
```

**テスト**:
```typescript
// tests/e2e/feature/limited-jobs.spec.ts
test.describe('限定・指名求人機能', () => {
  test('指名求人が指定ワーカーにのみ表示される', async ({ page }) => {
    // 1. 施設管理者で指名求人作成
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/new');
    await page.selectOption('[name="visibility"]', 'NOMINATED');
    await page.click('[data-testid="select-worker"]');
    await page.click('[data-worker-id="worker-1"]');
    await page.click('button[type="submit"]');

    // 2. 指名されたワーカーで確認
    await loginAsWorker(page, 'worker-1');
    await page.goto('/jobs');
    await expect(page.getByText('指名求人タイトル')).toBeVisible();

    // 3. 指名されていないワーカーで確認
    await loginAsWorker(page, 'worker-2');
    await page.goto('/jobs');
    await expect(page.getByText('指名求人タイトル')).not.toBeVisible();
  });

  test('限定求人が条件合致ワーカーにのみ表示される', async ({ page }) => {
    // 条件: 介護福祉士資格保持者のみ
    await loginAsFacilityAdmin(page);
    await page.goto('/admin/jobs/new');
    await page.selectOption('[name="visibility"]', 'LIMITED');
    await page.check('[data-condition="certification-careWorker"]');
    await page.click('button[type="submit"]');

    // 介護福祉士保持ワーカーで確認
    await loginAsWorkerWithCertification(page, 'careWorker');
    await page.goto('/jobs');
    await expect(page.getByText('限定求人タイトル')).toBeVisible();
  });
});
```

---

## Phase 3: 通知機能実装

### ブランチ: `feature/notifications`

#### #71: メール・通知機能

**機能要件**:
1. メール通知（応募受付、マッチング成立、メッセージ受信）
2. プッシュ通知（ブラウザ/アプリ）
3. アプリ内通知

**実装計画**:

```typescript
// 1. 通知設定モデル
// prisma/schema.prisma
model NotificationSetting {
  id        String   @id @default(cuid())
  userId    String   @unique
  email     Boolean  @default(true)
  push      Boolean  @default(true)
  inApp     Boolean  @default(true)

  // 通知種別ごとの設定
  onApplication   Boolean @default(true)
  onMatching      Boolean @default(true)
  onMessage       Boolean @default(true)
  onJobUpdate     Boolean @default(true)
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  body      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

// 2. 通知サービス
// lib/services/notification-service.ts
export class NotificationService {
  async send(userId: string, notification: NotificationPayload) {
    const settings = await this.getSettings(userId);

    if (settings.email) {
      await this.sendEmail(userId, notification);
    }
    if (settings.push) {
      await this.sendPush(userId, notification);
    }
    if (settings.inApp) {
      await this.saveInApp(userId, notification);
    }
  }

  private async sendEmail(userId: string, notification: NotificationPayload) {
    // Resend/SendGrid等を使用
  }
}

// 3. 通知トリガー
// lib/actions/application-actions.ts
export async function applyToJob(workerId: string, jobId: string) {
  const application = await prisma.application.create({ ... });

  // 施設管理者に通知
  await notificationService.send(job.facility.managerId, {
    type: 'APPLICATION_RECEIVED',
    title: '新しい応募がありました',
    body: `${worker.name}さんが「${job.title}」に応募しました`,
  });

  return application;
}
```

**テスト**:
```typescript
// tests/e2e/feature/notifications.spec.ts
test.describe('通知機能', () => {
  test('応募時に施設管理者にメール通知が送信される', async ({ page }) => {
    // メールモック設定
    await mockEmailService();

    await loginAsWorker(page);
    await page.goto('/jobs/1');
    await page.click('button:has-text("応募する")');

    // メール送信確認
    const sentEmails = await getMailMockData();
    expect(sentEmails).toContainEqual(
      expect.objectContaining({
        to: 'facility@example.com',
        subject: expect.stringContaining('新しい応募')
      })
    );
  });

  test('通知設定画面で設定変更ができる', async ({ page }) => {
    await loginAsWorker(page);
    await page.goto('/mypage/settings/notifications');

    await page.uncheck('[name="emailOnMessage"]');
    await page.click('button:has-text("保存")');

    await expect(page.getByText('設定を保存しました')).toBeVisible();
  });
});
```

---

## Phase 4: UX改善

### ブランチ: `improve/ux-enhancements`

#### 対象項目

| ID | 概要 | 工数 |
|----|------|------|
| #35 | 求人ページ左寄り修正 | S |
| #9 | 求人詳細ページ余白 | S |
| #36 | 求人プレビュー左寄り | S |
| #7 | 時給コンマ表示 | S |
| #65 | 求人1列表示 | M |
| #62 | ダイレクト流入時ナビ | M |

**一括対応計画**:

```typescript
// 1. レイアウト修正
// app/jobs/page.tsx
<div className="container mx-auto px-4 max-w-4xl">
  {/* 中央寄せ、適切な余白 */}
</div>

// 2. 金額フォーマット共通化
// lib/utils/format.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount);
}

// 使用例
<span>{formatCurrency(job.hourlyWage)}円/時</span>
// 出力: 1,200円/時

// 3. グローバルナビゲーション
// components/layout/GlobalNav.tsx
export function GlobalNav() {
  return (
    <nav className="fixed bottom-0 w-full bg-white border-t">
      <Link href="/">TOP</Link>
      <Link href="/jobs">求人</Link>
      <Link href="/mypage">マイページ</Link>
    </nav>
  );
}
```

**テスト**:
```typescript
// tests/e2e/improve/ux-improvements.spec.ts
test.describe('UX改善', () => {
  test('求人ページが中央寄せで表示される', async ({ page }) => {
    await page.goto('/jobs');
    const container = page.locator('.container');
    const style = await container.evaluate(el =>
      window.getComputedStyle(el)
    );
    expect(style.marginLeft).not.toBe('0px');
    expect(style.marginRight).not.toBe('0px');
  });

  test('時給が3桁区切りで表示される', async ({ page }) => {
    await page.goto('/jobs');
    const wage = page.locator('[data-wage]').first();
    const text = await wage.textContent();
    expect(text).toMatch(/\d{1,3}(,\d{3})*円/);
  });

  test('モバイルでグローバルナビが表示される', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/jobs/1');

    await expect(page.locator('[data-testid="global-nav"]')).toBeVisible();
    await page.click('a:has-text("TOP")');
    await expect(page.url()).toBe('/');
  });
});
```

---

## 実行スケジュール

### Week 1: 緊急対応
```bash
git checkout -b fix/critical-bugs
# #72: ソート修正
# #69: 求人一覧修正
npm run test:e2e -- tests/e2e/fix/
git push origin fix/critical-bugs
# PR → Review → Merge
```

### Week 2: 通知機能
```bash
git checkout -b feature/notifications
# #71: 通知機能実装
npm run test:e2e -- tests/e2e/feature/notifications.spec.ts
git push origin feature/notifications
# PR → Review → Merge
```

### Week 3: 限定・指名求人
```bash
git checkout -b feature/limited-jobs
# #64: 限定・指名求人機能
npx prisma migrate dev --name add-job-visibility
npm run test:e2e -- tests/e2e/feature/limited-jobs.spec.ts
git push origin feature/limited-jobs
# PR → Review → Merge
```

### Week 4: UX改善
```bash
git checkout -b improve/ux-enhancements
# #35, #9, #36, #7, #65, #62: UX改善一括
npm run test:e2e -- tests/e2e/improve/
git push origin improve/ux-enhancements
# PR → Review → Merge
```

---

## CI/CD設定

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## チェックリスト

### PR作成時
- [ ] テストが全て通過している
- [ ] TypeScriptエラーがない (`npm run build`)
- [ ] Lintエラーがない (`npm run lint`)
- [ ] 関連するデバッグシートIDをPR説明に記載

### マージ前
- [ ] コードレビュー完了
- [ ] E2Eテスト通過
- [ ] ステージング環境での動作確認
- [ ] デバッグシートのステータス更新準備

### マージ後
- [ ] 本番デプロイ確認
- [ ] デバッグシートのステータスを「完了」に更新
- [ ] 関連するテストが継続的に通過することを確認
