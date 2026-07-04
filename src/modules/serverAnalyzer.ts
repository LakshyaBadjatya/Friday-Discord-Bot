/**
 * @module modules/serverAnalyzer
 * @description Smart server analysis — health score, dead channels, unused roles, optimization suggestions.
 */
import { Guild, ChannelType, type GuildChannel, type TextChannel } from 'discord.js';
import { createLogger } from '../logger.js';
import type { ServerHealthReport, HealthCategory } from '../types.js';

const log = createLogger('server-analyzer');

/** Run a comprehensive server health analysis. */
export async function analyzeServer(guild: Guild): Promise<ServerHealthReport> {
  const categories: HealthCategory[] = [];
  const suggestions: string[] = [];

  // ─── Channel Health ─────────────────────────────────────────────────
  const channelIssues: string[] = [];
  const allChannels = guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory);
  const emptyCategories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .filter((cat) => !guild.channels.cache.some((c) => 'parentId' in c && c.parentId === cat.id));

  if (emptyCategories.size > 0) {
    channelIssues.push(`${emptyCategories.size} empty categories: ${emptyCategories.map((c) => c.name).join(', ')}`);
    suggestions.push(`Consider removing ${emptyCategories.size} empty categories`);
  }

  const uncategorized = allChannels.filter((c) => !('parentId' in c && c.parentId));
  if (uncategorized.size > 3) {
    channelIssues.push(`${uncategorized.size} uncategorized channels`);
    suggestions.push('Organize uncategorized channels into categories');
  }

  // Check for duplicate channel names
  const channelNames = allChannels.map((c) => c.name.toLowerCase());
  const dupes = channelNames.filter((n, i) => channelNames.indexOf(n) !== i);
  if (dupes.length > 0) {
    channelIssues.push(`Duplicate channel names: ${[...new Set(dupes)].join(', ')}`);
  }

  const channelScore = Math.max(0, 100 - channelIssues.length * 15);
  categories.push({ name: 'Channels', score: channelScore, issues: channelIssues });

  // ─── Role Health ────────────────────────────────────────────────────
  const roleIssues: string[] = [];
  const customRoles = guild.roles.cache.filter((r) => r.name !== '@everyone' && !r.managed);

  // Unused roles (no members)
  const unusedRoles = customRoles.filter((r) => r.members.size === 0);
  if (unusedRoles.size > 0) {
    roleIssues.push(`${unusedRoles.size} unused roles (0 members): ${unusedRoles.map((r) => r.name).slice(0, 5).join(', ')}`);
    suggestions.push(`Remove ${unusedRoles.size} unused roles to reduce clutter`);
  }

  // Roles with admin permissions
  const adminRoles = customRoles.filter((r) => r.permissions.has('Administrator'));
  if (adminRoles.size > 3) {
    roleIssues.push(`${adminRoles.size} roles have Administrator permission — consider reducing`);
    suggestions.push('Minimize the number of roles with Administrator permission');
  }

  // Duplicate role names
  const roleNames = customRoles.map((r) => r.name.toLowerCase());
  const roleDupes = roleNames.filter((n, i) => roleNames.indexOf(n) !== i);
  if (roleDupes.length > 0) {
    roleIssues.push(`Duplicate role names: ${[...new Set(roleDupes)].join(', ')}`);
  }

  const roleScore = Math.max(0, 100 - roleIssues.length * 15);
  categories.push({ name: 'Roles', score: roleScore, issues: roleIssues });

  // ─── Permission Health ──────────────────────────────────────────────
  const permIssues: string[] = [];

  // Check for overly permissive @everyone
  const everyone = guild.roles.cache.find((r) => r.name === '@everyone');
  if (everyone?.permissions.has('Administrator')) {
    permIssues.push('@everyone has Administrator — this is dangerous');
    suggestions.push('Remove Administrator from @everyone immediately');
  }

  // Check channels with no permission overwrites (might be intentional)
  const publicChannels = allChannels.filter((c) => {
    if (!('permissionOverwrites' in c)) return false;
    return (c as any).permissionOverwrites.cache.size <= 1;
  });
  if (publicChannels.size > allChannels.size * 0.8) {
    permIssues.push('Most channels have no custom permissions — consider private staff areas');
  }

  const permScore = Math.max(0, 100 - permIssues.length * 20);
  categories.push({ name: 'Permissions', score: permScore, issues: permIssues });

  // ─── Organization Health ────────────────────────────────────────────
  const orgIssues: string[] = [];
  const totalChannels = guild.channels.cache.size;

  if (totalChannels > 200) {
    orgIssues.push(`${totalChannels} channels — approaching Discord limit (500)`);
  }
  if (customRoles.size > 100) {
    orgIssues.push(`${customRoles.size} custom roles — approaching Discord limit (250)`);
  }

  // Check naming consistency (all lowercase-hyphen vs mixed)
  const inconsistentNames = allChannels.filter((c) => c.name !== c.name.toLowerCase().replace(/\s+/g, '-'));
  if (inconsistentNames.size > allChannels.size * 0.3) {
    orgIssues.push('Inconsistent channel naming — consider standardizing to lowercase-hyphen');
    suggestions.push('Rename channels to use consistent lowercase-hyphen format');
  }

  const orgScore = Math.max(0, 100 - orgIssues.length * 15);
  categories.push({ name: 'Organization', score: orgScore, issues: orgIssues });

  // ─── Final Score ────────────────────────────────────────────────────
  const score = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);

  if (score >= 80) suggestions.unshift('Your server is well-organized! 🎉');
  else if (score >= 60) suggestions.unshift('Your server is decent but has room for improvement.');
  else suggestions.unshift('Your server needs attention — several issues detected.');

  log.info({ guildId: guild.id, score }, 'Server analysis complete');
  return { score, categories, suggestions };
}

/** Find channels with no recent activity (dead channels). */
export async function findDeadChannels(guild: Guild, daysThreshold = 30): Promise<string[]> {
  const dead: string[] = [];
  const cutoff = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

  const textChannels = guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildText,
  );

  for (const ch of textChannels.values()) {
    try {
      const messages = await (ch as TextChannel).messages.fetch({ limit: 1 });
      const lastMsg = messages.first();
      if (!lastMsg || lastMsg.createdTimestamp < cutoff) {
        dead.push(ch.name);
      }
    } catch {
      // Can't access — skip
    }
  }

  return dead;
}

/** Find roles with 0 members. */
export function findUnusedRoles(guild: Guild): string[] {
  return guild.roles.cache
    .filter((r) => r.name !== '@everyone' && !r.managed && r.members.size === 0)
    .map((r) => r.name);
}
