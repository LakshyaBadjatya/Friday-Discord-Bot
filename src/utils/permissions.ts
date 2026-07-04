/**
 * @module utils/permissions
 * @description Permission guard utilities for slash commands.
 */
import { type ChatInputCommandInteraction, PermissionsBitField, type GuildMember } from 'discord.js';
import { buildErrorEmbed } from './embeds.js';

/**
 * Check if the interaction user has Administrator or ManageGuild permission.
 * Replies with an error embed if not, and returns false.
 */
export async function requireManageServer(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const member = interaction.member as GuildMember;
  if (
    !member.permissions.has(PermissionsBitField.Flags.Administrator) &&
    !member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  ) {
    await interaction.reply({
      embeds: [buildErrorEmbed('You need **Administrator** or **Manage Server** permission to use this command.')],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

/**
 * Check if the interaction is in a guild.
 */
export async function requireGuild(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [buildErrorEmbed('This command can only be used in a server.')],
      ephemeral: true,
    });
    return false;
  }
  return true;
}
