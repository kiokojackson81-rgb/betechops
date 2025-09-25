"use client";
import { signIn } from "next-auth/react";

export default function AttendantLoginPage() {
  return (
    <div className="mx-auto max-w-sm p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Attendant Login</h1>
      <button
        onClick={() => signIn("google", { callbackUrl: "/attendant" })}
        className="w-full rounded-2xl border border-white/10 px-4 py-2 font-semibold hover:bg-white/10"
      >
        Continue with Google
      </button>
      <p className="mt-3 text-sm text-slate-400">
        Attendants go to /attendant after sign-in.
      </p>
    </div>
  );
}
