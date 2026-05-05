import type { AdvisorTool } from '../types';
import { runReadOnly, describeAdvisorDataConnection } from '@/src/lib/advisor/db';

interface Input {
  verified_only?: boolean;
}

interface Output {
  workers: {
    total: number;
    sms_verified: number;
    email_verified_only: number;
    not_verified: number;
    withdrawn: number;
  };
  facility_admins: number;
  system_admins: number;
}

export const getUsersSummaryTool: AdvisorTool<Input, Output> = {
  name: 'get_users_summary',
  category: 'tastas-data',
  description:
    'ユーザー種別 (ワーカー / 施設管理者 / システム管理者) の件数を取得します。' +
    '\n\n本登録判定は SMS 認証 (phone_verified=true) を基準とします (CLAUDE.md ルール)。' +
    '\n\n使用例: 「登録ユーザー数」「本登録の人数」「アクティブなワーカー数」',
  inputSchema: {
    type: 'object',
    properties: {
      verified_only: {
        type: 'boolean',
        description: 'true なら SMS 認証済みのみカウント',
        default: false,
      },
    },
  },
  outputDescription:
    '{ workers: {total, sms_verified, email_verified_only, not_verified, withdrawn}, facility_admins, system_admins }',
  async available() {
    const conn = describeAdvisorDataConnection();
    if (conn.source === 'local_fallback') {
      return {
        ready: true,
        reason:
          'ADVISOR_DATA_DATABASE_URL 未設定: 開発用 DB にフォールバック中。本番ユーザー数は読めません。',
      };
    }
    return { ready: true };
  },
  async execute() {
    const start = Date.now();
    try {
      const [
        totalWorkers,
        smsVerified,
        emailVerifiedOnly,
        notVerified,
        withdrawn,
        facilityAdmins,
        systemAdmins,
      ] = await runReadOnly((tx) =>
        Promise.all([
          tx.user.count({ where: { deleted_at: null } }),
          tx.user.count({ where: { deleted_at: null, phone_verified: true } }),
          tx.user.count({
            where: { deleted_at: null, phone_verified: false, email_verified_at: { not: null } },
          }),
          tx.user.count({
            where: { deleted_at: null, phone_verified: false, email_verified_at: null },
          }),
          tx.user.count({ where: { deleted_at: { not: null } } }),
          tx.facilityAdmin.count(),
          tx.systemAdmin.count(),
        ])
      );

      return {
        ok: true,
        data: {
          workers: {
            total: totalWorkers,
            sms_verified: smsVerified,
            email_verified_only: emailVerifiedOnly,
            not_verified: notVerified,
            withdrawn,
          },
          facility_admins: facilityAdmins,
          system_admins: systemAdmins,
        },
        metadata: { tookMs: Date.now() - start },
      };
    } catch (e) {
      return {
        ok: false,
        error: `ユーザーサマリ取得失敗: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};
