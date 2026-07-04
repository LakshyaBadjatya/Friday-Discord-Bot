/**
 * @module ai/providers/registry
 * @description Provider registry — resolves the active AI provider and routes agent-specific models.
 */
import { config } from '../../config.js';
import { createLogger } from '../../logger.js';
import { AIProvider } from './base.js';
import { NvidiaNimProvider } from './nvidia-nim.js';
import { OpenAIProvider } from './openai.js';
import type { AgentRole, CompletionOptions, CompletionResult } from '../../types.js';

const log = createLogger('provider-registry');

/** All registered providers. */
const providers: Record<string, AIProvider> = {
  nvidia: new NvidiaNimProvider(),
  openai: new OpenAIProvider(),
  // Future: anthropic, openrouter, ollama
};

/** Get the currently active provider. */
export function getProvider(): AIProvider {
  const provider = providers[config.AI_PROVIDER];
  if (!provider || !provider.isAvailable()) {
    // Fallback to any available provider
    for (const p of Object.values(providers)) {
      if (p.isAvailable()) {
        log.warn({ requested: config.AI_PROVIDER, using: p.name }, 'Falling back to available provider');
        return p;
      }
    }
    throw new Error('No AI provider is configured and available. Check your .env file.');
  }
  return provider;
}

/**
 * Get the model to use for a specific agent role.
 * Allows configuring different models for planner, reviewer, and optimizer.
 */
export function getModelForRole(role: AgentRole, guildModel?: string): string {
  // Guild-level override
  if (guildModel) return guildModel;

  // Per-agent model config from env
  switch (role) {
    case 'planner':
      return config.NVIDIA_PLANNER_MODEL || config.NVIDIA_DEFAULT_MODEL;
    case 'reviewer':
      return config.NVIDIA_REVIEWER_MODEL || config.NVIDIA_DEFAULT_MODEL;
    case 'optimizer':
      return config.NVIDIA_OPTIMIZER_MODEL || config.NVIDIA_DEFAULT_MODEL;
  }
}

/**
 * Convenience: run a completion with the active provider and agent-specific model.
 */
export async function agentComplete(
  role: AgentRole,
  options: Omit<CompletionOptions, 'model'>,
  guildModel?: string,
): Promise<CompletionResult> {
  const provider = getProvider();
  const model = getModelForRole(role, guildModel);
  return provider.complete({ ...options, model });
}

/** List all registered provider names. */
export function listProviders(): string[] {
  return Object.keys(providers);
}
