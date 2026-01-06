import { prisma } from "../prisma.ts";

export type LoadedJumiaCredentials = {
  source: "env" | "db";
  credentialId?: string;
  clientId: string;
  clientSecret?: string | null;
  refreshToken: string;
  baseUrl?: string | null;
  authScheme?: string | null;
};

const DEFAULT_SCOPE = "JUMIA_VENDOR";

export async function loadJumiaCredentials(scope: string = DEFAULT_SCOPE): Promise<LoadedJumiaCredentials> {
  const envClientId = process.env.JUMIA_CLIENT_ID?.trim();
  const envRefreshToken = process.env.JUMIA_REFRESH_TOKEN?.trim();
  if (envClientId && envRefreshToken) {
    return {
      source: "env",
      clientId: envClientId,
      clientSecret: process.env.JUMIA_CLIENT_SECRET?.trim() ?? null,
      refreshToken: envRefreshToken,
      baseUrl: process.env.JUMIA_VENDOR_API_BASE?.trim() ?? null,
      authScheme: process.env.JUMIA_AUTH_SCHEME?.trim() ?? null,
    };
  }

  // Try the requested scope first, then fall back to the GLOBAL scope
  let credential = await prisma.apiCredential.findFirst({
    where: { scope },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  if (!credential && scope !== "GLOBAL") {
    credential = await prisma.apiCredential.findFirst({
      where: { scope: "GLOBAL" },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  }

  if (credential?.clientId && credential.refreshToken) {
    return {
      source: "db",
      credentialId: credential.id,
      clientId: credential.clientId,
      clientSecret: credential.apiSecret,
      refreshToken: credential.refreshToken,
      baseUrl: credential.apiBase,
      authScheme: credential.issuer,
    };
  }

  throw new Error(
    "Jumia API credentials are not configured. Provide JUMIA_CLIENT_ID/JUMIA_REFRESH_TOKEN env vars or create an ApiCredential row with scope 'JUMIA_VENDOR' or 'GLOBAL'.",
  );
}
