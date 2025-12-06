"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { AttendantCategory } from "@prisma/client";
import getLandingPage from "@/lib/getLandingPage";

type LocalUser = {
  role?: string;
  attendantCategory?: AttendantCategory;
  email?: string | null;
};

export default function ClientRedirect() {
  const router = useRouter();
  const _sess = useSession() as { data?: any; status?: string } | undefined;
  const session = _sess?.data;
  const status = _sess?.status;

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/attendant/login");
      return;
    }
    const user = session.user as LocalUser;
    let role = user?.role || "ATTENDANT";
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

    // Always refresh attendantCategory from the server (no-cache) to avoid stale tokens.
    (async () => {
      try {
        let category: AttendantCategory | null | undefined = user?.attendantCategory ?? null;
        const res = await fetch("/api/attendants/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          category = json?.attendantCategory ?? category;
          role = json?.role ?? role;
        }
        let target = getLandingPage(category, role);
        // Safety net: if we still don't have a category and this is the Direct Sales Ops user,
        // force them to the tracker instead of the generic attendant page.
        if (
          target === "/attendant" &&
          user?.email &&
          user.email.toLowerCase() === "jeniffer@betech.co.ke"
        ) {
          target = "/marketing/tracker";
        }
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
