import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

// Only enable pretty transport if explicitly requested AND the package is installed.
// This avoids runtime errors in Next/Turbopack dev when 'pino-pretty' isn't present.
const enablePretty = ['1', 'true', 'yes'].includes(String(process.env.PINO_PRETTY || '').toLowerCase());
const transport = enablePretty ? ({ target: 'pino-pretty' } as unknown as { target: string }) : undefined;

export const logger = pino({
  level,
  transport,
});

export default logger;
