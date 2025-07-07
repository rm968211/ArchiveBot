import {
    Client,
    GatewayIntentBits,
    Partials,
    SlashCommandBuilder,
    REST,
    Routes,
  } from 'discord.js';
  import fs from 'fs';
  import dotenv from 'dotenv';
  dotenv.config();
  
  /* -------- USER SETTINGS ---------- */
  const PREFIX = 'http://archive.ph/newest/'; // what you prepend
  const DATA_FILE = './domains.json';                 // where we store domains
  /* ---------------------------------- */
  
  /* -------- Simple JSON storage ------ */
  function loadDomains() {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];          // first run → file missing
    }
  }
  function saveDomains(list) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
  }
  let monitoredDomains = loadDomains();
  /* ----------------------------------- */
  
  const urlRegex = /https?:\/\/[^\s<]+/gi;
  
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,   // remember to enable in the portal
    ],
    partials: [Partials.Channel],
  });
  
  /* ---------- Slash-command schema ---------- */
  const slashCommands = [
    new SlashCommandBuilder()
      .setName('adddomain')
      .setDescription('Add a domain to the monitored list')
      .addStringOption(o =>
        o.setName('domain').setDescription('example.com').setRequired(true)
      ),
  
    new SlashCommandBuilder()
      .setName('removedomain')
      .setDescription('Remove a domain from the monitored list')
      .addStringOption(o =>
        o.setName('domain').setDescription('example.com').setRequired(true)
      ),
  
    new SlashCommandBuilder()
      .setName('listdomains')
      .setDescription('Show all monitored domains'),
  ].map(cmd => cmd.toJSON());
  /* ------------------------------------------ */
  
  client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
  
    // Register slash commands globally (takes up to 1 hour);  
    // for instant testing use Routes.applicationGuildCommands(client_id, guild_id)
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.application.id), {
      body: slashCommands,
    });
    console.log('🔄 Slash commands registered');
  });
  
  /* ---------- Slash-command logic ---------- */
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    const cmd = interaction.commandName;
    const arg = interaction.options.getString('domain')?.replace(/^www\./, '');
  
    if (cmd === 'adddomain') {
      if (monitoredDomains.includes(arg)) {
        return interaction.reply({ content: `🔔 **${arg}** is already monitored.`, ephemeral: true });
      }
      monitoredDomains.push(arg);
      saveDomains(monitoredDomains);
      return interaction.reply({ content: `✅ Added **${arg}**`, ephemeral: true });
    }
  
    if (cmd === 'removedomain') {
      if (!monitoredDomains.includes(arg)) {
        return interaction.reply({ content: `⚠️ **${arg}** wasn’t on the list.`, ephemeral: true });
      }
      monitoredDomains = monitoredDomains.filter(d => d !== arg);
      saveDomains(monitoredDomains);
      return interaction.reply({ content: `🗑️ Removed **${arg}**`, ephemeral: true });
    }
  
    if (cmd === 'listdomains') {
      const list = monitoredDomains.length
        ? monitoredDomains.join(', ')
        : '_(none yet)_';
      return interaction.reply({ content: `📋 **Monitored domains:** ${list}`, ephemeral: true });
    }
  });
  /* ----------------------------------------- */
  
  /* ---------- Link-watching logic ----------- */
  client.on('messageCreate', async message => {
    if (message.author.bot || !message.content) return;
  
    const urls = message.content.match(urlRegex);
    if (!urls) return;
  
    const matches = urls.filter(raw => {
      try {
        const host = new URL(raw).hostname.replace(/^www\./, '');
        return monitoredDomains.includes(host);
      } catch {
        return false;
      }
    });
    if (matches.length === 0) return;
  
    const response = matches.map(u => `${PREFIX}${u}`).join('\n');
    await message.channel.send({
      content: response,
      reply: { messageReference: message.id },
    });
  });
  /* ----------------------------------------- */
  
  client.login(process.env.DISCORD_TOKEN);
  