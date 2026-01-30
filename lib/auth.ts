import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { logActivity } from './logger';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
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
        if (!credentials?.email || !credentials?.password) {
          throw new Error('メールアドレスとパスワードを入力してください');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });


        if (!user) {
          // ログイン失敗（ユーザー不在）をログ記録
          logActivity({
            userType: 'WORKER',
            userEmail: credentials.email,
            action: 'LOGIN_FAILED',
            result: 'ERROR',
            errorMessage: 'ユーザーが見つかりません',
          }).catch(() => {});
          throw new Error('メールアドレスまたはパスワードが正しくありません');
        }

        // メールアドレス未認証チェック
        if (!user.email_verified) {
          // ログイン失敗（メール未認証）をログ記録
          logActivity({
            userType: 'WORKER',
            userId: user.id,
            userEmail: user.email,
            action: 'LOGIN_FAILED',
            targetType: 'User',
            targetId: user.id,
            result: 'ERROR',
            errorMessage: 'メール未認証',
          }).catch(() => {});
          throw new Error('EMAIL_NOT_VERIFIED');
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
          requestData: { method: 'credentials' },
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
};
