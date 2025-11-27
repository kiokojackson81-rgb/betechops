"use client"

import React from "react";

export default function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`rounded border px-2 py-1 w-full ${className}`} />;
}
