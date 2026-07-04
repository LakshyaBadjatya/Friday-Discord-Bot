/**
 * @module ai/interpreter
 * @description AI command interpreter — translates natural language into execution plans.
 */
import OpenAI from 'openai';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { ExecutionPlan, ExecutionPlanSchema } from '../types.js';

const log = createLogger('ai-interpreter');

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
  baseURL: config.OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are a Discord Server Architect AI. Convert natural-language requests into structured JSON execution plans.

Respond with JSON: { "summary": string, "actions": [{ "id": "action_N", "type": ACTION_TYPE, "description": string, "params": {...}, "destructive": boolean }], "warnings": string[] }

ACTION_TYPEs and params:
CREATE_CATEGORY: { name }
EDIT_CATEGORY: { name, newName?, position? }
DELETE_CATEGORY: { name }
CREATE_TEXT_CHANNEL: { name, category?, topic?, nsfw?, slowMode? }
CREATE_VOICE_CHANNEL: { name, category?, userLimit? }
CREATE_FORUM_CHANNEL: { name, category?, topic? }
CREATE_ANNOUNCEMENT_CHANNEL: { name, category?, topic? }
CREATE_STAGE_CHANNEL: { name, category?, topic? }
EDIT_CHANNEL: { name, newName?, topic?, nsfw?, slowMode?, userLimit? }
DELETE_CHANNEL: { name }
CREATE_ROLE: { name, color?, hoist?, mentionable?, permissions? }
EDIT_ROLE: { name, newName?, color?, hoist?, mentionable?, permissions? }
DELETE_ROLE: { name }
SET_PERMISSIONS: { roleName, permissions: string[] }
SET_CHANNEL_PERMISSIONS: { channelName, target, targetType: "role"|"member", allow?, deny? }
MOVE_CHANNEL: { name, category, position? }
SET_ROLE_HIERARCHY: { roles: [{ name, position }] }
CREATE_TICKET_PANEL: { channelName, title?, description? }
SETUP_WELCOME: { channelName, message?, goodbyeMessage?, autoRoles? }
SETUP_LOGGING: { channelName }

Rules: Mark DELETE/permission-revoke as destructive. Use lowercase-hyphen channel names. Max ${config.MAX_ACTIONS_PER_REQUEST} actions. Group logically (category before its channels).`;

export async function interpretCommand(
  userMessage: string,
  serverContext?: string,
): Promise<ExecutionPlan> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];
  if (serverContext) {
    messages.push({ role: 'system', content: `Current server state:\n${serverContext}` });
  }
  messages.push({ role: 'user', content: userMessage });

  log.info({ userMessage }, 'Interpreting command');

  try {
    const response = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const validated = ExecutionPlanSchema.parse(JSON.parse(content));

    if (validated.actions.length > config.MAX_ACTIONS_PER_REQUEST) {
      validated.actions = validated.actions.slice(0, config.MAX_ACTIONS_PER_REQUEST);
      validated.warnings.push(`Plan truncated to ${config.MAX_ACTIONS_PER_REQUEST} actions.`);
    }

    log.info({ actionCount: validated.actions.length, summary: validated.summary }, 'Plan generated');
    return validated;
  } catch (error) {
    log.error({ error }, 'AI interpretation failed');
    return {
      summary: 'Failed to interpret the command.',
      actions: [],
      warnings: [`AI error: ${error instanceof Error ? error.message : 'Unknown'}. Try rephrasing.`],
    };
  }
}

export function buildServerContext(
  categories: { name: string; channels: string[] }[],
  roles: { name: string; color: string; memberCount: number }[],
): string {
  const lines: string[] = ['## Categories & Channels:'];
  for (const cat of categories) {
    lines.push(`📁 ${cat.name}`);
    for (const ch of cat.channels) lines.push(`  └─ #${ch}`);
  }
  lines.push('\n## Roles:');
  for (const role of roles) {
    lines.push(`🔹 ${role.name} (${role.color}, ${role.memberCount} members)`);
  }
  return lines.join('\n');
}
