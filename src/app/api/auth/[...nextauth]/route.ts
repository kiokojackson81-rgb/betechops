/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async session(params: any) {
      const session = params.session;
        // Attach a role based on DB lookup if possible, otherwise fall back to ADMIN_EMAIL env var.
        const email = session?.user?.email ?? "";
        if (!session) return session;
        if (!session.user) session.user = {} as { email?: string; role?: string };

        // Try DB lookup: see if the email exists as an Attendant. If so, mark as ATTENDANT.
        try {
          if (email) {
            const attendant = await prisma.attendant.findUnique({ where: { email } });
            if (attendant) {
              session.user.role = "ATTENDANT";
              return session;
            }
          }
        } catch {
          // If prisma not configured or table missing, fall back to env-based check below.
        }

        session.user.role =
          email && process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
            ? "ADMIN"
            : "ATTENDANT";

        return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
