// bot.js – Discord.js v14 with detailed logging (ESM)
import {
    Client,
    GatewayIntentBits,
    Partials,
    SlashCommandBuilder,
    PermissionFlagsBits,
    REST,
    Routes,
  } from 'discord.js';
  import fs from 'fs';
  import path from 'path';
  import dotenv from 'dotenv';
  dotenv.config();
  
  /* ----------------- helpers ----------------- */
  const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);
  const err = (...args) => console.error(`[${new Date().toISOString()}]`, ...args);
  
  /* -------------- USER SETTINGS -------------- */
  const PREFIX = 'http://archive.ph/newest/'; // prefix to prepend
  const DATA_FILE = path.resolve('./domains.json'); // where domains are stored
  /* ------------------------------------------- */
  
  /* -------- Simple JSON storage -------------- */
  function loadDomains() {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      log(`Loaded ${data.length} monitored domain(s) from disk.`);
      return Array.isArray(data) ? data : [];
    } catch {
      log('No existing domains file found. Starting with an empty list.');
      return [];
    }
  }
  function saveDomains(list) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
    log(`Persisted ${list.length} monitored domain(s) to disk.`);
  }
  let monitoredDomains = loadDomains();
  /* ------------------------------------------- */
  
  const urlRegex = /https?:\/\/[^\s<]+/gi;
  
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // enable in Developer Portal
    ],
    partials: [Partials.Channel],
  });
  
  /* ------------- Slash‑command schema -------- */
  const slashCommands = [
    // ----- Admin‑only commands -----
    new SlashCommandBuilder()
      .setName('adddomain')
      .setDescription('Add a domain to the monitored list')
      .addStringOption((o) =>
        o.setName('domain').setDescription('example.com').setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false),
  
    new SlashCommandBuilder()
      .setName('removedomain')
      .setDescription('Remove a domain from the monitored list')
      .addStringOption((o) =>
        o.setName('domain').setDescription('example.com').setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false),
  
    new SlashCommandBuilder()
      .setName('listdomains')
      .setDescription('Show all monitored domains')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false),
  
    // ----- Public command -----
    new SlashCommandBuilder()
      .setName('archive')
      .setDescription('Return the prefixed version of any URL')
      .addStringOption((o) =>
        o.setName('url').setDescription('Full URL to archive').setRequired(true)
      ),
  ].map((cmd) => cmd.toJSON());
  /* ------------------------------------------- */
  
  client.once('ready', async () => {
    log(`Logged in as ${client.user.tag}`);
  
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.application.id), {
      body: slashCommands,
    });
    log('Slash commands registered.');
  });
  
  /* ------------- Slash‑command logic --------- */
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
  
    const { commandName: cmd } = interaction;
    const isAdmin = interaction.memberPermissions.has(
      PermissionFlagsBits.Administrator
    );
  
    // Admin‑only guard
    if (
      ['adddomain', 'removedomain', 'listdomains'].includes(cmd) &&
      !isAdmin
    ) {
      log(
        `Denied ${cmd} for non‑admin ${interaction.user.tag} in guild ${interaction.guildId}`
      );
      return interaction.reply({
        content: '⛔ You need the **Administrator** permission to use this command.',
        ephemeral: true,
      });
    }
  
    try {
      if (cmd === 'adddomain') {
        const arg = interaction.options
          .getString('domain', true)
          .replace(/^www\./, '');
  
        if (monitoredDomains.includes(arg)) {
          log(`adddomain: ${arg} already exists (requested by ${interaction.user.tag})`);
          return interaction.reply({
            content: `🔔 **${arg}** is already monitored.`,
            ephemeral: true,
          });
        }
  
        monitoredDomains.push(arg);
        saveDomains(monitoredDomains);
        log(`adddomain: ${arg} added by ${interaction.user.tag}`);
        return interaction.reply({
          content: `✅ Added **${arg}**`,
          ephemeral: true,
        });
      }
  
      if (cmd === 'removedomain') {
        const arg = interaction.options
          .getString('domain', true)
          .replace(/^www\./, '');
        if (!monitoredDomains.includes(arg)) {
          log(`removedomain: ${arg} not found (requested by ${interaction.user.tag})`);
          return interaction.reply({
            content: `⚠️ **${arg}** wasn’t on the list.`,
            ephemeral: true,
          });
        }
  
        monitoredDomains = monitoredDomains.filter((d) => d !== arg);
        saveDomains(monitoredDomains);
        log(`removedomain: ${arg} removed by ${interaction.user.tag}`);
        return interaction.reply({
          content: `🗑️ Removed **${arg}**`,
          ephemeral: true,
        });
      }
  
      if (cmd === 'listdomains') {
        log(`listdomains requested by ${interaction.user.tag}`);
        const list = monitoredDomains.length
          ? monitoredDomains.join(', ')
          : '_(none yet)_';
        return interaction.reply({
          content: `📋 **Monitored domains:** ${list}`,
          ephemeral: true,
        });
      }
  
      if (cmd === 'archive') {
        const raw = interaction.options.getString('url', true);
        try {
          new URL(raw); // validate
        } catch {
          log(`archive: invalid URL '${raw}' from ${interaction.user.tag}`);
          return interaction.reply({
            content: '❌ Invalid URL.',
            ephemeral: true,
          });
        }
        log(`archive: ${raw} requested by ${interaction.user.tag}`);
        return interaction.reply({ content: `${PREFIX}${raw}` });
      }
    } catch (e) {
      err(`Error handling ${cmd}:`, e);
      if (!interaction.replied) {
        await interaction.reply({ content: '⚠️ An unexpected error occurred.', ephemeral: true });
      }
    }
  });
  /* ------------------------------------------- */
  
  /* -------- Automatic link watcher ----------- */
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content) return;
  
    const urls = message.content.match(urlRegex);
    if (!urls) return;
  
    const matches = urls.filter((raw) => {
      try {
        const host = new URL(raw).hostname.replace(/^www\./, '');
        return monitoredDomains.includes(host);
      } catch {
        return false;
      }
    });
    if (matches.length === 0) return;
  
    log(
      `Auto‑archive ${matches.length} link(s) from ${message.author.tag} in #${message.channel.name}`
    );
  
    const response = matches.map((u) => `${PREFIX}${u}`).join('\n');
    await message.channel.send({
      content: response,
      reply: { messageReference: message.id },
    });
  });
  /* ------------------------------------------- */
  
  /* -------- Global error handlers ------------ */
  process.on('unhandledRejection', (reason) => {
    err('Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (error) => {
    err('Uncaught exception:', error);
  });
  /* ------------------------------------------- */
  
  // Log in
  client.login(process.env.DISCORD_TOKEN).catch((e) => {
    err('Failed to log in:', e);
    process.exit(1);
  });
  