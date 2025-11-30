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

    const target = getLandingPage(user?.attendantCategory, role);
    router.replace(target);
  }, [session, status, router]);

  return (
    <div className="p-8">
      <p className="text-center">Signing you in - redirecting...</p>
    </div>
  );
}
