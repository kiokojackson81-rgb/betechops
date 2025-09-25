"use client";
import { ReactNode } from "react";

export default function AdminErrorBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
