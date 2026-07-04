/**
 * @module utils/serverContext
 * @description Builds a context string of the current server state for the AI interpreter.
 */
import { Guild, ChannelType } from 'discord.js';

/** Build a textual representation of the current server structure for AI context. */
export function getServerContext(guild: Guild): string {
  const lines: string[] = [];

  // Categories and channels
  lines.push('## Categories & Channels:');
  const categories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => (a as any).position - (b as any).position);

  for (const cat of categories.values()) {
    lines.push(`📁 ${cat.name}`);
    const children = guild.channels.cache
      .filter((c) => 'parentId' in c && c.parentId === cat.id)
      .sort((a, b) => (a as any).position - (b as any).position);
    for (const ch of children.values()) {
      const icon = ch.type === ChannelType.GuildVoice ? '🔊' :
                   ch.type === ChannelType.GuildForum ? '💬' :
                   ch.type === ChannelType.GuildAnnouncement ? '📢' :
                   ch.type === ChannelType.GuildStageVoice ? '🎙️' : '#';
      lines.push(`  └─ ${icon} ${ch.name}`);
    }
  }

  // Uncategorized channels
  const uncategorized = guild.channels.cache
    .filter((c) => c.type !== ChannelType.GuildCategory && !('parentId' in c && c.parentId));
  if (uncategorized.size > 0) {
    lines.push('📁 [No Category]');
    for (const ch of uncategorized.values()) {
      lines.push(`  └─ # ${ch.name}`);
    }
  }

  // Roles
  lines.push('\n## Roles:');
  const roles = guild.roles.cache
    .filter((r) => r.name !== '@everyone' && !r.managed)
    .sort((a, b) => b.position - a.position);
  for (const role of roles.values()) {
    lines.push(`🔹 ${role.name} (${role.hexColor}, ${role.members.size} members)`);
  }

  return lines.join('\n');
}
