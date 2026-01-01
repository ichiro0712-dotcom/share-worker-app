import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  loginAsFacilityAdmin,
  loginAsWorker,
  TEST_ACCOUNTS,
  waitForToast,
} from '../fixtures/auth.fixture';
import { openAdminNav, openWorkerBottomNav } from '../fixtures/navigation.fixture';
import { TIMEOUTS } from '../fixtures/test-data';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function ensureWorkerProfileComplete(email: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to update test worker profile.');
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(`Test worker not found: ${email}`);
    }

    await prisma.user.update({
      where: { email },
      data: {
        last_name_kana: 'テスト',
        first_name_kana: 'タロウ',
        gender: '男性',
        nationality: '日本',
        postal_code: '1500001',
        prefecture: '東京都',
        city: '渋谷区',
        address_line: '神宮前1-1-1',
        phone_number: '09012345678',
        emergency_name: '緊急連絡先',
        emergency_phone: '09000000000',
        current_work_style: '単発',
        desired_work_style: '単発',
        bank_name: 'テスト銀行',
        branch_name: 'テスト支店',
        account_name: 'テストタロウ',
        account_number: '1234567',
        bank_book_image: '/images/samples/bank_book.png',
        id_document: '/images/samples/driver_license.png',
        self_pr: 'E2Eテスト用の自己PRです。',
        qualifications: ['介護福祉士'],
        qualification_certificates: {
          '介護福祉士': '/images/samples/care_license.png',
        },
        experience_fields: {
          '特別養護老人ホーム': '1年',
        },
      },
    });

    const jobs = await prisma.job.findMany({
      select: { id: true, images: true },
    });
    const invalidHostPattern = /__mock-upload|127\.0\.0\.1/i;
    const fallbackImage = '/images/samples/facility_top_1.png';

    for (const job of jobs) {
      if (!job.images?.some((img) => invalidHostPattern.test(img))) {
        continue;
      }

      const cleanedImages = job.images.filter((img) => !invalidHostPattern.test(img));
      const nextImages = cleanedImages.length > 0 ? cleanedImages : [fallbackImage];
      await prisma.job.update({
        where: { id: job.id },
        data: { images: nextImages },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function findAvailableWorkDate(email: string, minDaysFromToday = 14, maxLookaheadDays = 90): Promise<Date> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to check scheduled jobs.');
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(`Test worker not found: ${email}`);
    }

    const scheduledApplications = await prisma.application.findMany({
      where: {
        user_id: user.id,
        status: { in: ['SCHEDULED', 'WORKING'] },
      },
      include: {
        workDate: true,
      },
    });

    const blockedDates = new Set<string>();
    for (const application of scheduledApplications) {
      if (!application.workDate?.work_date) {
        continue;
      }
      blockedDates.add(application.workDate.work_date.toISOString().split('T')[0]);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = minDaysFromToday; offset <= maxLookaheadDays; offset += 1) {
      const candidate = new Date(today);
      candidate.setDate(today.getDate() + offset);
      const key = candidate.toISOString().split('T')[0];
      if (!blockedDates.has(key)) {
        return candidate;
      }
    }

    return new Date(today.setDate(today.getDate() + minDaysFromToday));
  } finally {
    await prisma.$disconnect();
  }
}

async function openJobCreate(page: Page): Promise<void> {
  await openAdminNav(page, '求人管理', /\/admin\/jobs/);
  await page.waitForLoadState('networkidle');

  const createButton = page
    .locator('a[href="/admin/jobs/new"], button')
    .filter({ hasText: /新規作成|求人作成/ })
    .first();
  await expect(createButton).toBeVisible();
  await createButton.click();
  await page.waitForURL('/admin/jobs/new**');
  await page.waitForLoadState('networkidle');
}

async function selectFutureWorkDate(page: Page, daysFromToday = 1): Promise<Date> {
  const target = new Date();
  target.setDate(target.getDate() + daysFromToday);
  target.setHours(0, 0, 0, 0);

  const calendarSection = page.getByRole('heading', { name: /勤務日選択/ }).locator('..');
  const monthHeading = calendarSection.locator('h3').filter({ hasText: /\d{4}年\d{1,2}月/ }).first();
  const targetLabel = `${target.getFullYear()}年${target.getMonth() + 1}月`;

  for (let i = 0; i < 12; i += 1) {
    const headingText = (await monthHeading.textContent())?.trim();
    if (headingText && headingText.includes(targetLabel)) {
      break;
    }
    const header = monthHeading.locator('..');
    await header.locator('button').last().click();
    await page.waitForTimeout(TIMEOUTS.animation);
  }

  const dayButton = calendarSection.getByRole('button', { name: String(target.getDate()) }).first();
  await expect(dayButton).toBeEnabled();
  await dayButton.click();
  await page.waitForTimeout(TIMEOUTS.animation);

  return target;
}

