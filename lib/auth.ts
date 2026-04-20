import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { logActivity } from './logger';
import { parseLoginIdentifier } from '@/src/lib/auth/identifier';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or Phone', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        autoLoginToken: { label: 'Auto Login Token', type: 'text' },
      },
      async authorize(credentials) {
        // 自動ログインモード（メール認証後）
        if (credentials?.autoLoginToken && credentials?.email) {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            throw new Error('ユーザーが見つかりません');
          }

          // 自動ログイントークンの検証
          if (
            user.auto_login_token !== credentials.autoLoginToken ||
            !user.auto_login_token_expires ||
            user.auto_login_token_expires < new Date()
          ) {
            throw new Error('自動ログイントークンが無効または期限切れです');
          }

          // トークンを無効化（一度だけ使用可能）
          await prisma.user.update({
            where: { id: user.id },
            data: {
              auto_login_token: null,
              auto_login_token_expires: null,
            },
          });

          console.log('[AUTH] Auto login successful for user:', user.id);
          // 自動ログイン成功をログ記録
          logActivity({
            userType: 'WORKER',
            userId: user.id,
            userEmail: user.email,
            action: 'LOGIN',
            targetType: 'User',
            targetId: user.id,
            requestData: { method: 'auto_login' },
            result: 'SUCCESS',
          }).catch(() => {});
          return {
            id: String(user.id),
            email: user.email,
            name: user.name,
            image: user.profile_image,
          };
        }

        // 通常ログインモード
        const rawIdentifier = credentials?.identifier ?? credentials?.email;
        if (!rawIdentifier || !credentials?.password) {
          throw new Error('ログイン情報とパスワードを入力してください');
        }

        const parsed = parseLoginIdentifier(rawIdentifier);
        if (parsed.type === 'invalid') {
          logActivity({
            userType: 'WORKER',
            userEmail: rawIdentifier,
            action: 'LOGIN_FAILED',
            result: 'ERROR',
            errorMessage: '識別子が不正な形式です',
          }).catch(() => {});
          throw new Error('メールアドレスまたはパスワードが正しくありません');
        }

        let user;
        if (parsed.type === 'email') {
          // 既存ユーザーの大小文字混在に対応。ただし case-variant 重複時は
          // 認証先が曖昧になるためログイン不可とする
          const emailMatches = await prisma.user.findMany({
            where: { email: { equals: parsed.value, mode: 'insensitive' } },
            orderBy: { id: 'desc' },
          });
          if (emailMatches.length > 1) {
            console.warn(
              '[AUTH] Multiple users for case-insensitive email match:',
              parsed.value
            );
            logActivity({
              userType: 'WORKER',
              userEmail: parsed.value,
              action: 'LOGIN_FAILED',
              result: 'ERROR',
              errorMessage: 'メールアドレスが重複しているためログイン不可',
            }).catch(() => {});
            throw new Error('メールアドレスまたはパスワードが正しくありません');
          }
          user = emailMatches[0];
        } else {
          // 電話番号ログイン: DB 側も正規化して比較（レガシーデータのハイフン・全角数字対応）
          const rows = await prisma.$queryRaw<{ id: number }[]>(
            Prisma.sql`SELECT id FROM users
              WHERE regexp_replace(translate(phone_number, '０１２３４５６７８９', '0123456789'), '[^0-9]', '', 'g') = ${parsed.value}
              AND phone_verified = true
              AND deleted_at IS NULL
              ORDER BY id DESC`
          );
          const candidates = rows.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: rows.map((r) => r.id) } },
                orderBy: { id: 'desc' },
              })
            : [];
          if (candidates.length > 1) {
            console.warn(
              '[AUTH] Multiple phone_verified users for phone:',
              parsed.value
            );
            logActivity({
              userType: 'WORKER',
              userEmail: parsed.value,
              action: 'LOGIN_FAILED',
              result: 'ERROR',
              errorMessage: '電話番号が重複しているためログイン不可',
            }).catch(() => {});
            throw new Error('メールアドレスまたはパスワードが正しくありません');
          }
          user = candidates[0];
        }

        if (!user) {
          logActivity({
            userType: 'WORKER',
            userEmail: rawIdentifier,
            action: 'LOGIN_FAILED',
            result: 'ERROR',
            errorMessage: 'ユーザーが見つかりません',
          }).catch(() => {});
          throw new Error('メールアドレスまたはパスワードが正しくありません');
        }

        // テストユーザーログイン用の特別パスワード（開発環境 + 環境変数フラグ必須）
        // 本番環境では完全に無効化
        let isValid = false;
        if (
          process.env.NODE_ENV !== 'production' &&
          process.env.ENABLE_TEST_LOGIN === 'true' &&
          credentials.password === 'SKIP_PASSWORD_CHECK_FOR_TEST_USER'
        ) {
          console.warn('[AUTH] Using magic password for test login - development only');
          isValid = true;
        } else {
          isValid = await bcrypt.compare(credentials.password, user.password_hash);
        }


        if (!isValid) {
          // ログイン失敗（パスワード不一致）をログ記録
          logActivity({
            userType: 'WORKER',
            userId: user.id,
            userEmail: user.email,
            action: 'LOGIN_FAILED',
            targetType: 'User',
            targetId: user.id,
            result: 'ERROR',
            errorMessage: 'パスワードが一致しません',
          }).catch(() => {});
          throw new Error('メールアドレスまたはパスワードが正しくありません');
        }

        // ログイン成功をログ記録
        logActivity({
          userType: 'WORKER',
          userId: user.id,
          userEmail: user.email,
          action: 'LOGIN',
          targetType: 'User',
          targetId: user.id,
          requestData: { method: parsed.type === 'phone' ? 'phone_credentials' : 'credentials' },
          result: 'SUCCESS',
        }).catch(() => {});

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          image: user.profile_image,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;

        // DBから最新のユーザー情報を取得（プロフィール画像の更新を反映）
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: parseInt(token.id as string) },
            select: {
              name: true,
              email: true,
              profile_image: true,
            },
          });
          if (dbUser) {
            session.user.name = dbUser.name;
            session.user.email = dbUser.email;
            session.user.image = dbUser.profile_image;
          }
        } catch (error) {
          console.error('Failed to fetch user from DB in session callback:', error);
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  logger: {
    error(code, metadata) {
      if (code === 'NO_SECRET') {
        console.error('[auth] NEXTAUTH_SECRET is not set. Worker login will not work.');
      } else {
        console.error('[auth]', code, metadata);
      }
    },
  },
};
