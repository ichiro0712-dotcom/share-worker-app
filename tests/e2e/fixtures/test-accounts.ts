import fs from 'fs';
import path from 'path';

export type TestAccount = {
  email: string;
  password: string;
};

export type TestAccounts = {
  worker: TestAccount;
  facilityAdmin: TestAccount;
  systemAdmin: TestAccount;
};

export const DEFAULT_TEST_ACCOUNTS: TestAccounts = {
  worker: {
    email: 'tanaka@example.com',
    password: 'password123',
  },
  facilityAdmin: {
    email: 'admin1@facility.com',
    password: 'password123',
  },
  systemAdmin: {
    email: 'system-admin@example.com',
    password: 'password123',
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
