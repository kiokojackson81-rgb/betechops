import { decryptDocument } from "@/lib/documentEncryption";
import { createHash } from "crypto";

export async function storedProjectDocument(url: string, sha256?: string | null) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("The stored project document is unavailable.");
  const bytes = decryptDocument(Buffer.from(await response.arrayBuffer()));
  if (sha256 && createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error("The stored project document failed its integrity check.");
  return bytes;
}
