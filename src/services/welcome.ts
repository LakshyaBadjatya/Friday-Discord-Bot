/**
 * @module services/welcome
 * @description Welcome & goodbye message system with auto-role assignment.
 */
import { Guild, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { createLogger } from '../logger.js';
import { prisma } from '../database.js';

const log = createLogger('welcome');

/** Configure welcome settings for a guild. */
export async function setupWelcome(
  guildId: string,
  channelId: string,
  welcomeMessage?: string,
  goodbyeMessage?: string,
  autoRoleIds?: string[],
) {
  await prisma.guildSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      welcomeChannelId: channelId,
      welcomeMessage: welcomeMessage ?? 'Welcome to the server, {user}! 🎉',
      goodbyeMessage: goodbyeMessage ?? 'Goodbye, {user}. We\'ll miss you! 👋',
      autoRoleIds: autoRoleIds ? JSON.stringify(autoRoleIds) : null,
    },
    update: {
      welcomeChannelId: channelId,
      ...(welcomeMessage && { welcomeMessage }),
      ...(goodbyeMessage && { goodbyeMessage }),
      ...(autoRoleIds && { autoRoleIds: JSON.stringify(autoRoleIds) }),
    },
  });
  log.info({ guildId, channelId }, 'Welcome system configured');
}

/** Send welcome message and assign auto-roles. */
export async function handleMemberJoin(member: GuildMember) {
  const settings = await prisma.guildSettings.findUnique({
    where: { guildId: member.guild.id },
  });
  if (!settings?.welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(settings.welcomeChannelId) as TextChannel;
  if (!channel) return;

  const message = (settings.welcomeMessage ?? 'Welcome, {user}!')
    .replace(/{user}/g, `${member}`)
    .replace(/{server}/g, member.guild.name)
    .replace(/{memberCount}/g, String(member.guild.memberCount));

  const embed = new EmbedBuilder()
    .setTitle('👋 Welcome!')
    .setDescription(message)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setColor(0x57f287)
    .setTimestamp();

  await channel.send({ embeds: [embed] });

  // Auto-role assignment
  if (settings.autoRoleIds) {
    const roleIds = JSON.parse(settings.autoRoleIds) as string[];
    for (const roleId of roleIds) {
      try {
        await member.roles.add(roleId);
      } catch (e) {
        log.warn({ roleId, memberId: member.id }, 'Failed to assign auto-role');
      }
    }
  }

  log.info({ guildId: member.guild.id, userId: member.id }, 'Welcome message sent');
}

/** Send goodbye message. */
export async function handleMemberLeave(member: GuildMember) {
  const settings = await prisma.guildSettings.findUnique({
    where: { guildId: member.guild.id },
  });
  if (!settings?.welcomeChannelId || !settings.goodbyeMessage) return;

  const channel = member.guild.channels.cache.get(settings.welcomeChannelId) as TextChannel;
  if (!channel) return;

  const message = settings.goodbyeMessage
    .replace(/{user}/g, member.user.tag)
    .replace(/{server}/g, member.guild.name)
    .replace(/{memberCount}/g, String(member.guild.memberCount));

  const embed = new EmbedBuilder()
    .setTitle('👋 Goodbye')
    .setDescription(message)
    .setColor(0xed4245)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}
