import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import ClientRedirect from "./ClientRedirect";
import getLandingPage from "@/lib/getLandingPage";
import { prisma } from "@/lib/prisma";

export default async function PostLogin(props: unknown) {
  const { searchParams } = props as { searchParams?: Record<string, string | string[] | undefined> };

  const session = await auth();
  const role = session?.user?.role as string | undefined;
  const intended = Array.isArray(searchParams?.intended)
    ? searchParams?.intended[0]
    : (searchParams?.intended as string | undefined);

  // If we have a server-side session and role, validate and redirect.
  if (session && role) {
    // If a `callbackUrl` param is present (encoded previously by
    // middleware), prefer server-side redirect to that exact path.
    const cbRaw = Array.isArray(searchParams?.callbackUrl)
      ? (searchParams?.callbackUrl as string[])[0]
      : (searchParams?.callbackUrl as string | undefined);
    if (cbRaw) {
      try {
        const mask = (s: string | undefined | null, head = 24, tail = 24) => {
          if (!s) return "";
          try {
            const str = String(s);
            if (str.length <= head + tail) return str;
            return `${str.slice(0, head)}...${str.slice(-tail)}`;
          } catch (e) {
            return "";
          }
        };

        // Log masked callback for diagnostics (temporary).
        try {
          // eslint-disable-next-line no-console
          console.log(`post-login: received cbRaw=${mask(cbRaw)} sessionEmail=${mask((session as any)?.user?.email)}`);
        } catch (e) {
          // ignore logging errors
        }

        // Safely unwrap nested /auth/post-login wrappers that middleware may
        // have produced (e.g. "/auth/post-login?callbackUrl=%2Fmarketing%2Ftracker").
        // Limit to a small depth to avoid infinite loops on malformed values.
        let decoded = decodeURIComponent(cbRaw);
        let depthUnwrapped = 0;
        for (let depth = 0; depth < 3; depth++) {
          if (!decoded.startsWith("/auth/post-login")) break;
          try {
            const u = new URL(decoded, "http://example.com");
            const inner = u.searchParams.get("callbackUrl");
            if (!inner) break;
            decoded = decodeURIComponent(inner);
            depthUnwrapped = depth + 1;
          } catch (e) {
            break;
          }
        }

        // Log the final decoded target (masked) and unwrap depth.
        try {
          // eslint-disable-next-line no-console
          console.log(`post-login: unwrappedDepth=${depthUnwrapped} finalTarget=${mask(decoded)}`);
        } catch (e) {}

        // Only allow same-origin paths.
        if (decoded && decoded.startsWith("/")) {
          return redirect(decoded);
        }
      } catch (e) {
        // ignore malformed callbackUrl and continue with normal flow
      }
    }
    if (intended === "admin" && role === "ADMIN") return redirect("/admin");
    if (intended === "attendant" && role !== "ADMIN") return redirect("/attendant");

    // If not explicit, compute canonical landing using the attendant category
    if (role === "ADMIN") return redirect("/admin");

    // Prefer the DB value when possible so stale or missing session fields don't
    // cause a default redirect to `/attendant`. We still fall back to the
    // session value if DB lookup fails or no email is available.
    let category = (session.user as any)?.attendantCategory ?? null;
    if ((session.user as any)?.email && role !== "ADMIN") {
      try {
        const u = await prisma.user.findUnique({
          where: { email: (session.user as any).email },
          select: { attendantCategory: true },
        });
        // Use DB value when present, otherwise keep whatever the session had.
        category = (u as any)?.attendantCategory ?? category;
      } catch (e) {
        // ignore DB errors and continue with the session value
      }
    }

    const landing = getLandingPage(category as string | null, role as string);
    return redirect(landing);
  }

  // If server session not available yet, render client redirect. The client
  // component will read `intended` from the URL search params (callbackUrl).
  return <ClientRedirect />;
}
