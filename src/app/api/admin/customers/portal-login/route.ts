import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findOrCreateCustomerIdentityUser, findSafeUserById } from "@/lib/customerIdentity";
import { createDirectVerifiedAuthToken } from "@/lib/phoneOtpAuth";
import { getShopBaseUrl } from "@/lib/runtimeUrls";

function normalizeCallbackUrl(value?: string | null) {
  const callbackUrl = String(value || "").trim();
  if (!callbackUrl.startsWith("/")) return "/account";
  return callbackUrl;
}

export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const callbackUrl = normalizeCallbackUrl(url.searchParams.get("callbackUrl"));
  const userId = String(url.searchParams.get("userId") || "").trim();
  const customerName = String(url.searchParams.get("name") || "").trim();
  const customerPhone = String(url.searchParams.get("phone") || "").trim();
  const customerEmail = String(url.searchParams.get("email") || "").trim();

  let user = userId ? await findSafeUserById(userId) : null;

  if (!user) {
    if (!customerName && !customerPhone && !customerEmail) {
      return NextResponse.json({ error: "Missing customer identity." }, { status: 400 });
    }
    const resolution = await findOrCreateCustomerIdentityUser({
      customerName: customerName || "Betech customer",
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
    });
    user = resolution.user;
  }

  const identifier = String(user.phone || user.email || customerPhone || customerEmail || user.id).trim();
  const channel = user.phone || customerPhone ? "phone" : "email";
  const requiresProfileCompletion = !String(user.name || "").trim() || !String(user.email || "").trim();
  const token = createDirectVerifiedAuthToken({
    userId: user.id,
    channel,
    identifier,
    redirectTo: callbackUrl,
    requiresProfileCompletion,
  });

  const redirectUrl = new URL("/login/admin-customer", getShopBaseUrl());
  redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(redirectUrl);
}
