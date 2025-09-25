import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import ClientRedirect from "./ClientRedirect";

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
    // Fall back to role-based routing
    if (role === "ADMIN") return redirect("/admin");
    return redirect("/attendant");
  }

  // If server session not available yet, render client redirect. The client
  // component will read `intended` from the URL search params (callbackUrl).
  return <ClientRedirect />;
}
