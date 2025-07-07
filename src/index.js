import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  MessageFlags,
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

const QUIPS = [
  '🚪🔑 Paywall? What paywall?',
  '📰✨ Fresh off the archive presses:',
  '📚 Saved for posterity:',
  '💾 Cache me outside:',
  '🎁 Unwrapped and ready:',
  '🕵️‍♂️ Secret scoop secured:',
  '📦 De-gated and delivered:',
  '🔓 Doors wide open:',
  '🪄 Voilà, no ads:',
  '⏳ Froze that link in time:',
  '🛰️ Downlinked from orbit:',
  '🎩 Pulled from the paywall hat:',
  '🛟 Rescued from oblivion:',
  '📜 Scroll of truth incoming:',
  '🚀 Launched past the firewall:',
  '🥡 Take‑out copy, no login:',
  '🌌 Archived in the cloud nebula:',
  '🕰️ Time‑capsule unlocked:',
  '🧊 Ice‑cold cache served:',
  '🖨️ Printable and presentable:',
  '🦉 Wisdom preserved:',
  '🧢 No cap, just cache:',
  '🍯 Honey, I shrank the paywall:',
  '🍿 Snackable copy here:',
  '🏛️ Shelved in the library of bots:',
  '☎️ Operator, get me the archived edition:',
  '🛸 Beamed up and back down:',
  '🐉 Hoarded in the dragon’s archive:',
  '🎬 Director’s cut, minus the ads:',
  '🧮 Count on this cache:',
  '📡 Signal acquired:',
  '🦖 Fossilized link spotted:',
  '🍕 Fresh slice of article:',
  '🎓 Lesson unlocked:',
  '⚡️ Quick‑charge article dump:',
  '🧳 Packed for long‑term storage:',
  '🪶 Feather‑light reading copy:',
  '🌞 Sun‑dried subscription removed:',
  '🌀 Whirled through the proxy:',
  '🧩 Puzzle solved—here’s the piece:',
  '🌊 Wave‑free surf:',
  '🥷 Ninja‑saved content drop:',
  '🌱 Evergreen edition:',
  '🎱 Behind the eight‑ball? Not anymore:',
  '🤖 Robot retrieved, human approved:',
  '📀 Burned onto the infinite CD:',
  '💃 Samba‑style open link:',
  '🏄 Surf’s up on the archive wave:',
  '⚙️ Gearshifted past paygate:',
  '🧹 Swept the ads away:',
  '🧨 Exploded the paywall doors:',
  '🧙‍♂️ Merlin conjured this copy:',
  '📺 Commercial‑free broadcast:',
  '🔮 Crystal‑clear pay‑free view:',
  '🕹️ Extra life unlocked:',
  '🎢 Paywall roller‑coaster skipped:',
  '🦅 Eagle‑eyed open access:',
  '🍀 Lucky archive strike:',
  '🚒 Firewalled? I brought water:',
  '🎻 Playing the subscription strings:',
  '📸 Flash‑frozen headline:',
  '🏺 Unearthed digital relic:',
  '🪐 Archived across the multiverse:',
  '🧩 Paywall piece removed:',
  '🛡️ Shielded from pop‑ups:',
  '⌛ Delorean delivery, 88 MPH:',
  '🔋 Full‑charged reading mode:',
  '🪄 Ad‑blocker’s final form:',
  '📯 Hear ye, hear ye—free article:',
  '🔗 Chain‑broken content:',
  '🦾 Iron‑clad offline mode:',
  '👾 Debugged and de‑monetized:',
  '🌠 Shooting‑star citation:',
  '🍎 Teacher’s copy, no homework:',
  '🎫 Ticket punched straight through:',
  '🕶️ Matrix link—take the free pill:',
  '🐇 Down the rabbit‑hole we go:',
  '🎈 Balloon‑lifted paygate:',
  '🛀 Ad‑free bubble bath reading:',
  '♻️ Recycled subscription fee to $0:',
  '🚲 Pedaled past the toll booth:',
  '🦋 Butterfly‑effect archive:',
  '🍧 Shaved ice, paywall shaved:',
  '🥁 Drumroll… free content drop:',
  '🚢 Sailed beyond the login sea:',
  '🎮 Cheat code activated: /archive win:',
  '📬 Mailbox delivery, no spam:',
  '🧅 Onion‑layer removed:',
  '🌈 Rainbow‑road to free reads:',
  '🕺 Disco‑inferno of open links:',
  '🎇 Firework splash of info:',
  '🤝 Handshake bypass granted:',
  '🥌 Slid clean across the ice‑wall:',
  '🔦 Flashlight on the hidden text:',
  '🧗 Climbed over the paywall:',
  '🛬 Landed on archive island:',
  '🎤 Mic‑drop, no subscription required:',
  '🍜 Served piping‑hot and free:'
];
const randomQuip = () => QUIPS[Math.floor(Math.random() * QUIPS.length)];
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

