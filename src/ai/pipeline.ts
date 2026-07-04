/**
 * @module ai/pipeline
 * @description Orchestration pipeline: Planner → Reviewer → Optimizer → Executor → Verifier.
 */
import { Guild } from 'discord.js';
import { createLogger } from '../logger.js';
import { prisma } from '../database.js';
import { planActions } from './agents/planner.js';
import { reviewPlan } from './agents/reviewer.js';
import { optimizePlan } from './agents/optimizer.js';
import { verifyExecution } from './agents/verifier.js';
import { executePlan } from '../services/executor.js';
import { createUndoSnapshot } from '../services/undoManager.js';
import { createAutoBackup } from '../services/backup.js';
import { getServerContext } from '../utils/serverContext.js';
import type { PipelineResult, DryRunReport, ExecutionPlan } from '../types.js';

const log = createLogger('pipeline');

interface PipelineOptions {
  userMessage: string;
  guild: Guild;
  userId: string;
  userName: string;
  dryRun?: boolean;
  skipReview?: boolean;
  guildModel?: string;
  autoBackup?: boolean;
}

/**
 * Run the full multi-agent pipeline.
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult | DryRunReport> {
  const { userMessage, guild, userId, userName, dryRun, skipReview, guildModel, autoBackup } = options;
  const pipelineStart = Date.now();
  let totalTokens = 0;
  let modelUsed = 'unknown';

  const serverContext = getServerContext(guild);

  // ─── Step 1: Plan ──────────────────────────────────────────────────
  log.info({ guildId: guild.id, userId }, 'Pipeline: Planning');
  const { plan, tokensUsed: planTokens, model } = await planActions(userMessage, serverContext, guildModel);
  totalTokens += planTokens;
  modelUsed = model;

  if (plan.actions.length === 0) {
    const emptyResult: PipelineResult = {
      plan,
      review: { approved: false, issues: [], suggestions: [], riskLevel: 'low' },
      optimized: { plan, optimizations: [], estimatedApiCalls: 0, estimatedTimeMs: 0, groupedActions: [] },
      results: [],
      verification: { passed: true, expected: 0, actual: 0, discrepancies: [] },
      totalActions: 0, successCount: 0, failCount: 0,
      executionTimeMs: Date.now() - pipelineStart,
      tokensUsed: totalTokens, modelUsed,
    };
    return emptyResult;
  }

  // ─── Step 2: Review ────────────────────────────────────────────────
  let review = { approved: true, issues: [], suggestions: [], riskLevel: 'low' as const };
  if (!skipReview) {
    log.info('Pipeline: Reviewing');
    const reviewResult = await reviewPlan(plan, serverContext, guildModel);
    review = reviewResult.review as any;
    totalTokens += reviewResult.tokensUsed;
  }

  // ─── Step 3: Optimize ──────────────────────────────────────────────
  log.info('Pipeline: Optimizing');
  const { optimized, tokensUsed: optTokens } = await optimizePlan(plan, guildModel);
  totalTokens += optTokens;

  // ─── Dry Run: return report without executing ──────────────────────
  if (dryRun) {
    return {
      plan: optimized.plan,
      review,
      optimized,
      warnings: [...plan.warnings, ...review.suggestions],
    } satisfies DryRunReport;
  }

  // ─── Step 4: Auto-backup before destructive actions ────────────────
  const hasDestructive = optimized.plan.actions.some((a) => a.destructive);
  if (autoBackup && hasDestructive) {
    log.info('Pipeline: Creating auto-backup before destructive actions');
    await createAutoBackup(guild, userId);
  }

  // ─── Step 5: Create undo snapshot ──────────────────────────────────
  const undoSnapshotId = await createUndoSnapshot(guild, optimized.plan, userId);

  // ─── Step 6: Execute ───────────────────────────────────────────────
  log.info('Pipeline: Executing');
  const { results } = await executePlan(guild, optimized.plan, userId, userName);

  // ─── Step 7: Verify ────────────────────────────────────────────────
  log.info('Pipeline: Verifying');
  const verification = await verifyExecution(guild, optimized.plan.actions, results);

  const executionTimeMs = Date.now() - pipelineStart;

  // ─── Audit Log ─────────────────────────────────────────────────────
  await prisma.actionLog.create({
    data: {
      guildId: guild.id,
      userId,
      userName,
      action: 'PIPELINE_EXECUTION',
      originalPrompt: userMessage,
      executionPlan: JSON.stringify(optimized.plan),
      aiResponse: JSON.stringify({ review, optimizations: optimized.optimizations }),
      apiActions: JSON.stringify(results),
      details: JSON.stringify({ verification }),
      status: results.every((r) => r.success) ? 'SUCCESS' : 'PARTIAL',
      executionTimeMs,
      modelUsed,
      tokensUsed: totalTokens,
      undoSnapshotId,
    },
  });

  log.info({
    guildId: guild.id,
    success: results.filter((r) => r.success).length,
    fail: results.filter((r) => !r.success).length,
    executionTimeMs,
    tokensUsed: totalTokens,
  }, 'Pipeline complete');

  return {
    plan: optimized.plan,
    review,
    optimized,
    results,
    verification,
    totalActions: results.length,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
    executionTimeMs,
    tokensUsed: totalTokens,
    modelUsed,
    undoSnapshotId,
  };
}
