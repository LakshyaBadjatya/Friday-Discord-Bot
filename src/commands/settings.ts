/**
 * @module commands/settings
 * @description /settings — configure welcome, logging, and view current settings.
 */
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../utils/embeds.js';
import { setupWelcome } from '../services/welcome.js';
import { setupLogging } from '../services/auditLogger.js';
import { prisma } from '../database.js';

export async function handleSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'welcome': {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message') ?? undefined;

      await interaction.deferReply();
      await setupWelcome(interaction.guild!.id, channel.id, message);
      await interaction.editReply({
        embeds: [buildSuccessEmbed(`Welcome messages configured for <#${channel.id}>`)],
      });
      break;
    }
    case 'logging': {
      const channel = interaction.options.getChannel('channel', true);
      await interaction.deferReply();
      await setupLogging(interaction.guild!.id, channel.id);
      await interaction.editReply({
        embeds: [buildSuccessEmbed(`Audit logging enabled in <#${channel.id}>`)],
      });
      break;
    }
    case 'view': {
      const settings = await prisma.guildSettings.findUnique({ where: { guildId: interaction.guild!.id } });
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Server Settings')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Welcome Channel', value: settings?.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : 'Not set', inline: true },
          { name: 'Log Channel', value: settings?.logChannelId ? `<#${settings.logChannelId}>` : 'Not set', inline: true },
          { name: 'Ticket Category', value: settings?.ticketCategoryId ?? 'Auto', inline: true },
          { name: 'Welcome Message', value: settings?.welcomeMessage ?? 'Default' },
          { name: 'Goodbye Message', value: settings?.goodbyeMessage ?? 'Default' },
          { name: 'Auto Roles', value: settings?.autoRoleIds ? JSON.parse(settings.autoRoleIds).map((id: string) => `<@&${id}>`).join(', ') : 'None' },
        );
      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
