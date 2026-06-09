const KENYAN_MOBILE_REGEX = /^\+254(7|1)\d{8}$/;

export function normalizeKenyanPhone(input?: string) {
  if (!input) return "";
  let s = String(input).trim();
  s = s.replace(/[^+0-9]/g, "");

  if (/^0((?:7|1)\d{8})$/.test(s)) {
    return `+254${s.slice(1)}`;
  }

  if (/^((?:7|1)\d{8})$/.test(s)) {
    return `+254${s}`;
  }

  if (/^254((?:7|1)\d{8})$/.test(s)) {
    return `+${s}`;
  }

  if (KENYAN_MOBILE_REGEX.test(s)) {
    return s;
  }

  return "";
}

export function isValidKenyanPhone(input?: string) {
  return KENYAN_MOBILE_REGEX.test(normalizeKenyanPhone(input));
}

export function getKenyanPhoneVariants(input?: string) {
  const normalized = normalizeKenyanPhone(input);
  if (!normalized) return [];
  const local = `0${normalized.slice(4)}`;
  const short = normalized.slice(4);
  const digits = normalized.slice(1);
  return Array.from(new Set([normalized, local, short, digits]));
}

export function normalizePhone(input?: string) {
  const kenyan = normalizeKenyanPhone(input);
  if (kenyan) return kenyan;
  if (!input) return "";
  let s = String(input).trim();
  // remove spaces, dashes, parentheses
  s = s.replace(/[^+0-9]/g, "");
  // if starts with 0 and length 10 -> convert to +254XXXXXXXXX
  if (/^0[0-9]{9}$/.test(s)) {
    return "+254" + s.slice(1);
  }
  // if starts with Kenyan mobile prefix and 9 digits -> add +254
  if (/^[71][0-9]{8}$/.test(s)) {
    return "+254" + s;
  }
  // if starts with 254 and then 9 digits
  if (/^254[0-9]{9}$/.test(s)) {
    return "+" + s;
  }
  // if already in +254 format or other international formats, return as-is
  return s;
}

export function formatPhoneForDisplay(input?: string) {
  const s = normalizePhone(input);
  if (!s) return "";
  // simple grouping: +254 7xx xxx xxx
  if (s.startsWith("+254") && s.length >= 13) {
    return `${s.slice(0,4)} ${s.slice(4,7)} ${s.slice(7,10)} ${s.slice(10,13)}`;
  }
  return s;
}
