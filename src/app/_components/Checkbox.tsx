"use client"

import React from "react";

type Props = {
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  className?: string;
};

export default function Checkbox({ checked = false, onCheckedChange, className = "" }: Props) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      className={`w-4 h-4 rounded ${className}`}
    />
  );
}
