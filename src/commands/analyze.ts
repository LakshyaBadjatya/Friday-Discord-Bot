/**
 * @module commands/analyze
 * @description /analyze — run smart server analysis.
 */
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { analyzeServer, findDeadChannels, findUnusedRoles } from '../modules/serverAnalyzer.js';

export async function handleAnalyze(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'health': {
      await interaction.deferReply();
      const report = await analyzeServer(interaction.guild!);

      const scoreEmoji = report.score >= 80 ? '🟢' : report.score >= 60 ? '🟡' : '🔴';
      const categoryLines = report.categories.map((c) => {
        const emoji = c.score >= 80 ? '🟢' : c.score >= 60 ? '🟡' : '🔴';
        const issues = c.issues.length > 0 ? `\n${c.issues.map((i) => `  ⚠️ ${i}`).join('\n')}` : '';
        return `${emoji} **${c.name}**: ${c.score}/100${issues}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`${scoreEmoji} Server Health Score: ${report.score}/100`)
        .setDescription(categoryLines)
        .setColor(report.score >= 80 ? 0x57f287 : report.score >= 60 ? 0xfee75c : 0xed4245)
        .addFields({ name: '💡 Suggestions', value: report.suggestions.slice(0, 5).join('\n') || 'None' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case 'dead_channels': {
      await interaction.deferReply();
      const days = interaction.options.getInteger('days') ?? 30;
      const dead = await findDeadChannels(interaction.guild!, days);

      const embed = new EmbedBuilder()
        .setTitle(`💀 Dead Channels (${days}+ days inactive)`)
        .setDescription(dead.length > 0 ? dead.map((c) => `#${c}`).join('\n') : 'No dead channels found! 🎉')
        .setColor(dead.length > 0 ? 0xfee75c : 0x57f287);

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case 'unused_roles': {
      const unused = findUnusedRoles(interaction.guild!);

      const embed = new EmbedBuilder()
        .setTitle(`👻 Unused Roles (0 members)`)
        .setDescription(unused.length > 0 ? unused.map((r) => `🔹 ${r}`).join('\n') : 'No unused roles! 🎉')
        .setColor(unused.length > 0 ? 0xfee75c : 0x57f287);

      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
