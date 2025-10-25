export type ToastKind = 'info' | 'success' | 'error';

export function toast(message: string, kind: ToastKind = 'info') {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('betechops:toast', { detail: { message, type: kind } }));
  } catch (e) {
    // best-effort
    // log to console if available
    console.warn('toast failed', e);
  }
}

export default toast;
