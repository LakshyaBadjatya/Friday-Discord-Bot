/**
 * @module services/executor
 * @description Executes planned actions against the Discord API using the rate-limit queue.
 */
import {
  Guild, ChannelType, PermissionsBitField, OverwriteType,
  type GuildChannel, type CategoryChannel, type Role,
} from 'discord.js';
import { createLogger } from '../logger.js';
import { discordQueue } from './rateLimiter.js';
import type { PlannedAction, ActionResult, ExecutionPlan } from '../types.js';

const log = createLogger('executor');

function resolveChannelType(type: string): ChannelType {
  const map: Record<string, ChannelType> = {
    text: ChannelType.GuildText, voice: ChannelType.GuildVoice,
    forum: ChannelType.GuildForum, announcement: ChannelType.GuildAnnouncement,
    stage: ChannelType.GuildStageVoice, category: ChannelType.GuildCategory,
  };
  return map[type] ?? ChannelType.GuildText;
}

function findCategory(guild: Guild, name: string): CategoryChannel | undefined {
  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase(),
  ) as CategoryChannel | undefined;
}

function findChannel(guild: Guild, name: string): GuildChannel | undefined {
  return guild.channels.cache.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.type !== ChannelType.GuildCategory,
  ) as GuildChannel | undefined;
}

