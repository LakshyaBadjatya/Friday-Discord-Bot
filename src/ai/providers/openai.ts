/**
 * @module ai/providers/openai
 * @description OpenAI provider stub — ready for future activation.
 */
import { config } from '../../config.js';
import { AIProvider } from './base.js';
import type { CompletionOptions, CompletionResult } from '../../types.js';

export class OpenAIProvider extends AIProvider {
  readonly name = 'openai';

  isAvailable(): boolean {
    return !!config.OPENAI_API_KEY;
  }

  getAvailableModels(): string[] {
    return [config.OPENAI_MODEL];
  }

  getDefaultModel(): string {
    return config.OPENAI_MODEL;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    const model = options.model || this.getDefaultModel();

    const response = await fetch(`${config.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4096,
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty OpenAI response');

    return {
      content,
      model,
      tokensUsed: data.usage?.total_tokens ?? 0,
      latencyMs: Date.now() - startTime,
      cached: false,
    };
  }
}
