import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminOnlineEmailViewPage(props: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const params = await Promise.resolve(props.params);
  const id = (params?.id ?? "").toString();
  if (!id) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-sm text-slate-200">
        Missing email id.
      </div>
    );
  }

  const message = await prisma.marketplaceEmailMessage.findUnique({
    where: { id },
    include: { mailbox: { select: { email: true, displayName: true } } },
  });

  if (!message) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-sm text-slate-200">
        Email not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-xl font-semibold text-white">Email message</h1>
        <p className="text-sm text-slate-400">Raw inbox record stored for audit/debugging.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Mailbox</p>
            <p className="mt-1 text-sm font-semibold text-white">{message.mailbox.displayName ?? message.mailbox.email}</p>
            <p className="text-xs text-slate-400">{message.mailbox.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Received</p>
            <p className="mt-1 text-sm font-semibold text-white">{new Date(message.receivedAt).toLocaleString()}</p>
            <p className="text-xs text-slate-400">Provider id: {message.providerMsgId}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">From</p>
            <p className="mt-1 text-sm font-semibold text-white">{message.fromEmail ?? "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Subject</p>
            <p className="mt-1 text-sm font-semibold text-white">{message.subject ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Parser</p>
            <p className="mt-1 text-sm font-semibold text-white">{message.parserType}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
            <p className={`mt-1 text-sm font-semibold ${message.parseStatus === "FAILED" ? "text-rose-200" : "text-emerald-200"}`}>
              {message.parseStatus}
            </p>
            {message.parseError ? <p className="mt-1 text-xs text-rose-200">{message.parseError}</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-sm font-semibold text-white">Body (text)</h2>
        <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-200">
          {message.rawBodyText ?? ""}
        </pre>
        {message.rawBodyHtml ? (
          <details className="mt-4 rounded-xl border border-white/10 bg-slate-950/20 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">Body (HTML)</summary>
            <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-200">
              {message.rawBodyHtml}
            </pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}