function findRole(guild: Guild, name: string): Role | undefined {
  return guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

/** Execute a single action through the rate-limit queue. */
async function executeAction(guild: Guild, action: PlannedAction): Promise<ActionResult> {
  const { id, type, params } = action;
  const p = params as Record<string, any>;

  return discordQueue.enqueue(id, async () => {
    try {
      switch (type) {
        case 'CREATE_CATEGORY': {
          const ch = await guild.channels.create({ name: p.name, type: ChannelType.GuildCategory, position: p.position });
          return { actionId: id, type, success: true, message: `Created category "${p.name}"`, createdId: ch.id };
        }
        case 'EDIT_CATEGORY': {
          const cat = findCategory(guild, p.name);
          if (!cat) return { actionId: id, type, success: false, message: `Category "${p.name}" not found`, error: 'NOT_FOUND' };
          await cat.edit({ name: p.newName ?? cat.name, position: p.position ?? cat.position });
          return { actionId: id, type, success: true, message: `Edited category "${p.name}"` };
        }
        case 'DELETE_CATEGORY': {
          const cat = findCategory(guild, p.name);
          if (!cat) return { actionId: id, type, success: false, message: `Category "${p.name}" not found`, error: 'NOT_FOUND' };
          await cat.delete();
          return { actionId: id, type, success: true, message: `Deleted category "${p.name}"` };
        }
        case 'CREATE_TEXT_CHANNEL': case 'CREATE_VOICE_CHANNEL': case 'CREATE_FORUM_CHANNEL':
        case 'CREATE_ANNOUNCEMENT_CHANNEL': case 'CREATE_STAGE_CHANNEL': {
          const chType = type.replace('CREATE_', '').replace('_CHANNEL', '').toLowerCase();
          const parent = p.category ? findCategory(guild, p.category) : undefined;
          const ch = await guild.channels.create({
            name: p.name, type: resolveChannelType(chType) as any, parent: parent?.id,
            topic: p.topic, nsfw: p.nsfw, rateLimitPerUser: p.slowMode, userLimit: p.userLimit,
          });
          return { actionId: id, type, success: true, message: `Created ${chType} channel "#${p.name}"`, createdId: ch.id };
        }
        case 'EDIT_CHANNEL': {
          const ch = findChannel(guild, p.name);
          if (!ch) return { actionId: id, type, success: false, message: `Channel "${p.name}" not found`, error: 'NOT_FOUND' };
          const editData: any = {};
          if (p.newName) editData.name = p.newName;
          if (p.topic !== undefined) editData.topic = p.topic;
          if (p.nsfw !== undefined) editData.nsfw = p.nsfw;
          if (p.slowMode !== undefined) editData.rateLimitPerUser = p.slowMode;
          if (p.userLimit !== undefined) editData.userLimit = p.userLimit;
          await (ch as any).edit(editData);
          return { actionId: id, type, success: true, message: `Edited "#${p.name}"` };
        }
        case 'DELETE_CHANNEL': {
          const ch = findChannel(guild, p.name);
          if (!ch) return { actionId: id, type, success: false, message: `Channel "${p.name}" not found`, error: 'NOT_FOUND' };
          await ch.delete();
          return { actionId: id, type, success: true, message: `Deleted "#${p.name}"` };
        }
        case 'CREATE_ROLE': {
          const role = await guild.roles.create({
            name: p.name, color: p.color as any, hoist: p.hoist ?? false, mentionable: p.mentionable ?? false,
            permissions: p.permissions ? new PermissionsBitField(p.permissions) : undefined,
          });
          return { actionId: id, type, success: true, message: `Created role "${p.name}"`, createdId: role.id };
        }
        case 'EDIT_ROLE': {
          const role = findRole(guild, p.name);
          if (!role) return { actionId: id, type, success: false, message: `Role "${p.name}" not found`, error: 'NOT_FOUND' };
          const editData: any = {};
          if (p.newName) editData.name = p.newName;
          if (p.color) editData.color = p.color;
          if (p.hoist !== undefined) editData.hoist = p.hoist;
          if (p.mentionable !== undefined) editData.mentionable = p.mentionable;
          if (p.permissions) editData.permissions = new PermissionsBitField(p.permissions);
          await role.edit(editData);
          return { actionId: id, type, success: true, message: `Edited role "${p.name}"` };
        }
        case 'DELETE_ROLE': {
          const role = findRole(guild, p.name);
          if (!role) return { actionId: id, type, success: false, message: `Role "${p.name}" not found`, error: 'NOT_FOUND' };
          await role.delete();
          return { actionId: id, type, success: true, message: `Deleted role "${p.name}"` };
        }
        case 'SET_PERMISSIONS': {
          const role = findRole(guild, p.roleName);
          if (!role) return { actionId: id, type, success: false, message: `Role "${p.roleName}" not found`, error: 'NOT_FOUND' };
          await role.setPermissions(new PermissionsBitField(p.permissions));
          return { actionId: id, type, success: true, message: `Updated permissions for "${p.roleName}"` };
        }
        case 'SET_CHANNEL_PERMISSIONS': {
          const ch = findChannel(guild, p.channelName);
          if (!ch) return { actionId: id, type, success: false, message: `Channel "${p.channelName}" not found`, error: 'NOT_FOUND' };
          const target = p.targetType === 'role' ? findRole(guild, p.target) : undefined;
          if (!target && p.targetType === 'role') return { actionId: id, type, success: false, message: `Role "${p.target}" not found`, error: 'NOT_FOUND' };
          const targetId = p.targetType === 'role' ? target!.id : p.target;
          await (ch as any).permissionOverwrites.edit(targetId, {
            ...(p.allow ? Object.fromEntries((p.allow as string[]).map((perm: string) => [perm, true])) : {}),
            ...(p.deny ? Object.fromEntries((p.deny as string[]).map((perm: string) => [perm, false])) : {}),
          });
          return { actionId: id, type, success: true, message: `Updated perms on "#${p.channelName}"` };
        }
        case 'MOVE_CHANNEL': {
          const ch = findChannel(guild, p.name);
          if (!ch) return { actionId: id, type, success: false, message: `Channel "${p.name}" not found`, error: 'NOT_FOUND' };
          const parent = findCategory(guild, p.category);
          if (!parent) return { actionId: id, type, success: false, message: `Category "${p.category}" not found`, error: 'NOT_FOUND' };
          await (ch as any).setParent(parent.id, { lockPermissions: false });
          return { actionId: id, type, success: true, message: `Moved "#${p.name}" to "${p.category}"` };
        }
        case 'SET_ROLE_HIERARCHY': {
          const positions = (p.roles as { name: string; position: number }[])
            .map((r) => { const role = findRole(guild, r.name); return role ? { role: role.id, position: r.position } : null; })
            .filter(Boolean) as { role: string; position: number }[];
          await guild.roles.setPositions(positions);
          return { actionId: id, type, success: true, message: 'Updated role hierarchy' };
        }
        case 'CREATE_TICKET_PANEL': case 'SETUP_WELCOME': case 'SETUP_LOGGING':
          return { actionId: id, type, success: true, message: `${type} handled by command` };
        default:
          return { actionId: id, type, success: false, message: `Unknown: ${type}`, error: 'UNKNOWN' };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error({ error, actionId: id }, 'Action failed');
      return { actionId: id, type, success: false, message: `Failed: ${msg}`, error: msg };
    }
  });
}

/** Execute an entire plan sequentially through the rate-limit queue. */
export async function executePlan(
  guild: Guild, plan: ExecutionPlan, userId: string, userName: string,
): Promise<{ results: ActionResult[] }> {
  const results: ActionResult[] = [];
  for (const action of plan.actions) {
    const result = await executeAction(guild, action);
    results.push(result);
  }
  return { results };
}
