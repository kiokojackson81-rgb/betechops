"use client";

import React from "react";
import { Edit3, Trash2, Download, Send, Printer, Check, DollarSign } from "lucide-react";

export default function RowActions({
  onEdit,
  onEditItems,
  onDelete,
  onDownload,
  onSendWhatsapp,
  onPrint,
  onPodAction,
  onMarkPaid,
  onResendPod,
  podActionLabel = "Mark delivered",
  podActionProcessing = false,
  disabled,
}: {
  onEdit: () => void;
  onEditItems: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onSendWhatsapp: () => void;
  onPrint: () => void;
  onPodAction?: () => void;
  onMarkPaid?: () => void;
  onResendPod?: () => void;
  podActionLabel?: string;
  podActionProcessing?: boolean;
  disabled?: boolean;
}) {
  // Responsive layout: show icon + label on md+, icons-only on small screens
  const btnBase =
    "inline-flex items-center gap-2 rounded px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-400";

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        aria-label="Edit receipt"
        title="Edit receipt"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        disabled={disabled}
        className={`${btnBase} bg-slate-800 hover:bg-slate-700 text-slate-100`}
      >
        <Edit3 size={16} />
        <span className="hidden md:inline">Edit</span>
      </button>

      <button
        aria-label="Edit items"
        title="Edit items"
        onClick={(e) => {
          e.stopPropagation();
          onEditItems();
        }}
        disabled={disabled}
        className={`${btnBase} bg-slate-800 hover:bg-slate-700 text-slate-100`}
      >
        <Edit3 size={16} />
        <span className="hidden md:inline">Items</span>
      </button>

      <button
        aria-label="Delete receipt"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={disabled}
        className={`${btnBase} bg-rose-700 hover:bg-rose-600 text-white`}
      >
        <Trash2 size={16} />
        <span className="hidden md:inline">Delete</span>
      </button>

      <button
        aria-label="Download receipt"
        title="Download"
        onClick={(e) => {
          e.stopPropagation();
          onDownload();
        }}
        disabled={disabled}
        className={`${btnBase} bg-slate-700 hover:bg-slate-600 text-slate-100`}
      >
        <Download size={16} />
        <span className="hidden md:inline">Download</span>
      </button>

      <button
        aria-label="Send via WhatsApp"
        title="WhatsApp"
        onClick={(e) => {
          e.stopPropagation();
          onSendWhatsapp();
        }}
        disabled={disabled}
        className={`${btnBase} bg-emerald-600 hover:bg-emerald-500 text-black`}
      >
        <Send size={16} />
        <span className="hidden md:inline">WhatsApp</span>
      </button>

      {onPodAction && (
        <button
          aria-label={podActionLabel}
          title={podActionLabel}
          onClick={(e) => {
            e.stopPropagation();
            onPodAction?.();
          }}
          disabled={disabled || podActionProcessing}
          className={`${btnBase} bg-yellow-500/60 hover:bg-yellow-500 text-black`}
        >
          <Check size={16} />
          <span className="hidden md:inline">{podActionProcessing ? "Processing..." : podActionLabel}</span>
        </button>
      )}

      {onMarkPaid && (
        <button
          aria-label="Mark paid"
          title="Mark paid"
          onClick={(e) => {
            e.stopPropagation();
            onMarkPaid?.();
          }}
          disabled={disabled}
          className={`${btnBase} bg-emerald-600/80 hover:bg-emerald-600 text-black`}
        >
          <DollarSign size={16} />
          <span className="hidden md:inline">Mark Paid</span>
        </button>
      )}

      {onResendPod && (
        <button
          aria-label="Resend POD"
          title="Resend POD"
          onClick={(e) => {
            e.stopPropagation();
            onResendPod();
          }}
          disabled={disabled}
          className={`${btnBase} bg-yellow-600/60 hover:bg-yellow-600 text-black`}
        >
          <Send size={16} />
          <span className="hidden md:inline">Resend POD</span>
        </button>
      )}

      <button
        aria-label="Print receipt"
        title="Print"
        onClick={(e) => {
          e.stopPropagation();
          onPrint();
        }}
        disabled={disabled}
        className={`${btnBase} bg-slate-800 hover:bg-slate-700 text-slate-100`}
      >
        <Printer size={16} />
        <span className="hidden md:inline">Print</span>
      </button>
    </div>
  );
}
