/**
 * @module utils/controlRoom
 * @description Control room logic — verifies AI control channel and user authorization.
 */
import { type Message, type GuildMember, PermissionsBitField } from 'discord.js';
import { createLogger } from '../logger.js';
import { prisma } from '../database.js';

const log = createLogger('control-room');

interface AuthResult {
  authorized: boolean;
  reason?: string;
}

/**
 * Check if a message is in the configured AI control channel.
 * Returns null if no control channel is configured (bot ignores message).
 */
export async function isControlChannel(guildId: string, channelId: string): Promise<boolean> {
  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (!settings?.aiControlChannelId) return false;
  return settings.aiControlChannelId === channelId;
}

/**
 * Check if a user is authorized to use AI commands.
 * Authorization hierarchy: Server Owner > Administrators > Allowed Users > Allowed Roles > Denied.
 */
export async function checkAuthorization(guildId: string, member: GuildMember): Promise<AuthResult> {
  // Server owner always authorized
  if (member.guild.ownerId === member.id) {
    return { authorized: true };
  }

  // Administrators always authorized
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return { authorized: true };
  }

  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (!settings) {
    return { authorized: false, reason: 'Bot not configured. Ask an admin to run `/setup`.' };
  }

  // Check allowed users
  if (settings.allowedUserIds) {
    const allowedUsers = JSON.parse(settings.allowedUserIds) as string[];
    if (allowedUsers.includes(member.id)) {
      return { authorized: true };
    }
  }

  // Check allowed roles
  if (settings.allowedRoleIds) {
    const allowedRoles = JSON.parse(settings.allowedRoleIds) as string[];
    const hasAllowedRole = member.roles.cache.some((r) => allowedRoles.includes(r.id));
    if (hasAllowedRole) {
      return { authorized: true };
    }
  }

  return {
    authorized: false,
    reason: '🔒 You are not authorized to use AI commands. Contact a server administrator.',
  };
}

/**
 * Get guild settings, creating defaults if needed.
 */
export async function getGuildSettings(guildId: string) {
  return prisma.guildSettings.findUnique({ where: { guildId } });
}

/**
 * Check if a specific mode is enabled for a guild.
 */
export async function isFeatureEnabled(
  guildId: string,
  feature: 'confirmationMode' | 'dryRunMode' | 'aiReviewerEnabled' | 'autoBackupEnabled',
): Promise<boolean> {
  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (!settings) return feature === 'confirmationMode'; // Default: confirmation on, rest off
  return settings[feature];
}
