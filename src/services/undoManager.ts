/**
 * @module services/undoManager
 * @description Undo system — snapshots created resources for rollback.
 */
import { Guild, ChannelType } from 'discord.js';
import { createLogger } from '../logger.js';
import { prisma } from '../database.js';
import type { ExecutionPlan, UndoSnapshotData, UndoEntry } from '../types.js';

const log = createLogger('undo-manager');

/**
 * Create an undo snapshot before executing a plan.
 * Records what will be created/modified so it can be rolled back.
 */
export async function createUndoSnapshot(
  guild: Guild,
  plan: ExecutionPlan,
  userId: string,
): Promise<string> {
  const entries: UndoEntry[] = [];

  for (const action of plan.actions) {
    const p = action.params as Record<string, any>;

    switch (action.type) {
      case 'CREATE_CATEGORY':
      case 'CREATE_TEXT_CHANNEL':
      case 'CREATE_VOICE_CHANNEL':
      case 'CREATE_FORUM_CHANNEL':
      case 'CREATE_ANNOUNCEMENT_CHANNEL':
      case 'CREATE_STAGE_CHANNEL':
        entries.push({ type: 'created', resourceType: action.type.includes('CATEGORY') ? 'category' : 'channel', resourceName: p.name });
        break;
      case 'CREATE_ROLE':
        entries.push({ type: 'created', resourceType: 'role', resourceName: p.name });
        break;
      case 'DELETE_CHANNEL':
      case 'DELETE_CATEGORY': {
        const ch = guild.channels.cache.find((c) => c.name.toLowerCase() === p.name?.toLowerCase());
        if (ch) {
          entries.push({
            type: 'deleted', resourceType: action.type.includes('CATEGORY') ? 'category' : 'channel',
            resourceId: ch.id, resourceName: ch.name,
            previousState: { type: ch.type, name: ch.name, parentId: 'parentId' in ch ? ch.parentId : null },
          });
        }
        break;
      }
      case 'DELETE_ROLE': {
        const role = guild.roles.cache.find((r) => r.name.toLowerCase() === p.name?.toLowerCase());
        if (role) {
          entries.push({
            type: 'deleted', resourceType: 'role',
            resourceId: role.id, resourceName: role.name,
            previousState: { name: role.name, color: role.hexColor, hoist: role.hoist, mentionable: role.mentionable, permissions: role.permissions.toArray() },
          });
        }
        break;
      }
      case 'SET_CHANNEL_PERMISSIONS':
      case 'SET_PERMISSIONS':
        entries.push({ type: 'modified', resourceType: 'permission', resourceName: p.channelName || p.roleName });
        break;
    }
  }

  const snapshot = await prisma.undoSnapshot.create({
    data: {
      guildId: guild.id,
      description: plan.summary,
      snapshot: JSON.stringify({ entries, guildId: guild.id, description: plan.summary } satisfies UndoSnapshotData),
    },
  });

  log.info({ snapshotId: snapshot.id, entries: entries.length }, 'Undo snapshot created');
  return snapshot.id;
}

/**
 * Execute an undo — rollback created resources and recreate deleted ones.
 */
export async function executeUndo(guild: Guild, snapshotId: string): Promise<{ undone: number; errors: string[] }> {
  const snapshot = await prisma.undoSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) throw new Error('Undo snapshot not found');
  if (snapshot.undone) throw new Error('This undo has already been executed');

  const data = JSON.parse(snapshot.snapshot) as UndoSnapshotData;
  const errors: string[] = [];
  let undone = 0;

  // Reverse the entries (undo in reverse order)
  for (const entry of [...data.entries].reverse()) {
    try {
      switch (entry.type) {
        case 'created': {
          // Delete what was created
          if (entry.resourceType === 'channel' || entry.resourceType === 'category') {
            const ch = guild.channels.cache.find((c) => c.name.toLowerCase() === entry.resourceName.toLowerCase());
            if (ch) { await ch.delete('Undo operation'); undone++; }
          } else if (entry.resourceType === 'role') {
            const role = guild.roles.cache.find((r) => r.name.toLowerCase() === entry.resourceName.toLowerCase());
            if (role && !role.managed) { await role.delete('Undo operation'); undone++; }
          }
          break;
        }
        case 'deleted': {
          // Recreate what was deleted
          const prev = entry.previousState as any;
          if (entry.resourceType === 'role' && prev) {
            await guild.roles.create({ name: prev.name, color: prev.color, hoist: prev.hoist, mentionable: prev.mentionable });
            undone++;
          } else if ((entry.resourceType === 'channel' || entry.resourceType === 'category') && prev) {
            await guild.channels.create({ name: prev.name, type: prev.type });
            undone++;
          }
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 300)); // Rate limit
    } catch (error) {
      errors.push(`Failed to undo "${entry.resourceName}": ${error instanceof Error ? error.message : error}`);
    }
  }

  // Mark as undone
  await prisma.undoSnapshot.update({ where: { id: snapshotId }, data: { undone: true } });
  log.info({ snapshotId, undone, errors: errors.length }, 'Undo executed');

  return { undone, errors };
}

/**
 * Get recent undo snapshots for a guild.
 */
export async function getRecentSnapshots(guildId: string, limit = 10) {
  const snaps = await prisma.undoSnapshot.findMany({
    where: { guildId, undone: false },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return snaps.map(s => ({ id: s.id, description: s.description, createdAt: s.createdAt }));
}
