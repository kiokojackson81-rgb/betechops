export function normalizePhone(input?: string) {
  if (!input) return "";
  let s = String(input).trim();
  // remove spaces, dashes, parentheses
  s = s.replace(/[^+0-9]/g, "");
  // if starts with 0 and length 10 -> convert to +2547xxxxxxx
  if (/^0[0-9]{9}$/.test(s)) {
    return "+254" + s.slice(1);
  }
  // if starts with 7 and 9 digits -> add +254
  if (/^[7][0-9]{8}$/.test(s)) {
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
