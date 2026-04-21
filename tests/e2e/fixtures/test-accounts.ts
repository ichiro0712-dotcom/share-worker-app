import fs from 'fs';
import path from 'path';

export type TestAccount = {
  email: string;
  password: string;
};

export type TestAccounts = {
  worker: TestAccount;
  /**
   * CSV 保持テスト用: desired_work_style に CSV 値（複数選択）を持つワーカー。
   * global-setup で `desired_work_style='単発・スポット,派遣'` を seed する。
   * プロフィール編集で別項目だけ更新したとき CSV が潰れないことを検証する E2E で使用。
   */
  workerWithCsv: TestAccount;
  facilityAdmin: TestAccount;
  systemAdmin: TestAccount;
};

export const DEFAULT_TEST_ACCOUNTS: TestAccounts = {
  worker: {
    email: process.env.TEST_WORKER_EMAIL || 'tanaka@example.com',
    password: process.env.TEST_WORKER_PASSWORD || 'password123',
  },
  workerWithCsv: {
    email: process.env.TEST_WORKER_WITH_CSV_EMAIL || 'tanaka.csv@example.com',
    password: process.env.TEST_WORKER_WITH_CSV_PASSWORD || 'password123',
  },
  facilityAdmin: {
    email: process.env.TEST_FACILITY_ADMIN_EMAIL || 'admin1@facility.com',
    password: process.env.TEST_FACILITY_ADMIN_PASSWORD || 'password123',
  },
  systemAdmin: {
    // シードスクリプト: admin@tastas.jp / password123
    email: process.env.SYSTEM_ADMIN_EMAIL || 'admin@tastas.jp',
    password: process.env.SYSTEM_ADMIN_PASSWORD || 'password123',
  },
};

export const ACCOUNTS_PATH = path.resolve(
  process.cwd(),
  'tests/e2e/.auth/test-accounts.json'
);

export function loadTestAccounts(): TestAccounts {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    return DEFAULT_TEST_ACCOUNTS;
  }

  try {
    const raw = fs.readFileSync(ACCOUNTS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TestAccounts>;

    return {
      worker:
        parsed.worker?.email && parsed.worker?.password
          ? parsed.worker
          : DEFAULT_TEST_ACCOUNTS.worker,
      workerWithCsv:
        parsed.workerWithCsv?.email && parsed.workerWithCsv?.password
          ? parsed.workerWithCsv
          : DEFAULT_TEST_ACCOUNTS.workerWithCsv,
      facilityAdmin:
        parsed.facilityAdmin?.email && parsed.facilityAdmin?.password
          ? parsed.facilityAdmin
          : DEFAULT_TEST_ACCOUNTS.facilityAdmin,
      systemAdmin:
        parsed.systemAdmin?.email && parsed.systemAdmin?.password
          ? parsed.systemAdmin
          : DEFAULT_TEST_ACCOUNTS.systemAdmin,
    };
  } catch {
    return DEFAULT_TEST_ACCOUNTS;
  }
}

export function saveTestAccounts(next: Partial<TestAccounts>): TestAccounts {
  const current = loadTestAccounts();
  const merged: TestAccounts = {
    worker:
      next.worker?.email && next.worker?.password ? next.worker : current.worker,
    workerWithCsv:
      next.workerWithCsv?.email && next.workerWithCsv?.password
        ? next.workerWithCsv
        : current.workerWithCsv,
    facilityAdmin:
      next.facilityAdmin?.email && next.facilityAdmin?.password
        ? next.facilityAdmin
        : current.facilityAdmin,
    systemAdmin:
      next.systemAdmin?.email && next.systemAdmin?.password
        ? next.systemAdmin
        : current.systemAdmin,
  };

  fs.mkdirSync(path.dirname(ACCOUNTS_PATH), { recursive: true });
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(merged, null, 2));

  return merged;
}
