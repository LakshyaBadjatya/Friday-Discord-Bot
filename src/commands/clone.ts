/**
 * @module commands/clone
 * @description /clone — clone a channel or category with its structure.
 */
import {
  type ChatInputCommandInteraction, ChannelType, type GuildChannel,
} from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../utils/embeds.js';
import { prisma } from '../database.js';

export async function handleClone(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const source = interaction.options.getChannel('source', true);
  const newName = interaction.options.getString('name');

  await interaction.deferReply();

  try {
    const guild = interaction.guild!;
    const srcChannel = guild.channels.cache.get(source.id) as GuildChannel;

    if (!srcChannel) {
      await interaction.editReply({ embeds: [buildErrorEmbed('Channel not found.')] });
      return;
    }

    if (srcChannel.type === ChannelType.GuildCategory) {
      // Clone entire category with children
      const newCat = await guild.channels.create({
        name: newName ?? `${srcChannel.name}-copy`,
        type: ChannelType.GuildCategory,
        position: srcChannel.position + 1,
      });

      const children = guild.channels.cache
        .filter((c) => 'parentId' in c && c.parentId === srcChannel.id)
        .sort((a, b) => (a as any).position - (b as any).position);

      for (const child of children.values()) {
        await guild.channels.create({
          name: child.name,
          type: child.type as any,
          parent: newCat.id,
          topic: 'topic' in child ? (child as any).topic : undefined,
        });
        await new Promise((r) => setTimeout(r, 300)); // Rate limit buffer
      }

      await prisma.actionLog.create({
        data: {
          guildId: guild.id, userId: interaction.user.id,
          userName: interaction.user.tag, action: 'CLONE_CATEGORY',
          details: JSON.stringify({ source: srcChannel.name, clone: newCat.name, children: children.size }),
        },
      });

      await interaction.editReply({
        embeds: [buildSuccessEmbed(`Cloned category **${srcChannel.name}** → **${newCat.name}** with ${children.size} channels`)],
      });
    } else {
      // Clone single channel
      const cloned = await (srcChannel as any).clone({ name: newName ?? `${srcChannel.name}-copy` });

      await prisma.actionLog.create({
        data: {
          guildId: guild.id, userId: interaction.user.id,
          userName: interaction.user.tag, action: 'CLONE_CHANNEL',
          details: JSON.stringify({ source: srcChannel.name, clone: cloned.name }),
        },
      });

      await interaction.editReply({
        embeds: [buildSuccessEmbed(`Cloned channel **#${srcChannel.name}** → **#${cloned.name}**`)],
      });
    }
  } catch (error) {
    await interaction.editReply({ embeds: [buildErrorEmbed(`Failed: ${error}`)] });
  }
}
