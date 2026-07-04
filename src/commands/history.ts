/**
 * @module commands/history
 * @description /history — view, export, and rollback command history.
 */
import { type ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildErrorEmbed } from '../utils/embeds.js';
import { prisma } from '../database.js';
import { executeUndo } from '../services/undoManager.js';

export async function handleHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'view': {
      const count = interaction.options.getInteger('count') ?? 10;
      const logs = await prisma.actionLog.findMany({
        where: { guildId: interaction.guild!.id },
        orderBy: { createdAt: 'desc' },
        take: Math.min(count, 25),
      });

      if (logs.length === 0) {
        await interaction.reply({ embeds: [buildErrorEmbed('No history found.')], ephemeral: true });
        return;
      }

      const lines = logs.map((log, i) => {
        const time = log.createdAt.toISOString().slice(0, 16).replace('T', ' ');
        const status = log.status === 'SUCCESS' ? '✅' : log.status === 'PARTIAL' ? '⚠️' : '❌';
        const tokens = log.tokensUsed ? ` (${log.tokensUsed} tokens)` : '';
        const duration = log.executionTimeMs ? ` [${log.executionTimeMs}ms]` : '';
        return `${status} \`${time}\` **${log.action}** by <@${log.userId}>${tokens}${duration}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📜 Command History (${logs.length})`)
        .setDescription(lines.join('\n'))
        .setColor(0x5865f2)
        .setFooter({ text: 'Use /history export to download full history' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }

    case 'export': {
      await interaction.deferReply({ ephemeral: true });
      const logs = await prisma.actionLog.findMany({
        where: { guildId: interaction.guild!.id },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      const exportData = logs.map((log) => ({
        timestamp: log.createdAt.toISOString(),
        user: log.userName,
        action: log.action,
        prompt: log.originalPrompt,
        status: log.status,
        model: log.modelUsed,
        tokens: log.tokensUsed,
        durationMs: log.executionTimeMs,
      }));

      const json = JSON.stringify(exportData, null, 2);
      const attachment = new AttachmentBuilder(Buffer.from(json), { name: `history-${interaction.guild!.id}.json` });

      await interaction.editReply({ content: '📥 Command history exported:', files: [attachment] });
      break;
    }

    case 'rollback': {
      const logId = interaction.options.getString('id', true);
      await interaction.deferReply();

      const log = await prisma.actionLog.findUnique({ where: { id: logId } });
      if (!log || !log.undoSnapshotId) {
        await interaction.editReply({ embeds: [buildErrorEmbed('No undo snapshot for this action.')] });
        return;
      }

      try {
        const { undone, errors } = await executeUndo(interaction.guild!, log.undoSnapshotId);
        const embed = new EmbedBuilder()
          .setTitle('↩️ Rollback Complete')
          .setColor(errors.length === 0 ? 0x57f287 : 0xfee75c)
          .addFields(
            { name: 'Actions Undone', value: String(undone), inline: true },
            { name: 'Errors', value: String(errors.length), inline: true },
          );
        if (errors.length > 0) {
          embed.addFields({ name: 'Error Details', value: errors.slice(0, 5).join('\n') });
        }
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ embeds: [buildErrorEmbed(`Rollback failed: ${error}`)] });
      }
      break;
    }
  }
}
