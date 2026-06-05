declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    phone?: string | null;
    attendantCategory?: string | null;
    isActive?: boolean;
    isAgent?: boolean;
    agentStatus?: string | null;
    lastLoginMethod?: string | null;
  }

  interface Session {
    user: User;
  }
}
