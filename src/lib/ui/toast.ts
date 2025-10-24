// Lightweight event-based toast helper for client components.
export type ToastType = 'info' | 'success' | 'error' | 'warn';

export function showToast(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('betechops:toast', { detail: { message, type } }));
}

// Simple confirm helper that currently falls back to window.confirm.
// We emit an event for potential client listeners, but return the native confirm result.
export async function confirmDialog(message: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  // promise-based confirm: dispatch a request and wait for a response event
  const id = `${Date.now()}.${Math.random().toString(36).slice(2,8)}`;
  return new Promise<boolean>((resolve) => {
    function onResponse(e: Event) {
      const ev = e as CustomEvent<{ id?: string; ok?: boolean }>;
      if (ev.detail?.id !== id) return;
      window.removeEventListener('betechops:confirm-response', onResponse as EventListener);
      resolve(Boolean(ev.detail?.ok));
    }
    window.addEventListener('betechops:confirm-response', onResponse as EventListener);
    window.dispatchEvent(new CustomEvent('betechops:confirm-request', { detail: { id, message } }));
    // fallback timeout: if nobody responds within 20s, use native confirm
    setTimeout(() => {
      try {
        window.removeEventListener('betechops:confirm-response', onResponse as EventListener);
      } catch {}
      resolve(window.confirm(message));
    }, 20000);
  });
}
