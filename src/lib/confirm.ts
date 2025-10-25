export async function confirmDialog(message: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const id = Math.random().toString(36).slice(2, 9);
  return new Promise((resolve) => {
    function onResp(e: Event) {
      const ev = e as CustomEvent<{ id?: string; ok?: boolean }>;
      if (ev.detail?.id !== id) return;
      window.removeEventListener('betechops:confirm-response', onResp as EventListener);
      resolve(Boolean(ev.detail?.ok));
    }
    window.addEventListener('betechops:confirm-response', onResp as EventListener);
    window.dispatchEvent(new CustomEvent('betechops:confirm-request', { detail: { id, message } }));
  });
}

export default confirmDialog;
