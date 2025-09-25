import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PostLogin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || !role) {
    // No session? Send to the generic attendant login
    redirect("/attendant/login");
  }
  if (role === "ADMIN") redirect("/admin");
  redirect("/attendant");
}
