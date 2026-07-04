/**
 * @module commands/help
 * @description /help — show all available commands and usage guide.
 */
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('🏗️ Server Architect — Help')
    .setDescription('AI-powered Discord server management. Build, organize, and manage your server with natural language.')
    .setColor(0x5865f2)
    .addFields(
      {
        name: '🤖 AI Commands',
        value: [
          '`/build <prompt>` — Use AI to build/modify your server',
          '  Examples:',
          '  • "Build a study server"',
          '  • "Create a staff area with mod channels"',
          '  • "Add coding voice channels"',
          '  • "Rename General to Lobby"',
          '  • "Delete empty channels"',
        ].join('\n'),
      },
      {
        name: '📋 Templates',
        value: '`/template <name>` — Apply a pre-built server template\n' +
          'Available: Gaming, Study, Startup, AI, Developer, Business, School, Anime, Music, Creator, Open Source',
      },
      {
        name: '🛡️ Roles & Channels',
        value: [
          '`/roles create <name> [color] [hoist]`',
          '`/roles delete <role>`',
          '`/roles list`',
          '`/channels create <name> <type> [category]`',
          '`/channels delete <channel>`',
          '`/channels list`',
        ].join('\n'),
      },
      {
        name: '🔒 Permissions',
        value: '`/permissions view [role] [channel]` — Inspect permissions',
      },
      {
        name: '🎫 Tickets',
        value: '`/tickets setup` — Create ticket panel\n`/tickets close` — Close current ticket',
      },
      {
        name: '💾 Backup & Restore',
        value: '`/backup create [name]` — Snapshot server structure\n`/backup list` — List backups\n`/restore <id>` — Restore from backup',
      },
      {
        name: '📑 Clone & Settings',
        value: '`/clone <source> [name]` — Clone a channel/category\n`/settings welcome <channel>` — Set up welcomes\n`/settings logging <channel>` — Set up audit logs\n`/settings view` — View current settings',
      },
    )
    .setFooter({ text: 'Server Architect • Requires Administrator or Manage Server permission' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
