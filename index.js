const { Client, GatewayIntentBits, Partials, ActivityType, Collection, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { prefixExecute, buttonExecute } = require('./util/commandRunner');
const { readData, isGuildSetup } = require('./util/db'); // <-- CORRECTED IMPORT

// Load environment variables from .env file
require('dotenv').config();

// --- Configuration ---
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '!'; 
const TARGET_GUILD_ID = '1349281907765936188'; // The server ID to stay in

// Initialize Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();
client.prefixCommands = new Collection();

// --- Command Loading ---

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
    
    // Also store for prefix handling if prefixExecute is present
    if (command.prefixExecute) {
        client.prefixCommands.set(command.data.name, command);
    }
}

// --- Permissions Setup Function ---

/**
 * Ensures the bot has necessary permissions in all channels and specifically in the setup channels.
 * @param {Guild} guild The target guild object.
 */
async function setupChannelPermissions(guild) {
    console.log('[PERMS] Starting channel permission setup...');
    const botMember = await guild.members.fetch(client.user.id);
    if (!botMember) {
        console.error('[PERMS] Failed to fetch bot member.');
        return;
    }

    // Use the correctly imported readData function
    const settings = await readData();
    const guildSettings = settings.resign_break_settings[guild.id];

    // 1. Grant View Channel Permission in ALL Channels
    console.log('[PERMS] Granting bot ViewChannel permissions across all channels...');
    const channels = await guild.channels.fetch();

    for (const [id, channel] of channels) {
        if (!channel || channel.deleted) continue;
        
        try {
            // Check current permissions to avoid unnecessary updates
            const currentPerms = channel.permissionsFor(botMember);
            if (!currentPerms || currentPerms.has(PermissionsBitField.Flags.ViewChannel)) {
                continue;
            }

            await channel.permissionOverwrites.edit(botMember.id, {
                [PermissionsBitField.Flags.ViewChannel]: true,
            });
            console.log(`[PERMS] Set ViewChannel for bot in: #${channel.name}`);
        } catch (error) {
            // We ignore errors here as it might be trying to access restricted channels
        }
    }
    console.log('[PERMS] Finished granting bot ViewChannel permissions.');

    // 2. Set Specific Permissions for Setup Channels
    if (guildSettings) {
        const requiredChannelPerms = [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.EmbedLinks,
            PermissionsBitField.Flags.AddReactions,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageRoles // Necessary for handling promotion/demotion/breaks etc.
        ];

        const channelMap = {
            'Break/Resign Channel': guildSettings.break_resign_channel,
            'Public Announce Channel': guildSettings.public_announce_channel,
            'Admin Channel': guildSettings.admin_channel,
        };

        for (const [name, channelId] of Object.entries(channelMap)) {
            try {
                const channel = await guild.channels.fetch(channelId);
                if (!channel) {
                    console.warn(`[PERMS] Configured ${name} (${channelId}) not found. Skipping.`);
                    continue;
                }
                
                // Set the minimum required permissions
                await channel.permissionOverwrites.edit(botMember.id, {
                    [PermissionsBitField.Flags.ViewChannel]: true,
                    [PermissionsBitField.Flags.SendMessages]: true,
                    [PermissionsBitField.Flags.EmbedLinks]: true,
                });
                console.log(`[PERMS] Set necessary R/W permissions for bot in ${name}: #${channel.name}`);

            } catch (error) {
                console.error(`[PERMS] ERROR setting permissions for ${name}:`, error.message);
            }
        }
    } else {
        console.warn('[PERMS] Resign/Break settings not found in database. Skipping specific channel perms.');
    }
    console.log('[PERMS] Channel permission setup complete.');
}


// --- Status and Presence Update Function ---

/**
 * Sets the bot's custom activity/presence.
 * @param {string} memberCount The member count to display in the status.
 */
function updatePresence(memberCount) {
    const activityName = memberCount 
        ? `Watching Shivam’s Discord | ${memberCount} Members` 
        : `Watching Shivam’s Discord`;
        
    client.user.setPresence({
        activities: [{ 
            name: activityName, 
            type: ActivityType.Watching 
        }],
        status: 'online',
    });
    console.log(`Presence updated: ${activityName}`);
}

// --- Events ---

client.once('ready', async () => {
    console.log(`Bot is ready! Logged in as ${client.user.tag}`);
    
    // Attempt to fetch the guild to ensure it's in the cache
    const guild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
    
    let memberCount = '';

    if (guild) {
        console.log(`Target Guild found: ${guild.name}`);
        try {
            // Run permissions setup FIRST
            await setupChannelPermissions(guild);

            await guild.members.fetch(); // Ensure member cache is full
            memberCount = guild.memberCount.toLocaleString();

        } catch (error) {
            console.error('Failed to fetch guild members or run permissions setup (Check bot permissions and role hierarchy position):', error);
        }
    } else {
        console.error(`Target Guild ID ${TARGET_GUILD_ID} not found in bot's guilds. Make sure the bot is invited.`);
    }

    updatePresence(memberCount);

    // 2. Set Interval to Update Presence (e.g., every hour)
    // Only run if the guild was found
    if (guild) {
        setInterval(async () => {
            await guild.members.fetch();
            const newMemberCount = guild.memberCount.toLocaleString();
            updatePresence(newMemberCount);
        }, 3600000); // 1 hour

        // 3. Register Slash Commands
        const commandsData = client.commands.map(command => command.data.toJSON());
        try {
            await client.application.commands.set(commandsData, TARGET_GUILD_ID);
            console.log(`Successfully registered ${commandsData.length} slash commands to guild ${TARGET_GUILD_ID}.`);
        } catch (error) {
            console.error("Failed to register slash commands:", error);
        }
    }
});

// Enforce single-server presence
client.on('guildCreate', async guild => {
    if (guild.id !== TARGET_GUILD_ID) {
        console.log(`Joined unauthorized guild: ${guild.name} (${guild.id}). Leaving...`);
        try {
            await guild.leave();
            console.log(`Successfully left guild ${guild.name}.`);
        } catch (error) {
            console.error(`Failed to leave guild ${guild.name}:`, error);
        }
    }
});

// Handle Slash Commands and Buttons
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => {});
            }
        }
    } 
    
    // Handle Button Interactions
    if (interaction.isButton()) {
        await buttonExecute(interaction, client);
    }
});

// Handle Prefix Commands
client.on('messageCreate', async message => {
    if (!message.content.startsWith(PREFIX) || message.author.bot || !message.guild) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = message.client.prefixCommands.get(commandName);

    if (!command) return;
    
    try {
        await command.prefixExecute(message, args);
    } catch (error) {
        console.error(`Error executing prefix command ${commandName}:`, error);
        await message.reply('There was an error while executing this command!').catch(() => {});
    }
});

// Log in to Discord with your client's token
client.login(TOKEN);
