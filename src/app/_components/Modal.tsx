"use client";

import React from 'react';

interface ModalProps {
  title?: string;
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-w-2xl w-full bg-white/5 border border-white/10 rounded-lg p-6 text-slate-100 z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button aria-label="Close modal" onClick={onClose} className="text-slate-300 hover:text-white">✕</button>
        </div>
        <div className="max-h-[60vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}
