import AttendantOnlineClient from "./AttendantOnlineClient";

export default function AttendantOnlineOpsPage() {
  // Render a client wrapper which defaults to the create form and offers an inline
  // "View receipts" toggle (attendant-facing search + preview).
  return <AttendantOnlineClient initial={[]} />;
}
