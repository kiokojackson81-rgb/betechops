import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { agentPath, isAgentRoutePath, isAgentsHost } from '@/lib/agents/host';
import getLandingPage from '@/lib/getLandingPage';
import { isOpsHost } from '@/lib/runtimeUrls';
import { prisma } from '@/lib/prisma';
import { getKenyanPhoneVariants, normalizeKenyanPhone } from '@/lib/phone';

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
  const getSafeAgentTarget = (value: string) => {
    const normalized = normalizeAgentTarget(value);
    if (normalized === "/account" || normalized.startsWith("/account/")) {
      return agentPath("/dashboard", useRootAgentPaths);
    }
    return normalized;
  };

  if (!session) {
    const intendedTarget = rawCallback && rawCallback.startsWith("/")
      ? shouldUseAgentLogin
        ? getSafeAgentTarget(rawCallback)
        : normalizeAgentTarget(rawCallback)
      : shouldUseAgentLogin
        ? agentPath("/dashboard", useRootAgentPaths)
        : "/account";
    const loginUrl = new URL(
      shouldUseAgentLogin ? agentPath("/login", useRootAgentPaths) : "/attendant/login",
      url,
    );
    loginUrl.searchParams.set('callbackUrl', intendedTarget);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user as {
    id?: string;
    email?: string | null;
    phone?: string | null;
    role?: string;
    attendantCategory?: string | null;
    isAgent?: boolean;
  } | undefined;
  const role = user?.role ?? '';
  const category = user?.attendantCategory ?? null;
  let isAgent = Boolean(user?.isAgent);

  if (!isAgent) {
    const normalizedPhone = normalizeKenyanPhone(typeof user?.phone === "string" ? user.phone : "");
    const phoneVariants = normalizedPhone ? getKenyanPhoneVariants(normalizedPhone) : [];
    const normalizedEmail = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    const fallbackAgent = await prisma.agentProfile.findFirst({
      where: {
        OR: [
          ...(typeof user?.id === "string" ? [{ userId: user.id }] : []),
          ...(phoneVariants.length ? [{ phone: { in: phoneVariants } }] : []),
          ...(normalizedPhone ? [{ user: { phone: normalizedPhone } }] : []),
          ...(normalizedEmail
            ? [
                { email: { equals: normalizedEmail, mode: "insensitive" as const } },
                { user: { email: { equals: normalizedEmail, mode: "insensitive" as const } } },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        status: true,
      },
    });

    console.log("[post-login] fallback agent lookup", {
      userId: user?.id ?? null,
      normalizedPhone: normalizedPhone || null,
      normalizedEmail: normalizedEmail || null,
      foundAgentProfileId: fallbackAgent?.id ?? null,
      foundAgentStatus: fallbackAgent?.status ?? null,
    });

    if (fallbackAgent) {
      isAgent = true;
    }
  }
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
        target = isAgentsHost(host) ? getSafeAgentTarget(decoded) : normalizeAgentTarget(decoded);
      } else {
        const cbUrl = new URL(decoded, url);
        if (cbUrl.origin === url.origin) {
          const callbackTarget = cbUrl.pathname + cbUrl.search + cbUrl.hash;
          target = isAgentsHost(host) ? getSafeAgentTarget(callbackTarget) : normalizeAgentTarget(callbackTarget);
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
