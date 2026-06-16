import { NextRequest, NextResponse } from "next/server";
import { resolveFirebasePhoneUser } from "@/lib/firebasePhoneAuth";
import { isAgentsHost } from "@/lib/agents/host";
import { isOpsHost } from "@/lib/runtimeUrls";

export const dynamic = "force-dynamic";

const WINDOW_MS = Number(process.env.FIREBASE_PHONE_VERIFY_WINDOW_MS || "600000");
const MAX_PER_WINDOW = Number(process.env.FIREBASE_PHONE_VERIFY_MAX_PER_WINDOW || "8");
const requests = new Map<string, number[]>();

function allowRequest(key: string) {
  const now = Date.now();
  const recent = (requests.get(key) || []).filter((stamp) => stamp > now - WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    requests.set(key, recent);
    return false;
  }
  recent.push(now);
  requests.set(key, recent);
  return true;
}

function getClientKey(req: NextRequest) {
  const ip =
    String(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "global")
      .split(",")[0]
      .trim() || "global";
  return `firebase-phone:${ip}`;
}

function getPreferredRedirect(req: NextRequest, rawCallbackUrl: string) {
  const callbackUrl = String(rawCallbackUrl || "").trim();
  if (callbackUrl.startsWith("/")) return callbackUrl;

  const host = req.headers.get("host");
  if (isAgentsHost(host)) return "/dashboard";
  if (isOpsHost(host)) return "/auth/post-login";
  return "/account";
}

export async function POST(req: NextRequest) {
  if (!allowRequest(getClientKey(req))) {
    return NextResponse.json({ ok: false, error: "Too many verification attempts. Please wait and try again." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const idToken = String(body?.idToken || "").trim();
  const preferredRedirect = getPreferredRedirect(req, String(body?.callbackUrl || ""));

  if (!idToken) {
    return NextResponse.json({ ok: false, error: "Missing Firebase ID token." }, { status: 400 });
  }

  try {
    const resolved = await resolveFirebasePhoneUser(idToken, preferredRedirect);
    return NextResponse.json({
      ok: true,
      user: {
        id: resolved.user.id,
        phone: resolved.user.phone,
        email: resolved.user.email,
        name: resolved.user.name,
        role: resolved.user.role,
        isAgent: Boolean(resolved.user.agentProfile),
      },
      redirectTo: resolved.redirectTo,
      requiresProfileCompletion: resolved.requiresProfileCompletion,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Firebase phone verification failed.",
      },
      { status: 401 },
    );
  }
}
