/**
 * @module commands/channels
 * @description /channels — create, delete, and list server channels.
 */
import {
  type ChatInputCommandInteraction, ChannelType, EmbedBuilder,
} from 'discord.js';
import { requireManageServer, requireGuild } from '../utils/permissions.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../utils/embeds.js';
import { prisma } from '../database.js';

const typeMap: Record<string, ChannelType> = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  forum: ChannelType.GuildForum,
  announcement: ChannelType.GuildAnnouncement,
  stage: ChannelType.GuildStageVoice,
  category: ChannelType.GuildCategory,
};

export async function handleChannels(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'create': {
      const name = interaction.options.getString('name', true);
      const type = interaction.options.getString('type', true);
      const categoryName = interaction.options.getString('category');

      await interaction.deferReply();
      try {
        let parent: string | undefined;
        if (categoryName) {
          const cat = interaction.guild!.channels.cache.find(
            (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === categoryName.toLowerCase(),
          );
          if (cat) parent = cat.id;
        }

        const channel = await interaction.guild!.channels.create({
          name,
          type: (typeMap[type] ?? ChannelType.GuildText) as any,
          parent,
        });

        await prisma.actionLog.create({
          data: {
            guildId: interaction.guild!.id, userId: interaction.user.id,
            userName: interaction.user.tag, action: `CREATE_${type.toUpperCase()}_CHANNEL`,
            details: JSON.stringify({ name, type, category: categoryName }),
          },
        });

        await interaction.editReply({
          embeds: [buildSuccessEmbed(`Created ${type} channel **${channel.name}**`)],
        });
      } catch (error) {
        await interaction.editReply({ embeds: [buildErrorEmbed(`Failed: ${error}`)] });
      }
      break;
    }

    case 'delete': {
      const channel = interaction.options.getChannel('channel', true);
      await interaction.deferReply();
      try {
        const chName = channel.name;
        await interaction.guild!.channels.delete(channel.id);
        await prisma.actionLog.create({
          data: {
            guildId: interaction.guild!.id, userId: interaction.user.id,
            userName: interaction.user.tag, action: 'DELETE_CHANNEL',
            details: JSON.stringify({ name: chName }),
          },
        });
        await interaction.editReply({ embeds: [buildSuccessEmbed(`Deleted channel **${chName}**`)] });
      } catch (error) {
        await interaction.editReply({ embeds: [buildErrorEmbed(`Failed: ${error}`)] });
      }
      break;
    }

    case 'list': {
      const guild = interaction.guild!;
      const categories = guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position);

      const lines: string[] = [];
      for (const cat of categories.values()) {
        lines.push(`\n📁 **${cat.name}**`);
        const children = guild.channels.cache
          .filter((c) => 'parentId' in c && c.parentId === cat.id)
          .sort((a, b) => (a as any).position - (b as any).position);
        for (const ch of children.values()) {
          const icon = ch.type === ChannelType.GuildVoice ? '🔊' :
                       ch.type === ChannelType.GuildForum ? '💬' :
                       ch.type === ChannelType.GuildAnnouncement ? '📢' :
                       ch.type === ChannelType.GuildStageVoice ? '🎙️' : '#';
          lines.push(`  ${icon} ${ch.name}`);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`📁 Channels (${guild.channels.cache.size})`)
        .setDescription(lines.join('\n') || 'No channels.')
        .setColor(0x5865f2);

      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}
