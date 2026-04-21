import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type SessionCookieUser = {
  id: number;
  email: string;
  name: string;
};

export async function issueSessionCookie(
  response: NextResponse,
  user: SessionCookieUser
): Promise<void> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }

  const jwtToken = await encode({
    token: {
      id: String(user.id),
      email: user.email,
      name: user.name,
      sub: String(user.id),
    },
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isProduction
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  response.cookies.set(cookieName, jwtToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
}
