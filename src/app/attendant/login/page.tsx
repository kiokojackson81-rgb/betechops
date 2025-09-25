"use client";
import { signIn } from "next-auth/react";

export default function AttendantLoginPage() {
  return (
    <div className="mx-auto max-w-sm p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <button
        onClick={() => signIn("google", { callbackUrl: "/auth/post-login" })}
        className="w-full rounded-2xl border border-white/10 px-4 py-2 font-semibold hover:bg-white/10"
      >
        Continue with Google
      </button>
    </div>
  );
}
