/**
 * @module commands/undo
 * @description /undo — rollback the last AI execution.
 */
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildErrorEmbed } from '../utils/embeds.js';
import { executeUndo, getRecentSnapshots } from '../services/undoManager.js';

export async function handleUndo(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  await interaction.deferReply();

  const snapshots = await getRecentSnapshots(interaction.guild!.id, 1);
  if (snapshots.length === 0) {
    await interaction.editReply({ embeds: [buildErrorEmbed('No undo snapshots available.')] });
    return;
  }

  const snapshot = snapshots[0]!;

  try {
    const { undone, errors } = await executeUndo(interaction.guild!, snapshot.id);

    const embed = new EmbedBuilder()
      .setTitle('↩️ Undo Complete')
      .setDescription(`Rolled back: **${snapshot.description}**`)
      .setColor(errors.length === 0 ? 0x57f287 : 0xfee75c)
      .addFields(
        { name: 'Actions Undone', value: String(undone), inline: true },
        { name: 'Errors', value: String(errors.length), inline: true },
      )
      .setTimestamp();

    if (errors.length > 0) {
      embed.addFields({ name: 'Error Details', value: errors.slice(0, 5).join('\n') });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ embeds: [buildErrorEmbed(`Undo failed: ${error}`)] });
  }
}
