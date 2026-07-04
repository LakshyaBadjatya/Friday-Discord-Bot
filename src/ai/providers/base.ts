/**
 * @module ai/providers/base
 * @description Abstract AI provider interface. All providers implement this contract.
 */
import type { CompletionOptions, CompletionResult } from '../../types.js';

/**
 * Abstract base class for AI providers.
 * Extend this to add support for new AI backends (OpenAI, Anthropic, Ollama, etc.)
 */
export abstract class AIProvider {
  abstract readonly name: string;

  /**
   * Send a chat completion request to the AI provider.
   * @param options - Completion request options
   * @returns The completion result with content, usage, and latency
   * @throws Error if the request fails after all retries
   */
  abstract complete(options: CompletionOptions): Promise<CompletionResult>;

  /**
   * Check if the provider is available and configured.
   */
  abstract isAvailable(): boolean;

  /**
   * Get the list of available models for this provider.
   */
  abstract getAvailableModels(): string[];

  /**
   * Get the default model for this provider.
   */
  abstract getDefaultModel(): string;
}
