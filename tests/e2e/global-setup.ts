import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import {
  ACCOUNTS_PATH,
  DEFAULT_TEST_ACCOUNTS,
  TestAccounts,
} from './fixtures/test-accounts';

type ExistingAccount = {
  email: string;
  password: string;
};

async function ensureWorker(
  prisma: PrismaClient,
  account: ExistingAccount
): Promise<ExistingAccount> {
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
    select: { id: true, password_hash: true },
  });

  const passwordHash = await bcrypt.hash(account.password, 10);

  if (!existing) {
    await prisma.user.create({
      data: {
        email: account.email,
        password_hash: passwordHash,
        name: 'E2E Worker',
        phone_number: '09012345678',
        qualifications: ['介護福祉士'],
      },
    });
    return account;
  }

  const isValid = await bcrypt.compare(account.password, existing.password_hash);
  if (!isValid) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { password_hash: passwordHash },
    });
  }

  return account;
}

/**
 * CSV 保持テスト用の worker を作成/更新。
 * `desired_work_style` に CSV 値（複数選択相当）を設定する。
 */
async function ensureWorkerWithCsv(
  prisma: PrismaClient,
  account: ExistingAccount
): Promise<ExistingAccount> {
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
    select: { id: true, password_hash: true },
  });

  const passwordHash = await bcrypt.hash(account.password, 10);
  const CSV_VALUE = '単発・スポット,派遣';

  if (!existing) {
    await prisma.user.create({
      data: {
        email: account.email,
        password_hash: passwordHash,
        name: 'E2E CSV Worker',
        phone_number: '09099999999',
        qualifications: ['介護福祉士'],
        desired_work_style: CSV_VALUE,
      },
    });
    return account;
  }

  const isValid = await bcrypt.compare(account.password, existing.password_hash);
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(isValid ? {} : { password_hash: passwordHash }),
      // 毎回 seed の CSV 値にリセット（テストの前提条件を確定させる）
      desired_work_style: CSV_VALUE,
    },
  });

  return account;
}

async function ensureFacilityAdmin(
  prisma: PrismaClient,
  account: ExistingAccount
): Promise<ExistingAccount> {
  const existing = await prisma.facilityAdmin.findUnique({
    where: { email: account.email },
    select: { id: true, password_hash: true, facility_id: true },
  });

  const passwordHash = await bcrypt.hash(account.password, 10);

  if (!existing) {
    const facility = await prisma.facility.create({
      data: {
        corporation_name: 'E2E Corporation',
        facility_name: 'E2E Facility',
        facility_type: '介護老人保健施設',
        prefecture: '東京都',
        city: '渋谷区',
      },
      select: { id: true },
    });

    await prisma.facilityAdmin.create({
      data: {
        email: account.email,
        password_hash: passwordHash,
        facility_id: facility.id,
        name: 'E2E Admin',
        role: 'admin',
        is_primary: true,
      },
    });
    return account;
  }

  const isValid = await bcrypt.compare(account.password, existing.password_hash);
  if (!isValid) {
    await prisma.facilityAdmin.update({
      where: { id: existing.id },
      data: { password_hash: passwordHash },
    });
  }

  return account;
}

async function ensureSystemAdmin(
  prisma: PrismaClient,
  account: ExistingAccount
): Promise<ExistingAccount> {
  const existing = await prisma.systemAdmin.findUnique({
    where: { email: account.email },
    select: { id: true, password_hash: true },
  });

  const passwordHash = await bcrypt.hash(account.password, 10);

  if (!existing) {
    await prisma.systemAdmin.create({
      data: {
        email: account.email,
        password_hash: passwordHash,
        name: 'E2E System Admin',
        role: 'super_admin',
      },
    });
    return account;
  }

  const isValid = await bcrypt.compare(account.password, existing.password_hash);
  if (!isValid) {
    await prisma.systemAdmin.update({
      where: { id: existing.id },
      data: { password_hash: passwordHash },
    });
  }

  return account;
}

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to create test accounts.');
  }

  const prisma = new PrismaClient();

  let accounts: Partial<TestAccounts> | null = null;
  if (fs.existsSync(ACCOUNTS_PATH)) {
    try {
      const raw = fs.readFileSync(ACCOUNTS_PATH, 'utf8');
      accounts = JSON.parse(raw) as Partial<TestAccounts>;
    } catch {
      accounts = null;
    }
  }

  const timestamp = Date.now();
  const fallbackAccounts: TestAccounts = {
    worker: {
      email: `e2e-worker-${timestamp}@example.com`,
      password: DEFAULT_TEST_ACCOUNTS.worker.password,
    },
    workerWithCsv: {
      email: `e2e-worker-csv-${timestamp}@example.com`,
      password: DEFAULT_TEST_ACCOUNTS.workerWithCsv.password,
    },
    facilityAdmin: {
      email: `e2e-admin-${timestamp}@example.com`,
      password: DEFAULT_TEST_ACCOUNTS.facilityAdmin.password,
    },
    systemAdmin: {
      email: `e2e-system-admin-${timestamp}@example.com`,
      password: DEFAULT_TEST_ACCOUNTS.systemAdmin.password,
    },
  };

  const hasWorkerAccount = !!(accounts?.worker?.email && accounts?.worker?.password);
  const hasWorkerWithCsvAccount = !!(accounts?.workerWithCsv?.email && accounts?.workerWithCsv?.password);
  const hasFacilityAccount = !!(accounts?.facilityAdmin?.email && accounts?.facilityAdmin?.password);
  const hasSystemAdminAccount = !!(accounts?.systemAdmin?.email && accounts?.systemAdmin?.password);

  const resolvedAccounts: TestAccounts = {
    worker: hasWorkerAccount ? accounts!.worker! : fallbackAccounts.worker,
    workerWithCsv: hasWorkerWithCsvAccount ? accounts!.workerWithCsv! : fallbackAccounts.workerWithCsv,
    facilityAdmin: hasFacilityAccount ? accounts!.facilityAdmin! : fallbackAccounts.facilityAdmin,
    systemAdmin: hasSystemAdminAccount ? accounts!.systemAdmin! : fallbackAccounts.systemAdmin,
  };

  try {
    const worker = await ensureWorker(prisma, resolvedAccounts.worker);
    const workerWithCsv = await ensureWorkerWithCsv(prisma, resolvedAccounts.workerWithCsv);
    const facilityAdmin = await ensureFacilityAdmin(prisma, resolvedAccounts.facilityAdmin);
    const systemAdmin = await ensureSystemAdmin(prisma, resolvedAccounts.systemAdmin);
    const finalAccounts: TestAccounts = { worker, workerWithCsv, facilityAdmin, systemAdmin };

    fs.mkdirSync(path.dirname(ACCOUNTS_PATH), { recursive: true });
    fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(finalAccounts, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
