/**
 * @module ai/agents/planner
 * @description Planner agent — converts natural language into structured JSON action plans.
 */
import { createLogger } from '../../logger.js';
import { agentComplete } from '../providers/registry.js';
import { ExecutionPlanSchema, type ExecutionPlan } from '../../types.js';
import { config } from '../../config.js';

const log = createLogger('agent:planner');

const SYSTEM_PROMPT = `You are the Planner Agent of a Discord Server Architect system.
Convert natural-language requests into structured JSON execution plans.

Respond ONLY with JSON: { "summary": string, "actions": [...], "warnings": string[] }

Each action: { "id": "action_N", "type": ACTION_TYPE, "description": string, "params": {...}, "destructive": boolean }

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

Rules:
- DELETE and permission-revoke actions are destructive: true
- Channel names: lowercase with hyphens
- Create categories before their channels
- Max ${config.MAX_ACTIONS_PER_REQUEST} actions
- If ambiguous, add warnings
- If impossible, return empty actions with a warning`;

export async function planActions(
  userMessage: string,
  serverContext?: string,
  guildModel?: string,
): Promise<{ plan: ExecutionPlan; tokensUsed: number; model: string }> {
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...(serverContext ? [{ role: 'system' as const, content: `Current server:\n${serverContext}` }] : []),
    { role: 'user' as const, content: userMessage },
  ];

  log.info({ userMessage }, 'Planning actions');

  try {
    const result = await agentComplete('planner', {
      messages,
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: true,
    }, guildModel);

    const parsed = JSON.parse(result.content);
    const validated = ExecutionPlanSchema.parse(parsed);

    if (validated.actions.length > config.MAX_ACTIONS_PER_REQUEST) {
      validated.actions = validated.actions.slice(0, config.MAX_ACTIONS_PER_REQUEST);
      validated.warnings.push(`Truncated to ${config.MAX_ACTIONS_PER_REQUEST} actions.`);
    }

    log.info({ actionCount: validated.actions.length }, 'Plan created');
    return { plan: validated, tokensUsed: result.tokensUsed, model: result.model };
  } catch (error) {
    log.error({ error }, 'Planning failed');
    return {
      plan: {
        summary: 'Planning failed.',
        actions: [],
        warnings: [`Planner error: ${error instanceof Error ? error.message : 'Unknown'}`],
      },
      tokensUsed: 0,
      model: 'none',
    };
  }
}
