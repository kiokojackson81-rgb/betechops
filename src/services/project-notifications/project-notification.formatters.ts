import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/phone";

const emailSchema = z.string().trim().email();

export function formatKenyaCurrency(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("KES", "KSh");
}

export function formatKenyaNumber(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatKenyaDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

export function normalizeProjectPhone(phone?: string | null) {
  return normalizeKenyanPhone(phone || undefined);
}

export function isValidEmailAddress(email?: string | null) {
  if (!email || !email.trim()) return false;
  return emailSchema.safeParse(email).success;
}

export function sanitizeWhatsAppPhone(phone?: string | null) {
  const normalized = normalizeProjectPhone(phone);
  return normalized.startsWith("+") ? normalized.slice(1) : normalized;
}
