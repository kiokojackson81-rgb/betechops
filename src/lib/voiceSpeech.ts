export function toSpeechText(text: string) {
  return text.replace(/\bBetech\b/gi, (match) => {
    if (match === "BETECH") return "BEE TECH";
    if (match === "betech") return "bee tech";
    return "Bee Tech";
  });
}