function getDateIndexFromToday(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(target);
  targetDate.setHours(0, 0, 0, 0);

  const diffMs = targetDate.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

async function publishJob(page: Page, jobTitle: string): Promise<void> {
  const publishButton = page.getByRole('button', { name: '公開する' }).first();
  await publishButton.click();

  await expect(page.getByText('求人公開の確認')).toBeVisible();
  const confirmButton = page.getByRole('button', { name: '公開する' }).last();
  await confirmButton.click();

  await page.waitForURL('/admin/jobs**');
  const toast = await waitForToast(page, '求人を作成しました', TIMEOUTS.toast);
  if (toast) {
    return;
  }

  const searchInput = page.getByPlaceholder(/求人タイトル|ワーカー名/);
  if (await searchInput.isVisible()) {
    await searchInput.fill(jobTitle);
    await page.waitForTimeout(TIMEOUTS.animation * 2);
  }

  const jobCard = page
    .locator('.rounded-admin-card, a[href^="/admin/jobs/"]')
    .filter({ hasText: jobTitle })
    .first();
  await expect(jobCard.or(page.getByText(jobTitle).first())).toBeVisible();
}

async function mockDirectUpload(page: Page, baseURL: string): Promise<void> {
  const mockUploadUrl = `${baseURL}/__mock-upload`;
  const fallbackPublicUrl = '/images/samples/facility_top_1.png';

  await page.route('**/api/upload/presigned', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const timestamp = Date.now();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        presignedUrl: `${mockUploadUrl}?t=${timestamp}`,
        publicUrl: fallbackPublicUrl,
      }),
    });
  });

  await page.route('**/__mock-upload**', async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });
}

async function waitForJobsResponse(page: Page, dateIndex: number): Promise<void> {
  await page.waitForResponse(
    (response) => response.url().includes('/api/jobs') &&
      response.url().includes(`dateIndex=${dateIndex}`) &&
      response.status() === 200,
    { timeout: TIMEOUTS.navigation }
  );
}

async function selectJobListDate(page: Page, target: Date): Promise<void> {
  const month = target.getMonth() + 1;
  const day = target.getDate();
  const dateRegex = new RegExp(`^${month}/${day}(\\D|$)`);
  const dateButton = page.getByRole('button', { name: dateRegex }).first();
  await expect(dateButton).toBeVisible();
  await dateButton.click();
  await page.waitForTimeout(TIMEOUTS.animation * 2);
}

