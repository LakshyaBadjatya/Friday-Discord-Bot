/**
 * @module index
 * @description Main entry point for the Discord Server Architect Bot.
 */
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import express from 'express';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { registerCommands, handleInteraction } from './commands/registry.js';
import { connectDatabase, disconnectDatabase } from './database.js';

const log = createLogger('main');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once(Events.ClientReady, async (c) => {
  log.info({ user: c.user.tag }, 'Discord client ready');
  
  try {
    await registerCommands();
  } catch (error) {
    log.error({ error }, 'Failed to register commands');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    log.error({ error }, 'Error handling interaction');
  }
});

async function startHealthServer() {
  const app = express();
  const port = config.PORT || process.env.PORT || 3000;
  app.get('/', (req, res) => res.send('Discord Bot is running!'));
  app.listen(port, () => {
    log.info(`Health server listening on port ${port} for Render health checks.`);
  });
}

async function bootstrap() {
  log.info('Starting Discord Server Architect Bot...');
  
  // Start health server first so Render health checks pass immediately
  startHealthServer();
  
  try {
    await connectDatabase();
    await client.login(config.DISCORD_TOKEN);
  } catch (error) {
    log.fatal({ error }, 'Failed to start bot — health server still running');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  log.info('Received SIGINT, shutting down...');
  client.destroy();
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('Received SIGTERM, shutting down...');
  client.destroy();
  await disconnectDatabase();
  process.exit(0);
});

bootstrap();
