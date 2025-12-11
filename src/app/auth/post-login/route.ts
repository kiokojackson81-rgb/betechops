import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(req: Request) {
  const session = await auth();
  const url = new URL(req.url);
  if (!session) return NextResponse.redirect(new URL('/auth/login', url));

  const callback = url.searchParams.get('callback') || '/';
  const res = NextResponse.redirect(new URL(callback, url));
  res.cookies.set('postlogin_done', '1', {
    maxAge: 60,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
