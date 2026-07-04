/**
 * @module commands/backup
 * @description /backup — create and list server backups.
 */
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../utils/embeds.js';
import { createBackup, listBackups } from '../services/backup.js';

export async function handleBackup(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'create': {
      const name = interaction.options.getString('name') ?? undefined;
      await interaction.deferReply();
      try {
        const snapshot = await createBackup(interaction.guild!, interaction.user.id, name);
        const embed = new EmbedBuilder()
          .setTitle('💾 Backup Created')
          .setColor(0x57f287)
          .addFields(
            { name: 'Server', value: snapshot.guildName, inline: true },
            { name: 'Roles', value: String(snapshot.roles.length), inline: true },
            { name: 'Categories', value: String(snapshot.categories.length), inline: true },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ embeds: [buildErrorEmbed(`Failed: ${error}`)] });
      }
      break;
    }
    case 'list': {
      const backups = await listBackups(interaction.guild!.id);
      if (backups.length === 0) {
        await interaction.reply({ embeds: [buildErrorEmbed('No backups found.')], ephemeral: true });
        return;
      }
      const lines = backups.map((b, i) =>
        `\`${i + 1}.\` **${b.name}** — ${b.createdAt.toISOString().slice(0, 16)}\n   ID: \`${b.id}\``
      ).join('\n\n');
      const embed = new EmbedBuilder()
        .setTitle(`💾 Backups (${backups.length})`)
        .setDescription(lines)
        .setColor(0x5865f2)
        .setFooter({ text: 'Use /restore <id> to restore a backup' });
      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
