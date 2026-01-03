// Provides the current Date in Africa/Nairobi without extra runtime deps.
export function nowInNairobi(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const nairobiOffsetMs = 3 * 60 * 60 * 1000; // UTC+3
  return new Date(utc + nairobiOffsetMs);
}
