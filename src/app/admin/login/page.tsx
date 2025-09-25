"use client";

import { signIn } from "next-auth/react";

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-sm p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Admin Login</h1>
      <button
        onClick={() => signIn("google", { callbackUrl: "/admin" })}
        className="w-full rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300"
      >
        Continue with Google
      </button>
      <p className="mt-3 text-sm text-slate-400">
        Only admins can access /admin. Others will be returned to this page.
      </p>
    </div>
  );
}
