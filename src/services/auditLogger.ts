/**
 * @module services/auditLogger
 * @description Audit logging — tracks server events and sends them to a log channel.
 */
import {
  Guild, GuildMember, EmbedBuilder, TextChannel, Message,
  Role, GuildChannel, AuditLogEvent,
} from 'discord.js';
import { createLogger } from '../logger.js';
import { prisma } from '../database.js';

const log = createLogger('audit-logger');

/** Get the log channel for a guild. */
async function getLogChannel(guild: Guild): Promise<TextChannel | null> {
  const settings = await prisma.guildSettings.findUnique({ where: { guildId: guild.id } });
  if (!settings?.logChannelId) return null;
  return guild.channels.cache.get(settings.logChannelId) as TextChannel ?? null;
}

/** Configure logging channel. */
export async function setupLogging(guildId: string, channelId: string) {
  await prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId, logChannelId: channelId },
    update: { logChannelId: channelId },
  });
  log.info({ guildId, channelId }, 'Logging configured');
}

/** Log member join. */
export async function logMemberJoin(member: GuildMember) {
  const channel = await getLogChannel(member.guild);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('📥 Member Joined')
    .setDescription(`${member.user.tag} (${member.id})`)
    .setThumbnail(member.user.displayAvatarURL())
    .setColor(0x57f287)
    .addFields({ name: 'Account Created', value: member.user.createdAt.toISOString().slice(0, 10) })
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

/** Log member leave. */
export async function logMemberLeave(member: GuildMember) {
  const channel = await getLogChannel(member.guild);
  if (!channel) return;
  const roles = member.roles.cache.filter((r) => r.name !== '@everyone').map((r) => r.name).join(', ') || 'None';
  const embed = new EmbedBuilder()
    .setTitle('📤 Member Left')
    .setDescription(`${member.user.tag} (${member.id})`)
    .setColor(0xed4245)
    .addFields({ name: 'Roles', value: roles })
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

/** Log message delete. */
export async function logMessageDelete(message: Message) {
  if (message.author?.bot || !message.guild) return;
  const channel = await getLogChannel(message.guild);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Message Deleted')
    .setDescription(message.content?.slice(0, 1024) || '[No text content]')
    .setColor(0xe67e22)
    .addFields(
      { name: 'Author', value: message.author?.tag ?? 'Unknown', inline: true },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
    )
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

/** Log message edit. */
export async function logMessageEdit(oldMessage: Message, newMessage: Message) {
  if (oldMessage.author?.bot || !oldMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;
  const channel = await getLogChannel(oldMessage.guild);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('✏️ Message Edited')
    .setColor(0xf1c40f)
    .addFields(
      { name: 'Before', value: oldMessage.content?.slice(0, 1024) || '[Empty]' },
      { name: 'After', value: newMessage.content?.slice(0, 1024) || '[Empty]' },
      { name: 'Author', value: oldMessage.author?.tag ?? 'Unknown', inline: true },
      { name: 'Channel', value: `<#${oldMessage.channelId}>`, inline: true },
    )
    .setURL(newMessage.url)
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

/** Log role changes. */
export async function logRoleCreate(role: Role) {
  const channel = await getLogChannel(role.guild);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('🔵 Role Created')
    .setDescription(`**${role.name}** (${role.id})`)
    .setColor(role.color || 0x99aab5)
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

export async function logRoleDelete(role: Role) {
  const channel = await getLogChannel(role.guild);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('🔴 Role Deleted')
    .setDescription(`**${role.name}** (${role.id})`)
    .setColor(0xed4245)
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

/** Log channel changes. */
export async function logChannelCreate(ch: GuildChannel) {
  const channel = await getLogChannel(ch.guild);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('📁 Channel Created')
    .setDescription(`**#${ch.name}** (${ch.type})`)
    .setColor(0x57f287)
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

export async function logChannelDelete(ch: GuildChannel) {
  const channel = await getLogChannel(ch.guild);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('📁 Channel Deleted')
    .setDescription(`**#${ch.name}** (${ch.type})`)
    .setColor(0xed4245)
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}
