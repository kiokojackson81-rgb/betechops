import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import ClientRedirect from "./ClientRedirect";

export default async function PostLogin() {
  const session = await auth();
  const role = session?.user?.role as string | undefined;
  if (session && role) {
    if (role === "ADMIN") return redirect("/admin");
    return redirect("/attendant");
  }

  // If we don't have a server-side session yet (cookie not set yet), render a
  // client component that waits for the client session to appear and redirects.
  return <ClientRedirect />;
}
