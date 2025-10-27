import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

const transport = process.env.NODE_ENV === 'development' ? ({ target: 'pino-pretty' } as unknown as { target: string }) : undefined;

export const logger = pino({
  level,
  // Keep output compact; in dev you may enable prettyPrint
  transport,
});

export default logger;
