/**
 * @module commands/template
 * @description /template — apply a built-in server template.
 */
import {
  type ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ComponentType, ChannelType,
} from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildPlanEmbed, buildResultEmbed, buildErrorEmbed, buildInfoEmbed } from '../utils/embeds.js';
import { templates, type TemplateName } from '../templates/index.js';
import { executePlan } from '../services/executor.js';
import { config } from '../config.js';
import type { PlannedAction, ExecutionPlan, PipelineResult } from '../types.js';

export async function handleTemplate(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const name = interaction.options.getString('name', true) as TemplateName;
  const blueprint = templates[name];

  if (!blueprint) {
    await interaction.reply({ embeds: [buildErrorEmbed(`Template "${name}" not found.`)], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  // Convert blueprint to execution plan
  const actions: PlannedAction[] = [];
  let idx = 1;

  // Create roles
  for (const role of blueprint.roles) {
    actions.push({
      id: `action_${idx++}`,
      type: 'CREATE_ROLE',
      description: `Create role "${role.name}"`,
      params: { name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable, permissions: role.permissions },
      destructive: false,
    });
  }

  // Create categories and channels
  for (const cat of blueprint.categories) {
    actions.push({
      id: `action_${idx++}`,
      type: 'CREATE_CATEGORY',
      description: `Create category "${cat.name}"`,
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
        id: `action_${idx++}`,
        type: typeMap[ch.type] as any,
        description: `Create ${ch.type} channel "#${ch.name}" in "${cat.name}"`,
        params: { name: ch.name, category: cat.name, topic: ch.topic, nsfw: ch.nsfw, slowMode: ch.slowMode, userLimit: ch.userLimit },
        destructive: false,
      });
    }
  }

  const plan: ExecutionPlan = {
    summary: `Apply the "${blueprint.name}" template — ${actions.length} actions`,
    actions,
    warnings: ['This will create new roles and channels. Existing items will not be modified.'],
  };

  // Show plan and confirm
  const planEmbed = buildPlanEmbed(plan);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('plan_confirm').setLabel('✅ Apply Template').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('plan_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  const reply = await interaction.editReply({ embeds: [planEmbed], components: [row] });

  try {
    const confirmation = await reply.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: config.CONFIRMATION_TIMEOUT * 1000,
    });

    if (confirmation.customId === 'plan_cancel') {
      await confirmation.update({ content: '❌ Template application cancelled.', embeds: [], components: [] });
      return;
    }

    await confirmation.update({ content: '⚡ Applying template...', embeds: [planEmbed], components: [] });

    const execResult = await executePlan(interaction.guild!, plan, interaction.user.id, interaction.user.tag);
    const result: PipelineResult = {
      plan,
      review: { approved: true, issues: [], suggestions: [], riskLevel: 'low' },
      optimized: { plan, optimizations: [], estimatedApiCalls: 0, estimatedTimeMs: 0, groupedActions: [] },
      verification: { passed: true, expected: plan.actions.length, actual: execResult.results.filter(r=>r.success).length, discrepancies: [] },
      results: execResult.results,
      totalActions: plan.actions.length,
      successCount: execResult.results.filter(r=>r.success).length,
      failCount: execResult.results.filter(r=>!r.success).length,
      executionTimeMs: 0, tokensUsed: 0, modelUsed: 'system'
    };
    await interaction.editReply({ content: null, embeds: [buildResultEmbed(result)], components: [] });
  } catch {
    await interaction.editReply({ content: '⏰ Timed out.', embeds: [], components: [] });
  }
}
