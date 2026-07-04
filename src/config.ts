/**
 * @module config
 * @description Centralized, Zod-validated configuration from environment variables.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),

  // AI Provider selection
  AI_PROVIDER: z.enum(['nvidia', 'openai', 'anthropic', 'openrouter', 'ollama']).default('nvidia'),

  // NVIDIA NIM
  NVIDIA_API_KEY: z.string().default(''),
  NVIDIA_BASE_URL: z.string().default('https://integrate.api.nvidia.com/v1'),
  NVIDIA_DEFAULT_MODEL: z.string().default('nvidia/llama-3.1-nemotron-ultra-253b-v1'),
  NVIDIA_PLANNER_MODEL: z.string().default(''),
  NVIDIA_REVIEWER_MODEL: z.string().default(''),
  NVIDIA_OPTIMIZER_MODEL: z.string().default(''),
  NVIDIA_FALLBACK_MODELS: z.string().default('meta/llama-3.1-70b-instruct,meta/llama-3.1-8b-instruct'),

  // OpenAI (future)
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o'),

  // Firebase
  FIREBASE_API_KEY: z.string().min(1),
  FIREBASE_AUTH_DOMAIN: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().min(1),
  FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  FIREBASE_APP_ID: z.string().min(1),
  FIREBASE_MEASUREMENT_ID: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().default(''),

  // Database (legacy fallback)
  DATABASE_URL: z.string().default('file:./data/bot.db'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Bot
  CONFIRMATION_TIMEOUT: z.coerce.number().int().positive().default(60),
  MAX_ACTIONS_PER_REQUEST: z.coerce.number().int().positive().default(50),

  // Deployment
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = Object.freeze(parsed.data);
export type AppConfig = z.infer<typeof envSchema>;
