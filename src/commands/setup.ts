/**
 * @module commands/setup
 * @description /setup — AI Control Room configuration wizard.
 * Only users with Administrator permission may use this.
 */
import {
  type ChatInputCommandInteraction, PermissionsBitField, EmbedBuilder,
  type GuildMember,
} from 'discord.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../utils/embeds.js';
import { prisma } from '../database.js';
import { createLogger } from '../logger.js';

const log = createLogger('cmd:setup');

export async function handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [buildErrorEmbed('This command can only be used in a server.')], ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({
      embeds: [buildErrorEmbed('Only **Administrators** can configure the AI Control Room.')],
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'channels': {
      const controlChannel = interaction.options.getChannel('control');
      const logChannel = interaction.options.getChannel('log');
      const errorChannel = interaction.options.getChannel('errors');
      const notifyChannel = interaction.options.getChannel('notifications');

      await interaction.deferReply({ ephemeral: true });

      await prisma.guildSettings.upsert({
        where: { guildId: interaction.guild.id },
        create: {
          guildId: interaction.guild.id,
          aiControlChannelId: controlChannel?.id ?? undefined,
          aiLogChannelId: logChannel?.id ?? undefined,
          aiErrorLogChannelId: errorChannel?.id ?? undefined,
          aiNotifyChannelId: notifyChannel?.id ?? undefined,
        },
        update: {
          ...(controlChannel && { aiControlChannelId: controlChannel.id }),
          ...(logChannel && { aiLogChannelId: logChannel.id }),
          ...(errorChannel && { aiErrorLogChannelId: errorChannel.id }),
          ...(notifyChannel && { aiNotifyChannelId: notifyChannel.id }),
        },
      });

      const embed = new EmbedBuilder()
        .setTitle('🎛️ AI Control Room — Channels Configured')
        .setColor(0x57f287)
        .addFields(
          { name: '🤖 Control Channel', value: controlChannel ? `<#${controlChannel.id}>` : 'Not set', inline: true },
          { name: '📋 Log Channel', value: logChannel ? `<#${logChannel.id}>` : 'Not set', inline: true },
          { name: '❌ Error Channel', value: errorChannel ? `<#${errorChannel.id}>` : 'Not set', inline: true },
          { name: '🔔 Notifications', value: notifyChannel ? `<#${notifyChannel.id}>` : 'Not set', inline: true },
        )
        .setFooter({ text: 'AI commands will only be processed in the Control Channel' });

      await interaction.editReply({ embeds: [embed] });
      log.info({ guildId: interaction.guild.id }, 'Control room channels configured');
      break;
    }

    case 'access': {
      const rolesStr = interaction.options.getString('roles');
      const usersStr = interaction.options.getString('users');

      await interaction.deferReply({ ephemeral: true });

      const roleIds = rolesStr
        ? rolesStr.match(/\d{17,}/g) ?? []
        : undefined;
      const userIds = usersStr
        ? usersStr.match(/\d{17,}/g) ?? []
        : undefined;

      await prisma.guildSettings.upsert({
        where: { guildId: interaction.guild.id },
        create: {
          guildId: interaction.guild.id,
          ...(roleIds && { allowedRoleIds: JSON.stringify(roleIds) }),
          ...(userIds && { allowedUserIds: JSON.stringify(userIds) }),
        },
        update: {
          ...(roleIds && { allowedRoleIds: JSON.stringify(roleIds) }),
          ...(userIds && { allowedUserIds: JSON.stringify(userIds) }),
        },
      });

      await interaction.editReply({
        embeds: [buildSuccessEmbed(
          `Access updated.\n` +
          `Allowed Roles: ${roleIds?.map((id) => `<@&${id}>`).join(', ') || 'None specified'}\n` +
          `Allowed Users: ${userIds?.map((id) => `<@${id}>`).join(', ') || 'None specified'}`,
        )],
      });
      break;
    }

    case 'modes': {
      const confirmation = interaction.options.getBoolean('confirmation');
      const dryRun = interaction.options.getBoolean('dry_run');
      const reviewer = interaction.options.getBoolean('reviewer');
      const autoBackup = interaction.options.getBoolean('auto_backup');

      await interaction.deferReply({ ephemeral: true });

      await prisma.guildSettings.upsert({
        where: { guildId: interaction.guild.id },
        create: {
          guildId: interaction.guild.id,
          ...(confirmation !== null && { confirmationMode: confirmation }),
          ...(dryRun !== null && { dryRunMode: dryRun }),
          ...(reviewer !== null && { aiReviewerEnabled: reviewer }),
          ...(autoBackup !== null && { autoBackupEnabled: autoBackup }),
        },
        update: {
          ...(confirmation !== null && { confirmationMode: confirmation }),
          ...(dryRun !== null && { dryRunMode: dryRun }),
          ...(reviewer !== null && { aiReviewerEnabled: reviewer }),
          ...(autoBackup !== null && { autoBackupEnabled: autoBackup }),
        },
      });

      const settings = await prisma.guildSettings.findUnique({ where: { guildId: interaction.guild.id } });
      const embed = new EmbedBuilder()
        .setTitle('🎛️ AI Modes Updated')
        .setColor(0x57f287)
        .addFields(
          { name: '✅ Confirmation Mode', value: settings?.confirmationMode ? 'Enabled' : 'Disabled', inline: true },
          { name: '🧪 Dry Run Mode', value: settings?.dryRunMode ? 'Enabled' : 'Disabled', inline: true },
          { name: '🔍 AI Reviewer', value: settings?.aiReviewerEnabled ? 'Enabled' : 'Disabled', inline: true },
          { name: '💾 Auto Backup', value: settings?.autoBackupEnabled ? 'Enabled' : 'Disabled', inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case 'ai': {
      const model = interaction.options.getString('model');
      const language = interaction.options.getString('language');

      await interaction.deferReply({ ephemeral: true });

      await prisma.guildSettings.upsert({
        where: { guildId: interaction.guild.id },
        create: {
          guildId: interaction.guild.id,
          ...(model && { aiModel: model }),
          ...(language && { serverLanguage: language }),
        },
        update: {
          ...(model && { aiModel: model }),
          ...(language && { serverLanguage: language }),
        },
      });

      await interaction.editReply({
        embeds: [buildSuccessEmbed(
          `AI settings updated.\n` +
          `Model: \`${model || 'Default'}\`\n` +
          `Language: \`${language || 'en'}\``,
        )],
      });
      break;
    }

    case 'view': {
      const settings = await prisma.guildSettings.findUnique({ where: { guildId: interaction.guild.id } });

      const embed = new EmbedBuilder()
        .setTitle('🎛️ AI Control Room — Current Configuration')
        .setColor(0x5865f2)
        .addFields(
          { name: '🤖 Control Channel', value: settings?.aiControlChannelId ? `<#${settings.aiControlChannelId}>` : '❌ Not set', inline: true },
          { name: '📋 Log Channel', value: settings?.aiLogChannelId ? `<#${settings.aiLogChannelId}>` : '❌ Not set', inline: true },
          { name: '❌ Error Channel', value: settings?.aiErrorLogChannelId ? `<#${settings.aiErrorLogChannelId}>` : '❌ Not set', inline: true },
          { name: '🔔 Notifications', value: settings?.aiNotifyChannelId ? `<#${settings.aiNotifyChannelId}>` : '❌ Not set', inline: true },
          { name: '✅ Confirmation', value: settings?.confirmationMode ? 'On' : 'Off', inline: true },
          { name: '🧪 Dry Run', value: settings?.dryRunMode ? 'On' : 'Off', inline: true },
          { name: '🔍 AI Reviewer', value: settings?.aiReviewerEnabled ? 'On' : 'Off', inline: true },
          { name: '💾 Auto Backup', value: settings?.autoBackupEnabled ? 'On' : 'Off', inline: true },
          { name: '🧠 AI Model', value: `\`${settings?.aiModel || 'Default'}\``, inline: true },
          { name: '🌐 Language', value: settings?.serverLanguage || 'en', inline: true },
          { name: '👥 Allowed Roles', value: settings?.allowedRoleIds ? JSON.parse(settings.allowedRoleIds).map((id: string) => `<@&${id}>`).join(', ') : 'None' },
          { name: '👤 Allowed Users', value: settings?.allowedUserIds ? JSON.parse(settings.allowedUserIds).map((id: string) => `<@${id}>`).join(', ') : 'None' },
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
  }
}
