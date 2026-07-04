/**
 * @module services/backup
 * @description Server backup & restore with auto-backup support.
 */
import { Guild, ChannelType, type GuildChannel } from 'discord.js';
import { createLogger } from '../logger.js';
import { prisma } from '../database.js';
import type { ServerSnapshot, RoleBlueprint, CategoryBlueprint, ChannelBlueprint } from '../types.js';

const log = createLogger('backup');

function channelTypeToString(type: ChannelType): ChannelBlueprint['type'] | null {
  const map: Partial<Record<ChannelType, ChannelBlueprint['type']>> = {
    [ChannelType.GuildText]: 'text', [ChannelType.GuildVoice]: 'voice',
    [ChannelType.GuildForum]: 'forum', [ChannelType.GuildAnnouncement]: 'announcement',
    [ChannelType.GuildStageVoice]: 'stage',
  };
  return map[type] ?? null;
}

/** Create a full snapshot of the server structure. */
export async function createBackup(
  guild: Guild,
  userId: string,
  name?: string,
  trigger: 'MANUAL' | 'AUTO' | 'PRE_DELETE' = 'MANUAL',
): Promise<ServerSnapshot> {
  log.info({ guildId: guild.id, trigger }, 'Creating backup');

  const roles: RoleBlueprint[] = guild.roles.cache
    .filter((r) => r.name !== '@everyone' && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      name: r.name, color: r.hexColor, hoist: r.hoist,
      mentionable: r.mentionable, permissions: r.permissions.toArray(), position: r.position,
    }));

  const categories: CategoryBlueprint[] = [];
  const catChannels = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  for (const cat of catChannels.values()) {
    const children = guild.channels.cache
      .filter((c) => (c as GuildChannel).parentId === cat.id)
      .sort((a, b) => (a as any).position - (b as any).position);

    const channels: ChannelBlueprint[] = [];
    for (const ch of children.values()) {
      const typeStr = channelTypeToString(ch.type);
      if (!typeStr) continue;
      channels.push({
        name: ch.name, type: typeStr,
        topic: 'topic' in ch ? (ch as any).topic ?? undefined : undefined,
        nsfw: 'nsfw' in ch ? (ch as any).nsfw : undefined,
        slowMode: 'rateLimitPerUser' in ch ? (ch as any).rateLimitPerUser : undefined,
        userLimit: 'userLimit' in ch ? (ch as any).userLimit : undefined,
      });
    }
    categories.push({ name: cat.name, channels });
  }

  const snapshot: ServerSnapshot = {
    guildId: guild.id, guildName: guild.name,
    snapshotAt: new Date().toISOString(), roles, categories,
  };

  await prisma.serverBackup.create({
    data: {
      guildId: guild.id,
      name: name ?? `${trigger} Backup ${new Date().toISOString().slice(0, 16)}`,
      data: JSON.stringify(snapshot),
      trigger,
      createdBy: userId,
    },
  });

  log.info({ guildId: guild.id, roles: roles.length, categories: categories.length }, 'Backup created');
  return snapshot;
}

/** Auto-backup before destructive operations. */
export async function createAutoBackup(guild: Guild, userId: string): Promise<void> {
  await createBackup(guild, userId, undefined, 'AUTO');
}

/** List backups for a guild. */
export async function listBackups(guildId: string) {
  return prisma.serverBackup.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
  });
}

/** Get a backup by ID. */
export async function getBackup(backupId: string): Promise<ServerSnapshot | null> {
  const backup = await prisma.serverBackup.findUnique({ where: { id: backupId } });
  if (!backup) return null;
  return JSON.parse(backup.data) as ServerSnapshot;
}
