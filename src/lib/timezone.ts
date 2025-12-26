// Provides the current Date in Africa/Nairobi without extra runtime deps.
export function nowInNairobi(): Date {
  const nairobiNow = new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
  return new Date(nairobiNow);
}
