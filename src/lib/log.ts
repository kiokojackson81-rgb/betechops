import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  // Keep output compact; in dev you may enable prettyPrint
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' as any } : undefined,
});

export default logger;
