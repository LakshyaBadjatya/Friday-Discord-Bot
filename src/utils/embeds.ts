/**
 * @module utils/embeds
 * @description Utility functions for building consistent Discord embeds.
 */
import { EmbedBuilder } from 'discord.js';
import type {
  ExecutionPlan, PipelineResult, DryRunReport, ReviewResult,
  OptimizedPlan, VerificationResult, PlannedAction,
} from '../types.js';

const BRAND_COLOR = 0x5865f2;
const SUCCESS_COLOR = 0x57f287;
const ERROR_COLOR = 0xed4245;
const WARNING_COLOR = 0xfee75c;
const INFO_COLOR = 0x3498db;

/** Build an embed showing the execution plan for user confirmation. */
export function buildPlanEmbed(plan: ExecutionPlan): EmbedBuilder {
  const destructiveCount = plan.actions.filter((a) => a.destructive).length;

  const actionList = plan.actions
    .map((a, i) => {
      const icon = a.destructive ? '⚠️' : '✅';
      return `${icon} \`${i + 1}.\` ${a.description}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📋 Execution Plan')
    .setDescription(plan.summary)
    .setColor(destructiveCount > 0 ? WARNING_COLOR : BRAND_COLOR)
    .addFields({ name: `Actions (${plan.actions.length})`, value: actionList || 'No actions.' });

  if (plan.warnings.length > 0) {
    embed.addFields({
      name: '⚠️ Warnings',
      value: plan.warnings.map((w) => `• ${w}`).join('\n'),
    });
  }

  if (destructiveCount > 0) {
    embed.setFooter({ text: `⚠️ ${destructiveCount} destructive action(s) — requires confirmation` });
  }

  return embed;
}

/** Build an embed showing the AI review results. */
export function buildReviewEmbed(review: ReviewResult): EmbedBuilder {
  const riskColors: Record<string, number> = {
    low: SUCCESS_COLOR, medium: WARNING_COLOR, high: 0xff9800, critical: ERROR_COLOR,
  };
  const riskEmoji: Record<string, string> = {
    low: '🟢', medium: '🟡', high: '🟠', critical: '🔴',
  };

  const embed = new EmbedBuilder()
    .setTitle(`🔍 AI Review — ${review.approved ? 'Approved' : 'Rejected'}`)
    .setColor(riskColors[review.riskLevel] ?? BRAND_COLOR)
    .addFields(
      { name: 'Risk Level', value: `${riskEmoji[review.riskLevel]} ${review.riskLevel.toUpperCase()}`, inline: true },
      { name: 'Status', value: review.approved ? '✅ Approved' : '❌ Rejected', inline: true },
    );

  if (review.issues.length > 0) {
    const issueLines = review.issues.slice(0, 5).map((iss) => {
      const icon = iss.severity === 'critical' ? '🔴' : iss.severity === 'error' ? '🟠' : '🟡';
      return `${icon} ${iss.message}${iss.suggestion ? `\n  → ${iss.suggestion}` : ''}`;
    }).join('\n');
    embed.addFields({ name: `Issues (${review.issues.length})`, value: issueLines });
  }

  if (review.suggestions.length > 0) {
    embed.addFields({ name: '💡 Suggestions', value: review.suggestions.slice(0, 5).join('\n') });
  }

  return embed;
}

/** Build an embed showing optimization info. */
export function buildOptimizationEmbed(optimized: OptimizedPlan): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('⚡ Optimization Report')
    .setColor(INFO_COLOR)
    .addFields(
      { name: 'API Calls', value: String(optimized.estimatedApiCalls), inline: true },
      { name: 'Est. Time', value: `${Math.round(optimized.estimatedTimeMs / 1000)}s`, inline: true },
      { name: 'Groups', value: String(optimized.groupedActions.length), inline: true },
    );

  if (optimized.optimizations.length > 0) {
    embed.addFields({ name: 'Optimizations', value: optimized.optimizations.join('\n') });
  }

  return embed;
}

/** Build an embed showing pipeline execution results. */
export function buildResultEmbed(result: PipelineResult): EmbedBuilder {
  const color = result.failCount === 0 ? SUCCESS_COLOR : result.successCount === 0 ? ERROR_COLOR : WARNING_COLOR;

  const resultLines = result.results
    .map((r) => {
      const icon = r.success ? '✅' : '❌';
      return `${icon} ${r.message}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('⚡ Execution Results')
    .setColor(color)
    .setDescription(resultLines || 'No actions executed.')
    .addFields(
      { name: 'Total', value: String(result.totalActions), inline: true },
      { name: 'Success', value: String(result.successCount), inline: true },
      { name: 'Failed', value: String(result.failCount), inline: true },
      { name: 'Duration', value: `${(result.executionTimeMs / 1000).toFixed(1)}s`, inline: true },
      { name: 'Tokens', value: String(result.tokensUsed), inline: true },
      { name: 'Model', value: `\`${result.modelUsed}\``, inline: true },
    );

  // Verification status
  if (result.verification) {
    const vIcon = result.verification.passed ? '✅' : '⚠️';
    embed.addFields({
      name: `${vIcon} Verification`,
      value: result.verification.passed
        ? 'All actions verified successfully'
        : `${result.verification.discrepancies.length} discrepancy(ies) found`,
    });
  }

  if (result.undoSnapshotId) {
    embed.setFooter({ text: `Undo available • /undo to rollback` });
  }

  embed.setTimestamp();
  return embed;
}

/** Build a dry-run report embed. */
export function buildDryRunEmbed(report: DryRunReport): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🧪 Dry Run Report (No Changes Made)')
    .setColor(INFO_COLOR)
    .setDescription(report.plan.summary)
    .addFields(
      { name: 'Actions', value: String(report.plan.actions.length), inline: true },
      { name: 'Risk Level', value: report.review.riskLevel.toUpperCase(), inline: true },
      { name: 'API Calls', value: String(report.optimized.estimatedApiCalls), inline: true },
    );
}

/** Build a generic info embed. */
export function buildInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(BRAND_COLOR);
}

/** Build an error embed. */
export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setTitle('❌ Error').setDescription(message).setColor(ERROR_COLOR);
}

/** Build a success embed. */
export function buildSuccessEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setTitle('✅ Success').setDescription(message).setColor(SUCCESS_COLOR);
}
