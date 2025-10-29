// scripts/checkEnv.ts
// Simple environment sanity check for Vercel build logs or local runs

console.log("SECURE_JSON_KEY:", !!process.env.SECURE_JSON_KEY);
console.log("DATABASE_URL:", !!process.env.DATABASE_URL);
console.log("OIDC_TOKEN_URL:", process.env.OIDC_TOKEN_URL);
console.log("JUMIA_API_BASE:", process.env.JUMIA_API_BASE);
