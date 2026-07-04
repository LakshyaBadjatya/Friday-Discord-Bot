/**
 * @module services/tickets
 * @description Ticket system — panel creation, ticket channels, transcripts, close/reopen.
 */
import {
  Guild, TextChannel, ChannelType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, PermissionsBitField, type ButtonInteraction,
  type GuildMember,
} from 'discord.js';
import { createLogger } from '../logger.js';
import { prisma } from '../database.js';

const log = createLogger('tickets');

/**
 * Create a ticket panel (embed + button) in the specified channel.
 */
export async function createTicketPanel(
  guild: Guild,
  channelId: string,
  title = 'Support Tickets',
  description = 'Click the button below to create a support ticket.',
): Promise<string> {
  const channel = guild.channels.cache.get(channelId) as TextChannel;
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${title}`)
    .setDescription(description)
    .setColor(0x5865f2)
    .setFooter({ text: 'Server Architect • Ticket System' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('Open Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📩'),
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  await prisma.ticketPanel.create({
    data: { guildId: guild.id, channelId, messageId: msg.id, title, description },
  });

  // Save ticket category to guild settings
  const settings = await prisma.guildSettings.upsert({
    where: { guildId: guild.id },
    create: { guildId: guild.id, ticketLogChannelId: channelId },
    update: {},
  });

  log.info({ guildId: guild.id, channelId }, 'Ticket panel created');
  return msg.id;
}

/**
 * Handle ticket creation from button click.
 */
export async function handleTicketCreate(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild!;
  const member = interaction.member as GuildMember;

  // Check if user already has an open ticket
  const existing = await prisma.ticket.findFirst({
    where: { guildId: guild.id, userId: member.id, status: 'OPEN' },
  });

  if (existing) {
    await interaction.reply({
      content: `You already have an open ticket: <#${existing.channelId}>`,
      ephemeral: true,
    });
    return;
  }

  // Find or create ticket category
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'tickets',
  );
  if (!category) {
    category = await guild.channels.create({ name: 'Tickets', type: ChannelType.GuildCategory });
  }

  // Create private ticket channel
  const ticketChannel = await guild.channels.create({
    name: `ticket-${member.user.username}`,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  // Save ticket
  await prisma.ticket.create({
    data: {
      guildId: guild.id,
      channelId: ticketChannel.id,
      userId: member.id,
      userName: member.user.tag,
    },
  });

  // Send welcome embed in ticket
  const embed = new EmbedBuilder()
    .setTitle('🎫 Support Ticket')
    .setDescription(`Welcome ${member}! Describe your issue and a staff member will assist you.`)
    .setColor(0x57f287)
    .setTimestamp();

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
  );

  await ticketChannel.send({ embeds: [embed], components: [closeRow] });

  await interaction.reply({
    content: `Ticket created: ${ticketChannel}`,
    ephemeral: true,
  });

  log.info({ guildId: guild.id, userId: member.id, channelId: ticketChannel.id }, 'Ticket created');
}

/**
 * Handle ticket close from button click.
 */
export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const ticket = await prisma.ticket.findUnique({ where: { channelId: channel.id } });

  if (!ticket) {
    await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
    return;
  }

  // Generate transcript
  const messages = await channel.messages.fetch({ limit: 100 });
  const transcript = messages
    .reverse()
    .map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`)
    .join('\n');

  // Update ticket
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: 'CLOSED',
      closedBy: interaction.user.id,
      closedAt: new Date(),
      transcript,
    },
  });

  // Log to ticket log channel
  const settings = await prisma.guildSettings.findUnique({ where: { guildId: interaction.guild!.id } });
  if (settings?.ticketLogChannelId) {
    const logChannel = interaction.guild!.channels.cache.get(settings.ticketLogChannelId) as TextChannel;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🎫 Ticket Closed')
        .addFields(
          { name: 'User', value: ticket.userName, inline: true },
          { name: 'Closed By', value: interaction.user.tag, inline: true },
          { name: 'Messages', value: String(messages.size), inline: true },
        )
        .setColor(0xed4245)
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }
  }

  await interaction.reply({ content: '🔒 Ticket closed. This channel will be deleted in 5 seconds.' });
  setTimeout(() => channel.delete().catch(() => {}), 5000);

  log.info({ guildId: interaction.guild!.id, channelId: channel.id }, 'Ticket closed');
}
