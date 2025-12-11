import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await auth();
  const url = new URL(req.url);
  if (!session) return NextResponse.redirect(new URL('/auth/login', url));

  // NextAuth and other callers may use `callbackUrl` or `callback`.
  // Prefer `callbackUrl` (it's what NextAuth uses), then fall back to `callback`.
  let callbackRaw = url.searchParams.get('callbackUrl') ?? url.searchParams.get('callback') ?? '/';

  // Attempt to decode double-encoded values safely.
  try {
    for (let i = 0; i < 3; i++) {
      if (typeof callbackRaw === 'string' && callbackRaw.includes('%')) {
        const next = decodeURIComponent(callbackRaw);
        // stop if decoding made no change
        if (next === callbackRaw) break;
        callbackRaw = next;
      } else {
        break;
      }
    }
  } catch (e) {
    // ignore malformed encodings and use raw value
  }

  // Ensure we only redirect to same-origin paths for safety.
  let target = '/';
  try {
    if (typeof callbackRaw === 'string' && callbackRaw.startsWith('/')) {
      target = callbackRaw;
    } else if (typeof callbackRaw === 'string') {
      // If an absolute URL was provided and it's same-origin, allow it.
      const cbUrl = new URL(callbackRaw, url);
      if (cbUrl.origin === url.origin) target = cbUrl.pathname + cbUrl.search + cbUrl.hash;
    }
  } catch (e) {
    target = '/';
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
