"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getLandingPage } from "../lib/auth/helpers";

export default function ClientRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      // Not signed in — send to signin page
      router.replace("/api/auth/signin");
      return;
    }

    // session.user may contain attendantCategory from NextAuth callbacks
    // Fallback to root if missing
    // @ts-expect-error - session.user may include attendantCategory even if typing says otherwise
    const category = session.user?.attendantCategory ?? null;
    const dest = getLandingPage(category);
    router.replace(dest);
  }, [session, status, router]);

  return null;
}
