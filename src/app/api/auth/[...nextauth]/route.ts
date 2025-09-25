import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Attach a simple role based on email match against ADMIN_EMAIL env var.
      const email = session?.user?.email ?? "";
      (session as any).user = session.user || {};
      (session as any).user.role =
        email && process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
          ? "ADMIN"
          : "ATTENDANT";
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};

export { authOptions };

const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };
