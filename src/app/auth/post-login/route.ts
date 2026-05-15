import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import getLandingPage from '@/lib/getLandingPage';
import { isAgentsHost } from '@/lib/runtimeUrls';

export async function GET(req: Request) {
  const session = await auth();
  const url = new URL(req.url);
  const host = url.host;
  const rawCallback = url.searchParams.get('callbackUrl') ?? url.searchParams.get('callback');
  const shouldUseAgentLogin =
    isAgentsHost(host) ||
    rawCallback === "/agents/dashboard" ||
    rawCallback?.startsWith("/agents/") ||
    rawCallback?.includes("/agents/");

  if (!session) {
    const original = url.pathname + url.search + url.hash;
    const loginUrl = new URL(shouldUseAgentLogin ? '/agents/login' : '/attendant/login', url);
    loginUrl.searchParams.set('callbackUrl', original);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user as { role?: string; attendantCategory?: string | null; isAgent?: boolean } | undefined;
  const role = user?.role ?? '';
  const category = user?.attendantCategory ?? null;
  const isAgent = Boolean(user?.isAgent);
  let target = isAgent ? "/agents/dashboard" : getLandingPage(category, role);

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
