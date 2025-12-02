"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { AttendantCategory } from "@prisma/client";
import getLandingPage from "@/lib/getLandingPage";

type LocalUser = {
  role?: string;
  attendantCategory?: AttendantCategory;
};

export default function ClientRedirect() {
  const router = useRouter();
  const _sess = useSession() as { data?: any; status?: string } | undefined;
  const session = _sess?.data;
  const status = _sess?.status;

  useEffect(() => {
    if (status === "loading") return;
    // DEBUG: log session to inspect attendantCategory at redirect time
    // Remove this log after diagnosing redirect issues
    // eslint-disable-next-line no-console
    console.log("ClientRedirect session:", session?.user);
    if (!session) {
      router.replace("/attendant/login");
      return;
    }
    const user = session.user as LocalUser;
    const role = user?.role || "ATTENDANT";
    const params = new URLSearchParams(window.location.search);
    const intended = params.get("intended");
    if (intended === "admin" && role === "ADMIN") {
      router.replace("/admin");
      return;
    }
    if (intended === "attendant") {
      router.replace("/attendant");
      return;
    }

    // If the session doesn't include an attendantCategory (token may be
    // stale), try a server lookup to get the authoritative value before
    // choosing a landing page. This avoids redirecting Direct Sales Ops
    // attendants to the generic `/attendant` page when the DB says they
    // should go to `/marketing/tracker`.
    (async () => {
      try {
        let category = user?.attendantCategory ?? null;
        if (!category) {
          const res = await fetch("/api/attendants/me", { credentials: "same-origin" });
          if (res.ok) {
            const json = await res.json();
            category = json?.attendantCategory ?? category;
          }
        }
        const target = getLandingPage(category, role);
        router.replace(target);
      } catch (e) {
        const target = getLandingPage(user?.attendantCategory ?? null, role);
        router.replace(target);
      }
    })();
  }, [session, status, router]);

  return (
    <div className="p-8">
      <p className="text-center">Signing you in - redirecting...</p>
    </div>
  );
}
