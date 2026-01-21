/**
 * 銀行・支店マスタデータ投入スクリプト
 *
 * zengin-code/source-dataからデータを取得してDBに投入する
 *
 * 使用方法:
 *   npx tsx scripts/seed-bank-data.ts
 *
 * オプション:
 *   --banks-only    銀行データのみ投入
 *   --branches-only 支店データのみ投入（銀行データが必要）
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local から環境変数を読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/zengin-code/source-data/master/data';

interface BankData {
  code: string;
  name: string;
  kana: string;
  hira: string;
  roma?: string;
}

interface BranchData {
  code: string;
  name: string;
  kana: string;
  hira: string;
  roma?: string;
}

async function fetchBanks(): Promise<Record<string, BankData>> {
  console.log('Fetching banks.json from GitHub...');
  const response = await fetch(`${GITHUB_RAW_BASE}/banks.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch banks.json: ${response.status}`);
  }
  return response.json();
}

async function fetchBranches(bankCode: string): Promise<Record<string, BranchData> | null> {
  const response = await fetch(`${GITHUB_RAW_BASE}/branches/${bankCode}.json`);
  if (!response.ok) {
    if (response.status === 404) {
      return null; // 支店データがない銀行もある
    }
    throw new Error(`Failed to fetch branches/${bankCode}.json: ${response.status}`);
  }
  return response.json();
}

async function seedBanks(): Promise<string[]> {
  const banksData = await fetchBanks();
  const bankCodes = Object.keys(banksData);

  console.log(`Found ${bankCodes.length} banks. Inserting...`);

  let inserted = 0;
  let updated = 0;

  for (const [code, bank] of Object.entries(banksData)) {
    try {
      const result = await prisma.bank.upsert({
        where: { code },
        update: {
          name: bank.name,
          kana: bank.kana,
          hira: bank.hira,
          roma: bank.roma || null,
        },
        create: {
          code,
          name: bank.name,
          kana: bank.kana,
          hira: bank.hira,
          roma: bank.roma || null,
        },
      });

      if (result) {
        inserted++;
      }
    } catch (error) {
      console.error(`Error upserting bank ${code}:`, error);
    }
  }

  console.log(`Banks: ${inserted} records upserted.`);
  return bankCodes;
}

async function seedBranches(bankCodes: string[]): Promise<void> {
  console.log(`Fetching branches for ${bankCodes.length} banks...`);

  let totalBranches = 0;
  let processedBanks = 0;

  for (const bankCode of bankCodes) {
    processedBanks++;

    if (processedBanks % 100 === 0) {
      console.log(`Progress: ${processedBanks}/${bankCodes.length} banks processed, ${totalBranches} branches inserted.`);
    }

    const branchesData = await fetchBranches(bankCode);
    if (!branchesData) {
      continue;
    }

    const branches = Object.entries(branchesData);

    for (const [branchCode, branch] of branches) {
      try {
        await prisma.branch.upsert({
          where: {
            bankCode_code: {
              bankCode,
              code: branchCode,
            },
          },
          update: {
            name: branch.name,
            kana: branch.kana,
            hira: branch.hira,
            roma: branch.roma || null,
          },
          create: {
            bankCode,
            code: branchCode,
            name: branch.name,
            kana: branch.kana,
            hira: branch.hira,
            roma: branch.roma || null,
          },
        });
        totalBranches++;
      } catch (error) {
        console.error(`Error upserting branch ${bankCode}-${branchCode}:`, error);
      }
    }

    // Rate limiting: 100ms delay between banks to avoid overwhelming GitHub
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Branches: ${totalBranches} records upserted.`);
}

async function main() {
  const args = process.argv.slice(2);
  const banksOnly = args.includes('--banks-only');
  const branchesOnly = args.includes('--branches-only');

  console.log('='.repeat(50));
  console.log('Bank & Branch Data Seeding');
  console.log('='.repeat(50));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log('');

  try {
    let bankCodes: string[] = [];

    if (!branchesOnly) {
      bankCodes = await seedBanks();
    } else {
      // 既存の銀行コードを取得
      const existingBanks = await prisma.bank.findMany({ select: { code: true } });
      bankCodes = existingBanks.map(b => b.code);
      console.log(`Found ${bankCodes.length} existing banks in DB.`);
    }

    if (!banksOnly && bankCodes.length > 0) {
      await seedBranches(bankCodes);
    }

    console.log('');
    console.log('='.repeat(50));
    console.log('Seeding completed successfully!');
    console.log(`End time: ${new Date().toISOString()}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
