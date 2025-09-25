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
    async session(params: { session: { user?: { email?: string; role?: string } } | null }) {
      const session = params.session;
      const email = session?.user?.email ?? "";
      if (!session) return session;
      if (!session.user) session.user = {} as { email?: string; role?: string };
      try {
        if (email) {
          const attendant = await prisma.attendant.findUnique({ where: { email } });
          if (attendant) {
            session.user.role = "ATTENDANT";
            return session;
          }
        }
      } catch {
        // fall back
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

export default NextAuth;
