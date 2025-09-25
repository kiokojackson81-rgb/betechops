"use client";
import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type LocalUser = { role?: string };

export default function ClientRedirect() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/attendant/login");
      return;
    }
    const role = (session.user as LocalUser)?.role || "ATTENDANT";
    // Read intended param from URL. If present, prefer it (but validate against role)
    const params = new URLSearchParams(window.location.search);
    const intended = params.get("intended");
    if (intended === "admin" && role === "ADMIN") {
      router.replace("/admin");
      return;
    }
    if (intended === "attendant") {
      // If intended is attendant, allow redirect to attendant regardless of role
      router.replace("/attendant");
      return;
    }

    // Default: role-based routing
    if (role === "ADMIN") router.replace("/admin");
    else router.replace("/attendant");
  }, [session, status, router]);

  return (
    <div className="p-8">
      <p className="text-center">Signing you in — redirecting...</p>
    </div>
  );
}
