import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PostLogin() {
  const session = await auth();
  const role = session?.user?.role as string | undefined;
  if (!session || !role) {
    // No session? Send to the generic attendant login
    redirect("/attendant/login");
  }
  if (role === "ADMIN") return redirect("/admin");
  return redirect("/attendant");
}
