import { prisma } from '@/lib/prisma';
import { sendReceiptChannels } from '@/workers/receiptSender';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

// Scans receipts with data.podDelivery.retry.nextAttemptAt <= now and attempts
// to resend the POD WhatsApp via `sendReceiptChannels`.
// - Respects retry.maxAttempts
// - Uses exponential backoff configured by env `CHATRACE_RETRY_BASE_SECONDS` and `CHATRACE_RETRY_MAX_ATTEMPTS`
// - Writes actionLog entries for attempts/completion/exhaustion
// - Uses a simple `podDelivery.lockedAt` field to avoid concurrent processing

export async function runPodRetry(limit = 50) {
  const now = new Date();
  const baseSeconds = Number(process.env.CHATRACE_RETRY_BASE_SECONDS || 60);
  const lockTtlSeconds = Number(process.env.CHATRACE_RETRY_LOCK_TTL_SECONDS || 300);

  // Find candidates. We'll filter receipts in JS for those with podDelivery.retry
  // because Prisma JSON filtering varies by provider/version and can cause
  // strict typing issues in TS.
  const candidates = await prisma.receipt.findMany({
    take: limit,
  });

  const toProcess = candidates.filter((r) => {
    const data = typeof r.data === 'object' && r.data ? (r.data as any) : undefined;
    const pod = data?.podDelivery;
    if (!pod || !pod.retry || !pod.retry.nextAttemptAt) return false;
    const nextAttemptAt = new Date(pod.retry.nextAttemptAt);
    if (isNaN(nextAttemptAt.getTime())) return false;
    if (nextAttemptAt > now) return false;
    const attempts = Number(pod.retry.attempts || 0);
    const maxAttempts = Number(pod.retry.maxAttempts || process.env.CHATRACE_RETRY_MAX_ATTEMPTS || 5);
    if (attempts >= maxAttempts) return false;
    const lockedAt = pod.lockedAt ? new Date(pod.lockedAt) : null;
    if (lockedAt && Date.now() - lockedAt.getTime() < lockTtlSeconds * 1000) return false;
    return true;
  });

  for (const receipt of toProcess) {
    const receiptId = receipt.id;
    try {
      // Acquire a simple lock by setting lockedAt on the podDelivery object
      const currentData = typeof receipt.data === 'object' && receipt.data ? (receipt.data as any) : {};
      const pod = currentData.podDelivery || {};
      pod.lockedAt = new Date().toISOString();
      const newData = { ...currentData, podDelivery: pod };
      await prisma.receipt.update({ where: { id: receiptId }, data: { data: newData as Prisma.InputJsonValue } });

      // Build options for send; reuse any configured fallbackChannels stored in podDelivery
      const fallbackChannels = Array.isArray(pod.fallbackChannels) ? pod.fallbackChannels : undefined;
      const requestId = randomUUID();
      const opts: any = {
        requestId,
        chatraceTag: (process.env.CHATRACE_POD_CUSTOMER_TAG || 'pod_dispatch_speedaf').trim(),
        markPodSent: true,
        skipDefaultChatraceTags: true,
      };
      if (Array.isArray(fallbackChannels)) opts.fallbackChannels = fallbackChannels;

      // Attempt send (whatsapp via chatrace)
      const result = await sendReceiptChannels(receiptId, ['whatsapp'], opts);

      if (result.ok) {
        // Success: clear retry metadata and lockedAt; ensure sentAt exists
        const prev = typeof receipt.data === 'object' && receipt.data ? (receipt.data as any) : {};
        const prevPod = prev.podDelivery || {};
        const updatedPod = {
          ...prevPod,
          retry: undefined,
          lockedAt: undefined,
          sentAt: prevPod.sentAt || new Date().toISOString(),
          sentBy: prevPod.sentBy || 'system_retry',
        };
        const updated = { ...prev, podDelivery: updatedPod };
        await prisma.receipt.update({ where: { id: receiptId }, data: { data: updated as Prisma.InputJsonValue } });
        await prisma.actionLog.create({ data: { actorId: undefined, entity: 'Receipt', entityId: receiptId, action: 'CHARTRACE_RETRY_COMPLETED', before: receipt as any, after: { result } } as any });
      } else {
        // Failed: increment attempts, schedule next attempt or mark exhausted
        const prev = typeof receipt.data === 'object' && receipt.data ? (receipt.data as any) : {};
        const prevPod = prev.podDelivery || {};
        const prevAttempts = Number(prevPod.retry?.attempts || 0);
        const maxAttempts = Number(prevPod.retry?.maxAttempts || process.env.CHATRACE_RETRY_MAX_ATTEMPTS || 5);
        const nextAttempts = prevAttempts + 1;

        if (nextAttempts >= maxAttempts) {
          const exhaustedRetry = {
            attempts: nextAttempts,
            lastAttemptAt: new Date().toISOString(),
            lastError: ((result && (result.errors ?? result)) || 'chatrace_failed'),
            exhausted: true,
            maxAttempts,
          };
          const updatedPod = { ...prevPod, retry: exhaustedRetry, lockedAt: undefined };
          const updated = { ...prev, podDelivery: updatedPod };
          await prisma.receipt.update({ where: { id: receiptId }, data: { data: updated as Prisma.InputJsonValue } });
          await prisma.actionLog.create({ data: { actorId: undefined, entity: 'Receipt', entityId: receiptId, action: 'CHARTRACE_RETRY_EXHAUSTED', before: receipt as any, after: { retry: exhaustedRetry } } as any });
        } else {
          const nextAttemptAt = new Date(Date.now() + baseSeconds * 1000 * Math.pow(2, prevAttempts)).toISOString();
          const retryData = {
            attempts: nextAttempts,
            lastAttemptAt: new Date().toISOString(),
            lastError: ((result && (result.errors ?? result)) || 'chatrace_failed'),
            nextAttemptAt,
            maxAttempts,
          };
          const updatedPod = { ...prevPod, retry: retryData, lockedAt: undefined };
          const updated = { ...prev, podDelivery: updatedPod };
          await prisma.receipt.update({ where: { id: receiptId }, data: { data: updated as Prisma.InputJsonValue } });
          await prisma.actionLog.create({ data: { actorId: undefined, entity: 'Receipt', entityId: receiptId, action: 'CHARTRACE_RETRY_ATTEMPT', before: receipt as any, after: { retry: retryData } } as any });
        }
      }
    } catch (err) {
      console.error('[podRetryWorker] unexpected error processing receipt', { receiptId, error: err instanceof Error ? err.message : String(err) });
      // Attempt to clear lock so it can be retried later
      try {
        const current = await prisma.receipt.findUnique({ where: { id: receiptId } });
        const currData = typeof current?.data === 'object' && current?.data ? (current.data as any) : {};
        if (currData.podDelivery && currData.podDelivery.lockedAt) {
          currData.podDelivery.lockedAt = undefined;
          await prisma.receipt.update({ where: { id: receiptId }, data: { data: currData as Prisma.InputJsonValue } });
        }
      } catch (e) {
        console.error('[podRetryWorker] failed to clear lock after error', { receiptId, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
}

export default runPodRetry;

// Allow running directly: `node ./dist/workers/podRetryWorker.js` or via ts-node
if (require.main === module) {
  runPodRetry().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
