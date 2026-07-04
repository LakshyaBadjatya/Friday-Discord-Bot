/**
 * @module ai/providers/nvidia-nim
 * @description NVIDIA NIM provider with multi-model routing, fallback, retry, timeout, and caching.
 */
import { config } from '../../config.js';
import { createLogger } from '../../logger.js';
import { prisma } from '../../database.js';
import { AIProvider } from './base.js';
import type { CompletionOptions, CompletionResult, ChatMessage } from '../../types.js';
import crypto from 'crypto';

const log = createLogger('nvidia-nim');

/** Maximum retries per request. */
const MAX_RETRIES = 3;
/** Default timeout in ms. */
const DEFAULT_TIMEOUT = 30_000;
/** Cache TTL in ms (5 minutes). */
const CACHE_TTL = 5 * 60 * 1000;

export class NvidiaNimProvider extends AIProvider {
  readonly name = 'nvidia-nim';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly fallbackModels: string[];

  constructor() {
    super();
    this.baseUrl = config.NVIDIA_BASE_URL;
    this.apiKey = config.NVIDIA_API_KEY;
    this.defaultModel = config.NVIDIA_DEFAULT_MODEL;
    this.fallbackModels = config.NVIDIA_FALLBACK_MODELS
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getAvailableModels(): string[] {
    return [this.defaultModel, ...this.fallbackModels];
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const modelsToTry = [model, ...this.fallbackModels.filter((m) => m !== model)];

    // Check cache
    const cacheKey = this.buildCacheKey(options);
    const cached = await this.checkCache(cacheKey);
    if (cached) {
      log.debug({ model }, 'Cache hit');
      return { ...cached, cached: true };
    }

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await this.makeRequest(currentModel, options, attempt);

          // Cache the result
          await this.cacheResponse(cacheKey, result, currentModel);

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          log.warn(
            { model: currentModel, attempt, error: lastError.message },
            'Request failed, retrying',
          );

          // Exponential backoff
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
          }
        }
      }
      log.warn({ model: currentModel }, 'All retries exhausted, trying fallback');
    }

    throw new Error(`All models failed. Last error: ${lastError?.message}`);
  }

  /**
   * Make a single API request to NVIDIA NIM.
   */
  private async makeRequest(
    model: string,
    options: CompletionOptions,
    attempt: number,
  ): Promise<CompletionResult> {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const startTime = Date.now();

    try {
      const body: Record<string, unknown> = {
        model,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4096,
        stream: false,
      };

      // NVIDIA NIM supports response_format for JSON mode on compatible models
      if (options.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`NVIDIA NIM ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
        usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from NVIDIA NIM');

      const latencyMs = Date.now() - startTime;
      const tokensUsed = data.usage?.total_tokens ?? 0;

      log.info({ model, latencyMs, tokensUsed, attempt }, 'Completion successful');

      return { content, model, tokensUsed, latencyMs, cached: false };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Build a deterministic cache key from the request. */
  private buildCacheKey(options: CompletionOptions): string {
    const payload = JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      jsonMode: options.jsonMode,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /** Check database cache for a prior response. */
  private async checkCache(key: string): Promise<CompletionResult | null> {
    try {
      const cached = await prisma.responseCache.findUnique({ where: { cacheKey: key } });
      if (!cached || cached.expiresAt < new Date()) return null;
      return JSON.parse(cached.response) as CompletionResult;
    } catch {
      return null;
    }
  }

  /** Store a response in the database cache. */
  private async cacheResponse(key: string, result: CompletionResult, model: string): Promise<void> {
    try {
      await prisma.responseCache.upsert({
        where: { cacheKey: key },
        create: {
          cacheKey: key,
          response: JSON.stringify(result),
          model,
          expiresAt: new Date(Date.now() + CACHE_TTL),
        },
        update: {
          response: JSON.stringify(result),
          model,
          expiresAt: new Date(Date.now() + CACHE_TTL),
        },
      });
    } catch (e) {
      log.warn({ error: e }, 'Failed to cache response');
    }
  }
}
