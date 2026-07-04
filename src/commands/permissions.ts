/**
 * @module commands/permissions
 * @description /permissions — view role and channel permissions.
 */
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildErrorEmbed } from '../utils/embeds.js';

export async function handlePermissions(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');

  if (!role && !channel) {
    await interaction.reply({ embeds: [buildErrorEmbed('Please specify a role or channel.')], ephemeral: true });
    return;
  }

  if (role) {
    const perms = (role as any).permissions.toArray();
    const embed = new EmbedBuilder()
      .setTitle(`🔒 Permissions for ${role.name}`)
      .setDescription(perms.length > 0 ? perms.map((p: string) => `✅ ${p}`).join('\n') : 'No permissions.')
      .setColor((role as any).color || 0x5865f2);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (channel) {
    const guildChannel = interaction.guild!.channels.cache.get(channel.id);
    if (!guildChannel || !('permissionOverwrites' in guildChannel)) {
      await interaction.reply({ embeds: [buildErrorEmbed('Cannot inspect this channel.')], ephemeral: true });
      return;
    }
    const overwrites = (guildChannel as any).permissionOverwrites.cache;
    const lines: string[] = [];
    for (const [_, ow] of overwrites) {
      const target = ow.type === 0
        ? interaction.guild!.roles.cache.get(ow.id)?.name ?? ow.id
        : `<@${ow.id}>`;
      const allowed = ow.allow.toArray();
      const denied = ow.deny.toArray();
      lines.push(`**${target}**`);
      if (allowed.length) lines.push(`  ✅ ${allowed.join(', ')}`);
      if (denied.length) lines.push(`  ❌ ${denied.join(', ')}`);
    }
    const embed = new EmbedBuilder()
      .setTitle(`🔒 Permissions for #${channel.name}`)
      .setDescription(lines.join('\n') || 'No custom overwrites.')
      .setColor(0x5865f2);
    await interaction.reply({ embeds: [embed] });
  }
}
