/**
 * @module commands/roles
 * @description /roles — create, delete, and list server roles.
 */
import {
  type ChatInputCommandInteraction, EmbedBuilder, PermissionsBitField,
} from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../utils/embeds.js';
import { prisma } from '../database.js';

export async function handleRoles(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'create': {
      const name = interaction.options.getString('name', true);
      const color = interaction.options.getString('color') ?? undefined;
      const hoist = interaction.options.getBoolean('hoist') ?? false;

      await interaction.deferReply();
      try {
        const role = await interaction.guild!.roles.create({
          name,
          color: color as any,
          hoist,
        });
        await prisma.actionLog.create({
          data: {
            guildId: interaction.guild!.id, userId: interaction.user.id,
            userName: interaction.user.tag, action: 'CREATE_ROLE',
            details: JSON.stringify({ name, color, hoist }),
          },
        });
        await interaction.editReply({ embeds: [buildSuccessEmbed(`Created role **${role.name}** (${role.hexColor})`)] });
      } catch (error) {
        await interaction.editReply({ embeds: [buildErrorEmbed(`Failed to create role: ${error}`)] });
      }
      break;
    }

    case 'delete': {
      const role = interaction.options.getRole('role', true);
      await interaction.deferReply();
      try {
        const roleName = role.name;
        await interaction.guild!.roles.delete(role.id);
        await prisma.actionLog.create({
          data: {
            guildId: interaction.guild!.id, userId: interaction.user.id,
            userName: interaction.user.tag, action: 'DELETE_ROLE',
            details: JSON.stringify({ name: roleName }),
          },
        });
        await interaction.editReply({ embeds: [buildSuccessEmbed(`Deleted role **${roleName}**`)] });
      } catch (error) {
        await interaction.editReply({ embeds: [buildErrorEmbed(`Failed to delete role: ${error}`)] });
      }
      break;
    }

    case 'list': {
      const roles = interaction.guild!.roles.cache
        .filter((r) => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map((r) => `${r.managed ? '🤖' : '🔹'} **${r.name}** — ${r.hexColor} — ${r.members.size} members`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Roles (${interaction.guild!.roles.cache.size - 1})`)
        .setDescription(roles || 'No roles found.')
        .setColor(0x5865f2);

      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
