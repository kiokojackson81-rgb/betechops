import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { agentPath, isAgentRoutePath, isAgentsHost } from '@/lib/agents/host';
import getLandingPage from '@/lib/getLandingPage';
import { isOpsHost } from '@/lib/runtimeUrls';

export async function GET(req: Request) {
  const session = await auth();
  const url = new URL(req.url);
  const host = url.host;
  const rawCallback = url.searchParams.get('callbackUrl') ?? url.searchParams.get('callback');
  const shouldUseAgentLogin =
    isAgentsHost(host) ||
    isAgentRoutePath(rawCallback);
  const useRootAgentPaths = isAgentsHost(host);
  console.log("[post-login] session check", {
    host,
    hasSession: Boolean(session),
    userId: (session?.user as { id?: string } | undefined)?.id ?? null,
    isAgent: Boolean((session?.user as { isAgent?: boolean } | undefined)?.isAgent),
    rawCallback,
  });
  const normalizeAgentTarget = (value: string) => {
    if (!useRootAgentPaths) return value;
    if (value === "/agents") return "/";
    if (value.startsWith("/agents/")) return value.slice("/agents".length) || "/";
    return value;
  };

  if (!session) {
    const original = url.pathname + url.search + url.hash;
    const loginUrl = new URL(
      shouldUseAgentLogin ? agentPath("/login", useRootAgentPaths) : "/attendant/login",
      url,
    );
    loginUrl.searchParams.set('callbackUrl', original);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user as { role?: string; attendantCategory?: string | null; isAgent?: boolean } | undefined;
  const role = user?.role ?? '';
  const category = user?.attendantCategory ?? null;
  const isAgent = Boolean(user?.isAgent);
  let target = isAgentsHost(host)
    ? (isAgent ? agentPath("/dashboard", useRootAgentPaths) : "/")
    : isOpsHost(host)
      ? getLandingPage(category, role)
      : "/account";

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
        target = normalizeAgentTarget(decoded);
      } else {
        const cbUrl = new URL(decoded, url);
        if (cbUrl.origin === url.origin) {
          target = normalizeAgentTarget(cbUrl.pathname + cbUrl.search + cbUrl.hash);
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
