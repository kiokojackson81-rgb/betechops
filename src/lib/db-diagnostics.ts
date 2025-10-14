// src/lib/db-diagnostics.ts
// Utilities to produce safe, human-readable diagnostics for database failures.

function maskDatabaseUrl(message: string) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return message;
  return message.split(dbUrl).join("<DATABASE_URL>");
}

function maskCredentials(message: string) {
  // Replace credentials in Postgres URLs with a placeholder.
  return message.replace(/(postgres(?:ql)?:\/\/)([^:@]+)(?::([^@]+))?@/gi, (_, scheme: string) => `${scheme}<credentials>@`);
}

export function summarizeDbError(error: unknown): string {
  if (!error) return "Unknown database error";
  const baseMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const maskedUrl = maskDatabaseUrl(baseMessage);
  const maskedCredentials = maskCredentials(maskedUrl);
  return maskedCredentials;
}
