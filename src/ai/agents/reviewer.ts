/**
 * @module ai/agents/reviewer
 * @description Reviewer agent — checks plans for invalid, dangerous, or impossible actions.
 */
import { createLogger } from '../../logger.js';
import { agentComplete } from '../providers/registry.js';
import { ReviewResultSchema, type ExecutionPlan, type ReviewResult } from '../../types.js';

const log = createLogger('agent:reviewer');

const SYSTEM_PROMPT = `You are the Reviewer Agent. Inspect a Discord server action plan for issues.

Respond ONLY with JSON:
{
  "approved": boolean,
  "issues": [{ "actionId": string, "severity": "warning"|"error"|"critical", "message": string, "suggestion"?: string }],
  "suggestions": string[],
  "riskLevel": "low"|"medium"|"high"|"critical"
}

Check for:
- Invalid action types or params
- Dangerous operations (mass delete, removing all roles)
- Missing permissions the bot would need
- Impossible Discord requests (invalid channel names, >500 channels, etc.)
- Duplicate operations (creating same channel twice)
- Ordering issues (channel before its category)
- Security risks (granting Administrator to new roles)

Risk levels:
- low: only creates, no destructive actions
- medium: edits existing resources
- high: deletes resources or changes permissions
- critical: mass deletions, admin permission grants

If plan is safe, approved=true with empty issues.`;

export async function reviewPlan(
  plan: ExecutionPlan,
  serverContext?: string,
  guildModel?: string,
): Promise<{ review: ReviewResult; tokensUsed: number }> {
  log.info({ actionCount: plan.actions.length }, 'Reviewing plan');

  try {
    const result = await agentComplete('reviewer', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(serverContext ? [{ role: 'system' as const, content: `Server state:\n${serverContext}` }] : []),
        { role: 'user', content: `Review this plan:\n${JSON.stringify(plan, null, 2)}` },
      ],
      temperature: 0.2,
      maxTokens: 2048,
      jsonMode: true,
    }, guildModel);

    const validated = ReviewResultSchema.parse(JSON.parse(result.content));
    log.info({ approved: validated.approved, riskLevel: validated.riskLevel, issues: validated.issues.length }, 'Review complete');
    return { review: validated, tokensUsed: result.tokensUsed };
  } catch (error) {
    log.error({ error }, 'Review failed');
    // Fail-open: approve with a warning if reviewer fails
    return {
      review: {
        approved: true,
        issues: [],
        suggestions: ['Reviewer agent unavailable — plan was not checked.'],
        riskLevel: 'medium',
      },
      tokensUsed: 0,
    };
  }
}
