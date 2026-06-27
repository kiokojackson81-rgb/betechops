import { redirect } from "next/navigation";

export default function AdminVoiceFeedbackRedirectPage() {
  redirect("/admin/communications/voice?tab=feedback");
}
