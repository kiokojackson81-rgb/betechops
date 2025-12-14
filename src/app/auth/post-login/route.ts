import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import getLandingPage from '@/lib/getLandingPage';

export async function GET(req: Request) {
  const session = await auth();
  const url = new URL(req.url);
  if (!session) {
    const original = url.pathname + url.search + url.hash;
    const loginUrl = new URL('/attendant/login', url);
    loginUrl.searchParams.set('callbackUrl', original);
    return NextResponse.redirect(loginUrl);
  }

  const role = (session.user as any)?.role ?? '';
  const category = (session.user as any)?.attendantCategory ?? null;
  const rawCallback = url.searchParams.get('callbackUrl') ?? url.searchParams.get('callback');
  let target = getLandingPage(category, role);

  if (rawCallback) {
    let decoded = rawCallback;
    try {
      for (let i = 0; i < 3; i++) {
        if (decoded.includes('%')) {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          decoded = next;
        } else {
          break;
        }
      }
    } catch {
      decoded = rawCallback;
    }

    try {
      if (decoded.startsWith('/')) {
        target = decoded;
      } else {
        const cbUrl = new URL(decoded, url);
        if (cbUrl.origin === url.origin) {
          target = cbUrl.pathname + cbUrl.search + cbUrl.hash;
        }
      }
    } catch {
      // keep default target
    }
  }

  const res = NextResponse.redirect(new URL(target, url));
  res.cookies.set('postlogin_done', '1', {
    maxAge: 60,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
