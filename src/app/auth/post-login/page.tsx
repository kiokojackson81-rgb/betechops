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
    if (intended === "admin" && role === "ADMIN") return redirect("/admin");
    if (intended === "attendant" && role !== "ADMIN") return redirect("/attendant");

    // If not explicit, compute canonical landing using the attendant category
    if (role === "ADMIN") return redirect("/admin");

    let category = (session.user as any)?.attendantCategory ?? null;

    // If the server-side session didn't include a category, fall back to DB lookup
    // (handles cases where NextAuth token may be stale or missing the field).
    if (!category && (session.user as any)?.email) {
      try {
        const u = await prisma.user.findUnique({ where: { email: (session.user as any).email }, select: { attendantCategory: true } });
        category = (u as any)?.attendantCategory ?? category;
      } catch (e) {
        // ignore DB errors and continue with whatever category we have
      }
    }

    const landing = getLandingPage(category as string | null, role as string);
    return redirect(landing);
  }

  // If server session not available yet, render client redirect. The client
  // component will read `intended` from the URL search params (callbackUrl).
  return <ClientRedirect />;
}
