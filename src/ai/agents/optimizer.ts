/**
 * @module ai/agents/optimizer
 * @description Optimizer agent — groups API calls, minimizes rate limits, removes redundancy.
 */
import { createLogger } from '../../logger.js';
import { agentComplete } from '../providers/registry.js';
import { OptimizedPlanSchema, type ExecutionPlan, type OptimizedPlan } from '../../types.js';

const log = createLogger('agent:optimizer');

const SYSTEM_PROMPT = `You are the Optimizer Agent. Optimize a Discord server action plan for efficiency.

Respond ONLY with JSON:
{
  "plan": { same schema as input plan, potentially reordered/deduplicated },
  "optimizations": string[],
  "estimatedApiCalls": number,
  "estimatedTimeMs": number,
  "groupedActions": [{ "name": string, "actions": [...], "parallel": boolean }]
}

Optimize by:
- Remove duplicate operations (same channel/role created twice)
- Group related operations (all channels in same category together)
- Order operations correctly (categories before channels, roles before permissions)
- Estimate API calls (1 per create/edit/delete, 2 for permission changes)
- Estimate time (300ms per API call + 100ms overhead)
- Identify operations that can be parallelized within a group
- Remove no-op actions (editing a channel to its current name)

Keep the same plan schema but with optimized action order.`;

export async function optimizePlan(
  plan: ExecutionPlan,
  guildModel?: string,
): Promise<{ optimized: OptimizedPlan; tokensUsed: number }> {
  log.info({ actionCount: plan.actions.length }, 'Optimizing plan');

  // For small plans, skip AI optimization and do it locally
  if (plan.actions.length <= 5) {
    return {
      optimized: localOptimize(plan),
      tokensUsed: 0,
    };
  }

  try {
    const result = await agentComplete('optimizer', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Optimize:\n${JSON.stringify(plan, null, 2)}` },
      ],
      temperature: 0.2,
      maxTokens: 4096,
      jsonMode: true,
    }, guildModel);

    const validated = OptimizedPlanSchema.parse(JSON.parse(result.content));
    log.info({ optimizations: validated.optimizations.length, estimatedCalls: validated.estimatedApiCalls }, 'Optimization complete');
    return { optimized: validated, tokensUsed: result.tokensUsed };
  } catch (error) {
    log.warn({ error }, 'AI optimization failed, using local optimizer');
    return { optimized: localOptimize(plan), tokensUsed: 0 };
  }
}

/** Local fallback optimizer — deterministic, no AI needed. */
function localOptimize(plan: ExecutionPlan): OptimizedPlan {
  // Deduplicate by action type + primary param
  const seen = new Set<string>();
  const deduped = plan.actions.filter((a) => {
    const key = `${a.type}:${JSON.stringify(a.params)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: categories first, then channels, then roles, then permissions
  const priority: Record<string, number> = {
    CREATE_CATEGORY: 0, EDIT_CATEGORY: 1, CREATE_ROLE: 2,
    CREATE_TEXT_CHANNEL: 3, CREATE_VOICE_CHANNEL: 3, CREATE_FORUM_CHANNEL: 3,
    CREATE_ANNOUNCEMENT_CHANNEL: 3, CREATE_STAGE_CHANNEL: 3,
    EDIT_CHANNEL: 4, EDIT_ROLE: 4, MOVE_CHANNEL: 5,
    SET_PERMISSIONS: 6, SET_CHANNEL_PERMISSIONS: 6, SET_ROLE_HIERARCHY: 6,
    DELETE_CHANNEL: 7, DELETE_CATEGORY: 8, DELETE_ROLE: 9,
    CREATE_TICKET_PANEL: 10, SETUP_WELCOME: 10, SETUP_LOGGING: 10,
  };

  deduped.sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99));

  const estimatedApiCalls = deduped.length;
  const estimatedTimeMs = deduped.length * 400;

  // Group by action category
  const groups: { name: string; types: string[] }[] = [
    { name: 'Categories', types: ['CREATE_CATEGORY', 'EDIT_CATEGORY'] },
    { name: 'Roles', types: ['CREATE_ROLE', 'EDIT_ROLE'] },
    { name: 'Channels', types: ['CREATE_TEXT_CHANNEL', 'CREATE_VOICE_CHANNEL', 'CREATE_FORUM_CHANNEL', 'CREATE_ANNOUNCEMENT_CHANNEL', 'CREATE_STAGE_CHANNEL', 'EDIT_CHANNEL', 'MOVE_CHANNEL'] },
    { name: 'Permissions', types: ['SET_PERMISSIONS', 'SET_CHANNEL_PERMISSIONS', 'SET_ROLE_HIERARCHY'] },
    { name: 'Cleanup', types: ['DELETE_CHANNEL', 'DELETE_CATEGORY', 'DELETE_ROLE'] },
    { name: 'Setup', types: ['CREATE_TICKET_PANEL', 'SETUP_WELCOME', 'SETUP_LOGGING'] },
  ];

  const groupedActions = groups
    .map((g) => ({
      name: g.name,
      actions: deduped.filter((a) => g.types.includes(a.type)),
      parallel: false,
    }))
    .filter((g) => g.actions.length > 0);

  const optimizations: string[] = [];
  if (deduped.length < plan.actions.length) {
    optimizations.push(`Removed ${plan.actions.length - deduped.length} duplicate action(s)`);
  }
  optimizations.push('Sorted actions by dependency order');

  return {
    plan: { ...plan, actions: deduped },
    optimizations,
    estimatedApiCalls,
    estimatedTimeMs,
    groupedActions,
  };
}
