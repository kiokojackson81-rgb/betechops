/** Structured logging helpers used across server-side modules. */
export function logInfo(msg: string, meta?: Record<string, any>) {
  if (meta) console.info(msg, JSON.stringify(meta));
  else console.info(msg);
}

export function logWarn(msg: string, meta?: Record<string, any>) {
  if (meta) console.warn(msg, JSON.stringify(meta));
  else console.warn(msg);
}

export function logError(msg: string, meta?: Record<string, any>) {
  if (meta) console.error(msg, JSON.stringify(meta));
  else console.error(msg);
}
