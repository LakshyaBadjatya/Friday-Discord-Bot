/**
 * @module services/rateLimiter
 * @description Internal queue that respects Discord rate limits with retry and resume.
 */
import { createLogger } from '../logger.js';

const log = createLogger('rate-limiter');

interface QueuedTask<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
  maxRetries: number;
}

/**
 * A rate-limited task queue with retry support.
 * Ensures Discord API calls are spaced out to avoid 429s.
 */
export class RateLimitQueue {
  private queue: QueuedTask<any>[] = [];
  private processing = false;
  private readonly minDelay: number;
  private readonly maxRetries: number;
  private consecutiveErrors = 0;

  constructor(minDelayMs = 300, maxRetries = 3) {
    this.minDelay = minDelayMs;
    this.maxRetries = maxRetries;
  }

  /** Add a task to the queue. Returns a promise that resolves when the task completes. */
  enqueue<T>(id: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ id, fn, resolve, reject, retries: 0, maxRetries: this.maxRetries });
      if (!this.processing) this.process();
    });
  }

  /** Get the current queue length. */
  get length(): number {
    return this.queue.length;
  }

  /** Process the queue sequentially. */
  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;

      try {
        const result = await task.fn();
        task.resolve(result);
        this.consecutiveErrors = 0;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Check if it's a rate limit error (Discord 429)
        const isRateLimit = err.message.includes('429') || err.message.toLowerCase().includes('rate limit');

        if (isRateLimit || task.retries < task.maxRetries) {
          task.retries++;
          const backoff = isRateLimit
            ? Math.min(5000, 1000 * Math.pow(2, task.retries)) // Longer backoff for rate limits
            : 500 * task.retries;

          log.warn({ taskId: task.id, retry: task.retries, backoffMs: backoff }, 'Retrying task');
          await this.delay(backoff);

          // Re-add to front of queue
          this.queue.unshift(task);
        } else {
          log.error({ taskId: task.id, error: err.message }, 'Task failed permanently');
          task.reject(err);
          this.consecutiveErrors++;
        }
      }

      // Dynamic delay: slow down if we're seeing errors
      const dynamicDelay = this.consecutiveErrors > 3
        ? this.minDelay * 3
        : this.minDelay;
      await this.delay(dynamicDelay);
    }

    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

/** Singleton rate-limit queue for Discord API calls. */
export const discordQueue = new RateLimitQueue(300, 3);
