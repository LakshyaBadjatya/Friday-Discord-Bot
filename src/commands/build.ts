/**
 * @module commands/build
 * @description /build — AI-powered server building using the multi-agent pipeline.
 */
import {
  type ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ComponentType, EmbedBuilder,
} from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { checkAuthorization, isControlChannel, isFeatureEnabled } from '../utils/controlRoom.js';
import {
  buildPlanEmbed, buildResultEmbed, buildErrorEmbed,
  buildReviewEmbed, buildDryRunEmbed,
} from '../utils/embeds.js';
import { runPipeline } from '../ai/pipeline.js';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import type { PipelineResult, DryRunReport } from '../types.js';

const log = createLogger('cmd:build');

export async function handleBuild(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const prompt = interaction.options.getString('prompt', true);
  await interaction.deferReply();

  const guild = interaction.guild!;
  const userId = interaction.user.id;
  const userName = interaction.user.tag;

  // Check modes
  const dryRun = await isFeatureEnabled(guild.id, 'dryRunMode');
  const skipReview = !(await isFeatureEnabled(guild.id, 'aiReviewerEnabled'));
  const confirmationMode = await isFeatureEnabled(guild.id, 'confirmationMode');
  const autoBackup = await isFeatureEnabled(guild.id, 'autoBackupEnabled');

  // Run pipeline
  try {
    const pipelineResult = await runPipeline({
      userMessage: prompt,
      guild,
      userId,
      userName,
      dryRun,
      skipReview,
      autoBackup,
    });

    // ─── Dry Run Mode ──────────────────────────────────────────────
    if (dryRun) {
      const report = pipelineResult as DryRunReport;
      const embeds = [buildDryRunEmbed(report), buildPlanEmbed(report.plan)];
      if (report.review) embeds.push(buildReviewEmbed(report.review));
      await interaction.editReply({ embeds });
      return;
    }

    const result = pipelineResult as PipelineResult;

    if (result.plan.actions.length === 0) {
      await interaction.editReply({
        embeds: [buildErrorEmbed(
          result.plan.warnings.join('\n') || 'Could not generate a plan for that request.',
        )],
      });
      return;
    }

    // ─── Confirmation Mode ─────────────────────────────────────────
    if (confirmationMode) {
      const planEmbed = buildPlanEmbed(result.plan);
      const hasDestructive = result.plan.actions.some((a) => a.destructive);

      // Add review info to the plan embed
      const embeds = [planEmbed];
      if (result.review) {
        embeds.push(buildReviewEmbed(result.review));
      }

      // If review rejected the plan, warn but still allow
      if (result.review && !result.review.approved) {
        embeds.push(new EmbedBuilder()
          .setTitle('⚠️ Plan Rejected by AI Reviewer')
          .setDescription('The AI reviewer has concerns about this plan. Proceed with caution.')
          .setColor(0xfee75c));
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('plan_confirm')
          .setLabel(hasDestructive ? '⚠️ Confirm & Execute' : '✅ Execute')
          .setStyle(hasDestructive ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('plan_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
      );

      const reply = await interaction.editReply({ embeds, components: [row] });

      try {
        const confirmation = await reply.awaitMessageComponent({
          filter: (i) => i.user.id === userId,
          componentType: ComponentType.Button,
          time: config.CONFIRMATION_TIMEOUT * 1000,
        });

        if (confirmation.customId === 'plan_cancel') {
          await confirmation.update({ content: '❌ Plan cancelled.', embeds: [], components: [] });
          return;
        }

        await confirmation.update({ content: '⚡ Executing plan...', embeds, components: [] });

        // Execute the already-planned pipeline
        const execResult = await runPipeline({
          userMessage: prompt,
          guild,
          userId,
          userName,
          autoBackup,
          skipReview: true, // Already reviewed
        }) as PipelineResult;

        await interaction.editReply({
          content: null,
          embeds: [buildResultEmbed(execResult)],
          components: [],
        });

        log.info({
          guildId: guild.id,
          success: execResult.successCount,
          fail: execResult.failCount,
          tokens: execResult.tokensUsed,
        }, 'Build complete');
      } catch {
        await interaction.editReply({
          content: '⏰ Confirmation timed out. Plan cancelled.',
          embeds: [],
          components: [],
        });
      }
    } else {
      // No confirmation needed — just show results
      await interaction.editReply({ embeds: [buildResultEmbed(result)] });
      log.info({
        guildId: guild.id,
        success: result.successCount,
        fail: result.failCount,
      }, 'Build complete (no confirmation)');
    }
  } catch (error) {
    log.error({ error }, 'Pipeline failed');
    await interaction.editReply({
      embeds: [buildErrorEmbed(`Pipeline error: ${error instanceof Error ? error.message : 'Unknown'}`)],
    });
  }
}