test('審査あり求人の応募→承認がワーカーへ反映される', async ({ browser }) => {
  test.setTimeout(120000);
  const baseURL = test.info().project.use?.baseURL ?? 'http://127.0.0.1:3000';
  const jobTitle = `E2E審査フロー-${Date.now()}`;
  const imagePath = path.join(process.cwd(), 'public/images/samples/facility_top_1.png');

  await ensureWorkerProfileComplete(TEST_ACCOUNTS.worker.email);

  const contextOptions = {
    baseURL,
    permissions: ['geolocation'],
    geolocation: { latitude: 35.681236, longitude: 139.767125 },
  };
  const facilityContext = await browser.newContext(contextOptions);
  const workerContext = await browser.newContext(contextOptions);
  await facilityContext.grantPermissions(['geolocation'], { origin: baseURL });
  await workerContext.grantPermissions(['geolocation'], { origin: baseURL });

  try {
    const facilityPage = await facilityContext.newPage();
    await mockDirectUpload(facilityPage, baseURL);
    await loginAsFacilityAdmin(facilityPage);
    await openJobCreate(facilityPage);

    const requiresInterview = facilityPage.getByRole('checkbox', { name: /審査してからマッチング/ });
    if (!(await requiresInterview.isChecked())) {
      await requiresInterview.check();
    }

    const titleInput = facilityPage.locator('input[placeholder*="デイサービス"]');
    await titleInput.fill(jobTitle);

    const topImageInput = facilityPage.locator('input[type="file"][accept="image/*"]').first();
    await topImageInput.setInputFiles(imagePath);

    const timeSection = facilityPage.getByRole('heading', { name: '勤務時間' }).locator('..');
    const startTimeRow = timeSection.getByText('開始時刻').locator('..');
    await startTimeRow.locator('select').first().selectOption('18');
    await startTimeRow.locator('select').nth(1).selectOption('00');

    const endTimeRow = timeSection.getByText('終了時刻').locator('..');
    await endTimeRow.locator('select').first().selectOption('20');
    await endTimeRow.locator('select').nth(1).selectOption('00');

    const workDate = await findAvailableWorkDate(TEST_ACCOUNTS.worker.email);
    const workDateOffset = getDateIndexFromToday(workDate);
    await selectFutureWorkDate(facilityPage, workDateOffset);

    const workContentCheckbox = facilityPage.getByRole('checkbox', { name: '対話・見守り' }).first();
    await workContentCheckbox.check();

    const qualificationCheckbox = facilityPage.getByRole('checkbox', { name: '介護福祉士' }).first();
    await qualificationCheckbox.check();

    const wageInput = facilityPage.getByText('時給（円）').locator('..').locator('input[type="number"]');
    await wageInput.fill('1800');

    await publishJob(facilityPage, jobTitle);

    let workerPage = await workerContext.newPage();
    await loginAsWorker(workerPage);
    await openWorkerBottomNav(workerPage, '探す', /\/$/);
    await selectJobListDate(workerPage, workDate);
    const dateIndex = getDateIndexFromToday(workDate);
    await waitForJobsResponse(workerPage, dateIndex);

    const searchInput = workerPage.locator('input[placeholder*="検索"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(jobTitle);
      await workerPage.waitForTimeout(TIMEOUTS.animation * 2);
    }

    const jobTitleText = workerPage.getByText(jobTitle).first();
    await expect(jobTitleText).toBeVisible({ timeout: TIMEOUTS.navigation });
    await jobTitleText.click();
    await workerPage.waitForURL('/jobs/**');

    const workDateSection = workerPage.getByRole('heading', { name: '選択された勤務日' }).locator('..');
    const workDateCheckbox = workDateSection.locator('input[type="checkbox"]').first();
    if (await workDateCheckbox.isEnabled()) {
      await workDateCheckbox.check();
    }

    const applyButton = workerPage.getByRole('button', { name: /応募/ }).filter({ hasText: /応募/ }).first();
    if (!(await applyButton.isEnabled())) {
      throw new Error('応募ボタンが無効です。勤務日が選択できない状態の可能性があります。');
    }
    await applyButton.click();

    const confirmModal = workerPage
      .getByRole('heading', { name: '応募内容の確認' })
      .locator('..')
      .locator('..');
    await expect(confirmModal).toBeVisible();
    const confirmButton = confirmModal.getByRole('button', { name: '応募する（審査あり）' }).first();
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click({ force: true, noWaitAfter: true });
    await workerPage.waitForTimeout(TIMEOUTS.animation * 4);
    if (await confirmModal.isVisible()) {
      throw new Error('応募確認モーダルが閉じませんでした。');
    }
    if (!workerPage.isClosed()) {
      await waitForToast(workerPage, '応募を受け付けました', TIMEOUTS.toast);
    }

    await openAdminNav(facilityPage, '応募管理', /\/admin\/applications/);
    await facilityPage.waitForResponse(
      (response) => response.url().includes('/api/admin/applications') && response.status() === 200,
      { timeout: TIMEOUTS.navigation }
    );
    const applicationSearch = facilityPage.getByPlaceholder('求人タイトルで検索...');
    await applicationSearch.fill(jobTitle);
    await facilityPage.waitForTimeout(TIMEOUTS.animation * 2);

    const applicationCard = facilityPage.locator('.rounded-admin-card').filter({ hasText: jobTitle }).first();
    await expect(applicationCard).toBeVisible();
    await applicationCard.click();

    const applicationModal = facilityPage
      .locator('div.fixed.inset-0')
      .filter({ has: facilityPage.getByRole('heading', { name: jobTitle }) })
      .first();
    await expect(applicationModal).toBeVisible();
    const dateSummary = applicationModal.getByText(/募集:\s*\d+名\s*\/\s*マッチング:\s*\d+\s*\/\s*応募:\s*\d+/).first();
    await expect(dateSummary).toBeVisible();
    await dateSummary.click();

    const matchButton = applicationModal.getByRole('button', { name: 'マッチング', exact: true }).first();
    await expect(matchButton).toBeVisible();
    facilityPage.once('dialog', (dialog) => dialog.accept());
    await matchButton.click();
    await facilityPage.waitForTimeout(TIMEOUTS.animation * 2);
    const matchedLabel = applicationModal.getByText('マッチング済').first();
    await expect(matchedLabel).toBeVisible({ timeout: TIMEOUTS.navigation });

    if (workerPage.isClosed()) {
      workerPage = await workerContext.newPage();
      await loginAsWorker(workerPage);
    }
    await openWorkerBottomNav(workerPage, '仕事管理', /\/my-jobs/);
    const scheduledTab = workerPage.getByRole('button', { name: /仕事の予定/ }).first();
    await scheduledTab.click();
    const loadingText = workerPage.getByText('読み込み中...');
    if (await loadingText.isVisible()) {
      await expect(loadingText).toBeHidden({ timeout: TIMEOUTS.navigation });
    }
    await workerPage.waitForTimeout(TIMEOUTS.animation);

    const scheduledJobCard = workerPage.getByText(jobTitle).first();
    await expect(scheduledJobCard).toBeVisible();
  } finally {
    await workerContext.close();
    await facilityContext.close();
  }
});
