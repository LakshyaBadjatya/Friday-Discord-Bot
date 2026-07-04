/**
 * @module commands/tickets
 * @description /tickets — ticket panel setup and management.
 */
import { type ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../utils/embeds.js';
import { createTicketPanel, handleTicketClose as closeTicket } from '../services/tickets.js';
import { prisma } from '../database.js';

export async function handleTickets(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'setup': {
      await interaction.deferReply();
      try {
        await createTicketPanel(interaction.guild!, interaction.channelId);
        await interaction.editReply({ embeds: [buildSuccessEmbed('Ticket panel created in this channel!')] });
      } catch (error) {
        await interaction.editReply({ embeds: [buildErrorEmbed(`Failed: ${error}`)] });
      }
      break;
    }
    case 'close': {
      const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
      if (!ticket) {
        await interaction.reply({ embeds: [buildErrorEmbed('This is not a ticket channel.')], ephemeral: true });
        return;
      }
      // Generate transcript
      const ch = interaction.channel as TextChannel;
      const messages = await ch.messages.fetch({ limit: 100 });
      const transcript = messages.reverse().map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`).join('\n');
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'CLOSED', closedBy: interaction.user.id, closedAt: new Date(), transcript },
      });
      await interaction.reply({ content: '🔒 Ticket closed. Channel will be deleted in 5 seconds.' });
      setTimeout(() => ch.delete().catch(() => {}), 5000);
      break;
    }
  }
}
