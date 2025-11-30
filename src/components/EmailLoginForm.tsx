"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

type EmailLoginFormProps = {
  callbackUrl: string;
  buttonText?: string;
  placeholder?: string;
};

export default function EmailLoginForm({
  callbackUrl,
  buttonText = "Send sign-in link",
  placeholder = "name@betech.co.ke",
}: EmailLoginFormProps) {
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!email) return;
        signIn("email", { email, callbackUrl });
      }}
      className="space-y-4"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/40 focus:outline-none"
        placeholder={placeholder}
        required
      />
      <button
        type="submit"
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-black hover:brightness-95"
      >
        {buttonText}
      </button>
    </form>
  );
}
