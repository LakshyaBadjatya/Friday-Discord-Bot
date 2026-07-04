/**
 * @module commands/registry
 * @description Registers all slash commands with Discord and maps them to handlers.
 */
import {
  REST, Routes, SlashCommandBuilder, type ChatInputCommandInteraction,
  type ButtonInteraction, type Interaction, ChannelType,
} from 'discord.js';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

// Command handlers
import { handleBuild } from './build.js';
import { handleTemplate } from './template.js';
import { handleRoles } from './roles.js';
import { handleChannels } from './channels.js';
import { handlePermissions } from './permissions.js';
import { handleTickets } from './tickets.js';
import { handleBackup } from './backup.js';
import { handleRestore } from './restore.js';
import { handleClone } from './clone.js';
import { handleSettings } from './settings.js';
import { handleHelp } from './help.js';
import { handleSetup } from './setup.js';
import { handleHistory } from './history.js';
import { handleUndo } from './undo.js';
import { handleAnalyze } from './analyze.js';

// Button handlers
import { handleTicketCreate, handleTicketClose } from '../services/tickets.js';

const log = createLogger('commands');

/** All slash command definitions. */
const commands = [
  // ─── AI Build ──────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('build')
    .setDescription('Use AI to build or modify your server with natural language')
    .addStringOption((o) => o.setName('prompt').setDescription('Describe what you want to build').setRequired(true)),

  // ─── Setup (AI Control Room) ───────────────────────────────────────
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the AI Control Room')
    .addSubcommand((s) =>
      s.setName('channels').setDescription('Set AI control, log, error, and notification channels')
        .addChannelOption((o) => o.setName('control').setDescription('AI Control Channel').addChannelTypes(ChannelType.GuildText))
        .addChannelOption((o) => o.setName('log').setDescription('AI Log Channel').addChannelTypes(ChannelType.GuildText))
        .addChannelOption((o) => o.setName('errors').setDescription('AI Error Log Channel').addChannelTypes(ChannelType.GuildText))
        .addChannelOption((o) => o.setName('notifications').setDescription('AI Notification Channel').addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s.setName('access').setDescription('Configure allowed roles and users')
        .addStringOption((o) => o.setName('roles').setDescription('Allowed roles (mention or IDs, space-separated)'))
        .addStringOption((o) => o.setName('users').setDescription('Allowed users (mention or IDs, space-separated)')),
    )
    .addSubcommand((s) =>
      s.setName('modes').setDescription('Toggle confirmation, dry run, reviewer, and auto backup')
        .addBooleanOption((o) => o.setName('confirmation').setDescription('Require confirmation before execution'))
        .addBooleanOption((o) => o.setName('dry_run').setDescription('Preview plans without executing'))
        .addBooleanOption((o) => o.setName('reviewer').setDescription('Enable AI reviewer agent'))
        .addBooleanOption((o) => o.setName('auto_backup').setDescription('Auto backup before destructive actions')),
    )
    .addSubcommand((s) =>
      s.setName('ai').setDescription('Configure AI model and language')
        .addStringOption((o) => o.setName('model').setDescription('AI model name'))
        .addStringOption((o) => o.setName('language').setDescription('Server language (e.g. en, es, fr)')),
    )
    .addSubcommand((s) =>
      s.setName('view').setDescription('View current AI Control Room settings'),
    ),

  // ─── History & Undo ────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('history')
    .setDescription('View and manage command history')
    .addSubcommand((s) =>
      s.setName('view').setDescription('View recent command history')
        .addIntegerOption((o) => o.setName('count').setDescription('Number of entries (max 25)').setMinValue(1).setMaxValue(25)),
    )
    .addSubcommand((s) =>
      s.setName('export').setDescription('Export full history as JSON'),
    )
    .addSubcommand((s) =>
      s.setName('rollback').setDescription('Rollback a specific action')
        .addStringOption((o) => o.setName('id').setDescription('Action log ID').setRequired(true)),
    ),

  new SlashCommandBuilder()
    .setName('undo')
    .setDescription('Undo the last AI execution'),

  // ─── Server Analysis ──────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('analyze')
    .setDescription('Smart server analysis')
    .addSubcommand((s) =>
      s.setName('health').setDescription('Run a comprehensive server health check'),
    )
    .addSubcommand((s) =>
      s.setName('dead_channels').setDescription('Find channels with no recent activity')
        .addIntegerOption((o) => o.setName('days').setDescription('Days of inactivity threshold').setMinValue(7).setMaxValue(365)),
    )
    .addSubcommand((s) =>
      s.setName('unused_roles').setDescription('Find roles with 0 members'),
    ),

  // ─── Templates ─────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('template')
    .setDescription('Apply a built-in server template')
    .addStringOption((o) =>
      o.setName('name').setDescription('Template name').setRequired(true)
        .addChoices(
          { name: '🎮 Gaming', value: 'gaming' },
          { name: '📚 Study', value: 'study' },
          { name: '🚀 Startup', value: 'startup' },
          { name: '🤖 AI Community', value: 'ai-community' },
          { name: '💻 Developer', value: 'developer' },
          { name: '💼 Business', value: 'business' },
          { name: '🏫 School', value: 'school' },
          { name: '🍥 Anime', value: 'anime' },
          { name: '🎵 Music', value: 'music' },
          { name: '🎬 Creator', value: 'creator' },
          { name: '🔓 Open Source', value: 'open-source' },
        ),
    ),

  // ─── Direct Management ─────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Manage server roles')
    .addSubcommand((s) =>
      s.setName('create').setDescription('Create a new role')
        .addStringOption((o) => o.setName('name').setDescription('Role name').setRequired(true))
        .addStringOption((o) => o.setName('color').setDescription('Hex color (e.g. #FF0000)'))
        .addBooleanOption((o) => o.setName('hoist').setDescription('Show separately in member list')),
    )
    .addSubcommand((s) =>
      s.setName('delete').setDescription('Delete a role')
        .addRoleOption((o) => o.setName('role').setDescription('Role to delete').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List all server roles'),
    ),

  new SlashCommandBuilder()
    .setName('channels')
    .setDescription('Manage server channels')
    .addSubcommand((s) =>
      s.setName('create').setDescription('Create a channel')
        .addStringOption((o) => o.setName('name').setDescription('Channel name').setRequired(true))
        .addStringOption((o) =>
          o.setName('type').setDescription('Channel type').setRequired(true)
            .addChoices(
              { name: 'Text', value: 'text' }, { name: 'Voice', value: 'voice' },
              { name: 'Forum', value: 'forum' }, { name: 'Announcement', value: 'announcement' },
              { name: 'Stage', value: 'stage' }, { name: 'Category', value: 'category' },
            ),
        )
        .addStringOption((o) => o.setName('category').setDescription('Parent category name')),
    )
    .addSubcommand((s) =>
      s.setName('delete').setDescription('Delete a channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to delete').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List all server channels'),
    ),

  new SlashCommandBuilder()
    .setName('permissions')
    .setDescription('Manage permissions')
    .addSubcommand((s) =>
      s.setName('view').setDescription('View permissions for a role or channel')
        .addRoleOption((o) => o.setName('role').setDescription('Role to inspect'))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to inspect')),
    ),

  // ─── Tickets ───────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Ticket system management')
    .addSubcommand((s) =>
      s.setName('setup').setDescription('Create a ticket panel in this channel'),
    )
    .addSubcommand((s) =>
      s.setName('close').setDescription('Close the current ticket'),
    ),

  // ─── Backup & Restore ──────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Backup server structure')
    .addSubcommand((s) =>
      s.setName('create').setDescription('Create a backup')
        .addStringOption((o) => o.setName('name').setDescription('Backup name')),
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List all backups'),
    ),

  new SlashCommandBuilder()
    .setName('restore')
    .setDescription('Restore from a backup')
    .addStringOption((o) => o.setName('id').setDescription('Backup ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clone')
    .setDescription('Clone a channel or category')
    .addChannelOption((o) => o.setName('source').setDescription('Channel/category to clone').setRequired(true))
    .addStringOption((o) => o.setName('name').setDescription('New name for the clone')),

  // ─── Settings & Help ───────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure bot settings')
    .addSubcommand((s) =>
      s.setName('welcome').setDescription('Set up welcome messages')
        .addChannelOption((o) => o.setName('channel').setDescription('Welcome channel').setRequired(true))
        .addStringOption((o) => o.setName('message').setDescription('Welcome message (use {user}, {server})')),
    )
    .addSubcommand((s) =>
      s.setName('logging').setDescription('Set up audit logging')
        .addChannelOption((o) => o.setName('channel').setDescription('Log channel').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('view').setDescription('View current settings'),
    ),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help and command guide'),
];

/** Map of command name → handler function. */
const commandHandlers: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
  build: handleBuild,
  setup: handleSetup,
  history: handleHistory,
  undo: handleUndo,
  analyze: handleAnalyze,
  template: handleTemplate,
  roles: handleRoles,
  channels: handleChannels,
  permissions: handlePermissions,
  tickets: handleTickets,
  backup: handleBackup,
  restore: handleRestore,
  clone: handleClone,
  settings: handleSettings,
  help: handleHelp,
};

/** Register all slash commands with Discord. */
export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(config.DISCORD_TOKEN);
  const body = commands.map((c) => c.toJSON());

  log.info({ count: body.length }, 'Registering slash commands');
  await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body });
  log.info('Slash commands registered');
}

/** Route an interaction to the correct handler. */
export async function handleInteraction(interaction: Interaction): Promise<void> {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const handler = commandHandlers[interaction.commandName];
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        log.error({ error, command: interaction.commandName }, 'Command handler error');
        const reply = { content: '❌ An error occurred while executing this command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    }
    return;
  }

  // Button interactions
  if (interaction.isButton()) {
    try {
      if (interaction.customId === 'ticket_create') {
        await handleTicketCreate(interaction);
      } else if (interaction.customId === 'ticket_close') {
        await handleTicketClose(interaction);
      }
      // Plan confirmation buttons are handled inline in the build command
    } catch (error) {
      log.error({ error, customId: interaction.customId }, 'Button handler error');
    }
  }
}
