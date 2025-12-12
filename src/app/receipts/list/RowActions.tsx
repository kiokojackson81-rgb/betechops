"use client";

import React from "react";

export default function RowActions({
  onEdit,
  onEditItems,
  onDelete,
  onDownload,
  onSendWhatsapp,
  onPrint,
  disabled,
}: {
  onEdit: () => void;
  onEditItems: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onSendWhatsapp: () => void;
  onPrint: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button className="rounded px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700" onClick={onEdit} disabled={disabled}>
        Edit
      </button>
      <button className="rounded px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700" onClick={onEditItems} disabled={disabled}>
        Edit items
      </button>
      <button className="rounded px-2 py-1 text-xs bg-rose-700 hover:bg-rose-600" onClick={onDelete} disabled={disabled}>
        Delete
      </button>
      <button className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600" onClick={onDownload} disabled={disabled}>
        Download
      </button>
      <button className="rounded px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500" onClick={onSendWhatsapp} disabled={disabled}>
        WhatsApp
      </button>
      <button className="rounded px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700" onClick={onPrint} disabled={disabled}>
        Print
      </button>
    </div>
  );
}
