"use client"

import React from "react";

export default function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", rows = 3, ...rest } = props;
  return <textarea rows={rows} {...rest} className={`rounded border px-2 py-1 w-full ${className}`} />;
}