/* ----------- Utilities --------------------- */
const normalizeHost = (host) => host.toLowerCase().replace(/^www\./, '');

/**
 * Return true if a host exactly matches or is a sub‑domain of any monitored domain.
 */
const isMonitored = (host) => {
  const h = normalizeHost(host);
  return monitoredDomains.some(d => h === d || h.endsWith(`.${d}`));
};

const urlRegex = /https?:\/\/[^\s<]+/gi;
/* ------------------------------------------- */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

/* ---- DEBUG: log every message if env flag set ---- */
if (process.env.DEBUG_MESSAGES === 'true') {
  client.on('messageCreate', m => {
    const where = m.guild ? `#${m.channel?.name}` : 'DM';
    log(`[DEBUG] ${where} <${m.author.tag}>:`, m.content);
  });
}
/* -------------------------------------------------- */

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
    return interaction.reply(eph('⛔ You need the **Administrator** permission to use this command.'));
  }

  try {
    if (cmd === 'adddomain') {
      const arg = normalizeHost(interaction.options.getString('domain', true));
      if (monitoredDomains.includes(arg)) return interaction.reply(eph(`🔔 **${arg}** is already monitored.`));
      monitoredDomains.push(arg); saveDomains(monitoredDomains);
      return interaction.reply(eph(`✅ Added **${arg}**`));
    }
    if (cmd === 'removedomain') {
      const arg = normalizeHost(interaction.options.getString('domain', true));
      if (!monitoredDomains.includes(arg)) return interaction.reply(eph(`⚠️ **${arg}** wasn’t on the list.`));
      monitoredDomains = monitoredDomains.filter(d => d !== arg); saveDomains(monitoredDomains);
      return interaction.reply(eph(`🗑️ Removed **${arg}**`));
    }
    if (cmd === 'listdomains') {
      const list = monitoredDomains.length ? monitoredDomains.join(', ') : '_(none yet)_';
      return interaction.reply(eph(`📋 **Monitored domains:** ${list}`));
    }
    if (cmd === 'archive') {
      const raw = interaction.options.getString('url', true);
      try { new URL(raw); } catch { return interaction.reply(eph('❌ Invalid URL.')); }
      return interaction.reply({ content: `${randomQuip()}\n${PREFIX}${raw}` });
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

  // Pull every URL out of the message.
  const urls = message.content.match(urlRegex);
  if (!urls) return;

  // Find all URLs whose host is monitored or a sub‑domain of one.
  const matches = urls.filter(raw => {
    try {
      const host = new URL(raw).hostname;
      return isMonitored(host);
    } catch { return false; }
  });

  if (matches.length === 0) return;

  const links = matches.map(u => `${PREFIX}${u}`).join('\n');
  const quip = randomQuip();
  await message.channel.send({ content: `${quip}\n${links}`, reply: { messageReference: message.id } });
});
/* ------------------------------------------- */

/* -------- Global error handlers ------------ */
process.on('unhandledRejection', reason => err('Unhandled promise rejection:', reason));
process.on('uncaughtException', error => err('Uncaught exception:', error));
/* ------------------------------------------- */

client.login(process.env.DISCORD_TOKEN).catch(e => { err('Failed to log in:', e); process.exit(1); });
