"use client";

import { signIn } from "next-auth/react";

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-sm p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <button
        onClick={() => signIn("google", { callbackUrl: "/auth/post-login" })}
        className="w-full rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300"
      >
        Continue with Google
      </button>
      <p className="mt-3 text-sm text-slate-400">
        Use your work email. Admins are routed to Admin; others to Attendant.
      </p>
    </div>
  );
}
