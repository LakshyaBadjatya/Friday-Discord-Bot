/**
 * @module logger
 * @description Pino structured logger with pretty-printing in development.
 */
import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});

/** Create a child logger for a subsystem. */
export function createLogger(name: string) {
  return logger.child({ subsystem: name });
}
