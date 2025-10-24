"use client";
import React, { useEffect, useState } from "react";

export default function UserPicker({ onSelect, placeholder }: { onSelect: (u: { id: string; label: string } | null) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; email?: string }>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q) return setResults([]);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return setResults([]);
        const j = await res.json();
        setResults(j || []);
        setOpen(true);
      } catch (e) {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative inline-block">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); onSelect(null); }}
        onFocus={() => q && setOpen(true)}
        placeholder={placeholder || 'Search user by name or email'}
        className="border p-1"
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 bg-white border mt-1 max-h-48 overflow-auto w-full shadow">
          {results.map((r) => (
            <div key={r.id} className="p-2 hover:bg-slate-100 cursor-pointer" onClick={() => { onSelect({ id: r.id, label: `${r.name} <${r.email || ''}>` }); setOpen(false); setQ(''); }}>
              <div className="font-medium">{r.name}</div>
              <div className="text-sm text-slate-500">{r.email}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
