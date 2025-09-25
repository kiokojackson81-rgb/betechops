/* NextAuth route: keep this file minimal. authOptions lives in src/lib/nextAuth.ts to
   avoid exporting non-route symbols from a Next.js Route file. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";

const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };
