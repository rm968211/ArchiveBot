// index.js – Discord.js v14 with detailed logging (ESM) | warnings fixed
import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  MessageFlags,            // NEW: for proper ephemeral replies
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

/* ---------------- helpers ----------------- */
const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);
const err = (...args) => console.error(`[${new Date().toISOString()}]`, ...args);

/* -------------- USER SETTINGS -------------- */
const PREFIX = 'http://archive.ph/newest/';
/* ------------------------------------------- */

/* ---------- Domain storage in /data -------- */
const DOMAIN_FILE = process.env.DOMAIN_FILE || path.join('/data', 'domains.json');

function ensureDomainFile() {
  const dir = path.dirname(DOMAIN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DOMAIN_FILE)) {
    fs.writeFileSync(DOMAIN_FILE, '[]');
    log(`Created fresh domain store at ${DOMAIN_FILE}`);
  }
}

function loadDomains() {
  ensureDomainFile();
  try {
    const raw = fs.readFileSync(DOMAIN_FILE, 'utf8');
    const list = JSON.parse(raw || '[]');
    log(`Loaded ${list.length} monitored domain(s) from ${DOMAIN_FILE}`);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    err('domains.json is malformed – resetting.', e);
    fs.writeFileSync(DOMAIN_FILE, '[]');
    return [];
  }
}

function saveDomains(list) {
  try {
    fs.writeFileSync(DOMAIN_FILE, JSON.stringify(list, null, 2));
    log(`Persisted ${list.length} domain(s) to ${DOMAIN_FILE}`);
  } catch (e) {
    err('Failed to save domain list:', e);
  }
}

let monitoredDomains = loadDomains();
/* ------------------------------------------- */

const urlRegex = /https?:\/\/[^\s<]+/gi;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

/* ------------- Slash-command schema -------- */
const slashCommands = [
  new SlashCommandBuilder()
    .setName('adddomain')
    .setDescription('Add a domain to the monitored list')
    .addStringOption(o => o.setName('domain').setDescription('example.com').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('removedomain')
    .setDescription('Remove a domain from the monitored list')
    .addStringOption(o => o.setName('domain').setDescription('example.com').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('listdomains')
    .setDescription('Show all monitored domains')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('archive')
    .setDescription('Return the prefixed version of any URL')
    .addStringOption(o => o.setName('url').setDescription('Full URL to archive').setRequired(true)),
].map(cmd => cmd.toJSON());
/* ------------------------------------------- */

client.once('ready', async () => {
  log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.application.id), { body: slashCommands });
  log('Slash commands registered.');
});

/* --------- Utility for ephemeral replies --- */
const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
/* ------------------------------------------- */

/* --------- Slash-command logic ------------- */
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName: cmd } = interaction;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (['adddomain', 'removedomain', 'listdomains'].includes(cmd) && !isAdmin) {
    log(`Denied ${cmd} for non-admin ${interaction.user.tag}`);
    return interaction.reply(eph('⛔ You need the **Administrator** permission to use this command.'));
  }

  try {
    if (cmd === 'adddomain') {
      const arg = interaction.options.getString('domain', true).replace(/^www\./, '');
      if (monitoredDomains.includes(arg)) {
        return interaction.reply(eph(`🔔 **${arg}** is already monitored.`));
      }
      monitoredDomains.push(arg);
      saveDomains(monitoredDomains);
      return interaction.reply(eph(`✅ Added **${arg}**`));
    }

    if (cmd === 'removedomain') {
      const arg = interaction.options.getString('domain', true).replace(/^www\./, '');
      if (!monitoredDomains.includes(arg)) {
        return interaction.reply(eph(`⚠️ **${arg}** wasn’t on the list.`));
      }
      monitoredDomains = monitoredDomains.filter(d => d !== arg);
      saveDomains(monitoredDomains);
      return interaction.reply(eph(`🗑️ Removed **${arg}**`));
    }

    if (cmd === 'listdomains') {
      const list = monitoredDomains.length ? monitoredDomains.join(', ') : '_(none yet)_';
      return interaction.reply(eph(`📋 **Monitored domains:** ${list}`));
    }

    if (cmd === 'archive') {
      const raw = interaction.options.getString('url', true);
      try { new URL(raw); } catch { return interaction.reply(eph('❌ Invalid URL.')); }
      return interaction.reply({ content: `${PREFIX}${raw}` });
    }
  } catch (e) {
    err(`Error handling ${cmd}:`, e);
    if (!interaction.replied) await interaction.reply(eph('⚠️ An unexpected error occurred.'));
  }
});
/* ------------------------------------------- */

/* -------- Automatic link watcher ----------- */
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content) return;
  const urls = message.content.match(urlRegex);
  if (!urls) return;

  const matches = urls.filter(raw => {
    try { return monitoredDomains.includes(new URL(raw).hostname.replace(/^www\./, '')); }
    catch { return false; }
  });
  if (matches.length === 0) return;

  const response = matches.map(u => `${PREFIX}${u}`).join('\n');
  await message.channel.send({ content: response, reply: { messageReference: message.id } });
});
/* ------------------------------------------- */

/* -------- Global error handlers ------------ */
process.on('unhandledRejection', reason => err('Unhandled promise rejection:', reason));
process.on('uncaughtException', error => err('Uncaught exception:', error));
/* ------------------------------------------- */

client.login(process.env.DISCORD_TOKEN).catch(e => { err('Failed to log in:', e); process.exit(1); });
