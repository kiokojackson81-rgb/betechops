declare module "next-auth" {
  interface User {
    // role added by our session callback: 'ADMIN' | 'ATTENDANT'
    role?: string;
  }

  interface Session {
    user: User;
  }
}
