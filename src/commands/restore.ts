/**
 * @module commands/restore
 * @description /restore — restore server structure from a backup.
 */
import {
  type ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ComponentType,
} from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildPlanEmbed, buildResultEmbed, buildErrorEmbed } from '../utils/embeds.js';
import { getBackup } from '../services/backup.js';
import { executePlan } from '../services/executor.js';
import { config } from '../config.js';
import type { PlannedAction, ExecutionPlan, PipelineResult } from '../types.js';

export async function handleRestore(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const backupId = interaction.options.getString('id', true);
  await interaction.deferReply();

  const snapshot = await getBackup(backupId);
  if (!snapshot) {
    await interaction.editReply({ embeds: [buildErrorEmbed(`Backup \`${backupId}\` not found.`)] });
    return;
  }

  // Build plan from snapshot
  const actions: PlannedAction[] = [];
  let idx = 1;

  for (const role of snapshot.roles) {
    actions.push({
      id: `action_${idx++}`, type: 'CREATE_ROLE',
      description: `Restore role "${role.name}"`,
      params: { name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable },
      destructive: false,
    });
  }

  for (const cat of snapshot.categories) {
    actions.push({
      id: `action_${idx++}`, type: 'CREATE_CATEGORY',
      description: `Restore category "${cat.name}"`,
      params: { name: cat.name },
      destructive: false,
    });
    for (const ch of cat.channels) {
      const typeMap: Record<string, string> = {
        text: 'CREATE_TEXT_CHANNEL', voice: 'CREATE_VOICE_CHANNEL',
        forum: 'CREATE_FORUM_CHANNEL', announcement: 'CREATE_ANNOUNCEMENT_CHANNEL',
        stage: 'CREATE_STAGE_CHANNEL',
      };
      actions.push({
        id: `action_${idx++}`, type: typeMap[ch.type] as any,
        description: `Restore #${ch.name} in "${cat.name}"`,
        params: { name: ch.name, category: cat.name, topic: ch.topic, nsfw: ch.nsfw },
        destructive: false,
      });
    }
  }

  const plan: ExecutionPlan = {
    summary: `Restore from backup "${snapshot.guildName}" — ${actions.length} actions`,
    actions,
    warnings: ['Existing channels and roles will NOT be deleted. Duplicates may be created.'],
  };

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('plan_confirm').setLabel('✅ Restore').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('plan_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  const reply = await interaction.editReply({ embeds: [buildPlanEmbed(plan)], components: [row] });

  try {
    const confirmation = await reply.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: config.CONFIRMATION_TIMEOUT * 1000,
    });
    if (confirmation.customId === 'plan_cancel') {
      await confirmation.update({ content: '❌ Cancelled.', embeds: [], components: [] });
      return;
    }
    await confirmation.update({ content: '⚡ Restoring...', embeds: [], components: [] });
    const rawResult = await executePlan(interaction.guild!, plan, interaction.user.id, interaction.user.tag);
    const result: PipelineResult = {
      plan,
      review: { approved: true, issues: [], suggestions: [], riskLevel: 'low' },
      optimized: { plan, optimizations: [], estimatedApiCalls: 0, estimatedTimeMs: 0, groupedActions: [] },
      verification: { passed: true, expected: plan.actions.length, actual: rawResult.results.filter(r=>r.success).length, discrepancies: [] },
      results: rawResult.results,
      totalActions: plan.actions.length,
      successCount: rawResult.results.filter(r=>r.success).length,
      failCount: rawResult.results.filter(r=>!r.success).length,
      executionTimeMs: 0, tokensUsed: 0, modelUsed: 'system'
    };
    await interaction.editReply({ content: null, embeds: [buildResultEmbed(result)], components: [] });
  } catch {
    await interaction.editReply({ content: '⏰ Timed out.', embeds: [], components: [] });
  }
}
