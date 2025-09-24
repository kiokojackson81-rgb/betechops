"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold">Something went wrong loading metrics.</h2>
      <p className="mt-2 text-slate-300">{error.message}</p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-xl px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/20"
      >
        Try again
      </button>
    </div>
  );
}