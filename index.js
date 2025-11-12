// Discord.js v14 Bot Client Setup
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, IntentsBitField, Collection, REST, Routes, PermissionsBitField } = require('discord.js');
const { getResignBreakSettings } = require('./util/db');
const { handleComebackRequest, handleApproveComeback } = require('./util/resignBreakLogic');

// Define the bot's prefix
const PREFIX = '!';

const client = new Client({
    intents: [
        // Required for reading messages and prefix commands
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        // Required for interactions (slash commands, buttons) and guild information
        IntentsBitField.Flags.Guilds,
        // Required for managing roles (promote/demote, break/resign)
        IntentsBitField.Flags.GuildMembers,
        // Required for DMs
        IntentsBitField.Flags.DirectMessages,
    ],
    partials: ['CHANNEL'], // Required for receiving DMs
});

client.commands = new Collection();
const commands = []; // Array for storing slash command data for registration

const commandsPath = path.join(__dirname, 'commands');

// Load command files dynamically
try {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // Ensure command structure is valid
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
} catch (error) {
    console.error("Could not load commands folder. Ensure './commands' directory exists.", error);
}


// --- SLASH COMMAND REGISTRATION ---
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const CLIENT_ID = client.user.id;
    const REST_CLIENT = new REST().setToken(process.env.DISCORD_TOKEN);

    // Register commands globally
    (async () => {
        try {
            console.log(`Started refreshing ${commands.length} application (/) commands.`);

            const data = await REST_CLIENT.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands },
            );

            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            console.error(error);
        }
    })();
});


// --- INTERACTION HANDLER (Slash Commands & Buttons) ---

client.on('interactionCreate', async interaction => {
    // Handle Chat Input Commands (Slash Commands)
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const errorMessage = 'There was an error while executing this command!';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    } 
    
    // Handle Button Interactions
    else if (interaction.isButton()) {
        // Ensure we have a guild, which is required for all these actions
        if (!interaction.guild && !interaction.customId.startsWith('comeback_request')) {
            return interaction.reply({ content: 'This action must be performed within a server.', ephemeral: true });
        }
        
        const customId = interaction.customId;
        const settings = getResignBreakSettings(interaction.guildId);

        if (customId === 'break_button' || customId === 'resign_button') {
            const command = client.commands.get(customId === 'break_button' ? 'break' : 'resign');
            
            // We use the same command execute logic, but pass the interaction type
            if (command && 'buttonExecute' in command) {
                 try {
                    // buttonExecute will handle the deferring/replying
                    await command.buttonExecute(interaction);
                 } catch (error) {
                    console.error(error);
                    interaction.reply({ content: 'There was an error processing your request.', ephemeral: true });
                 }
            }
        } else if (customId === 'comeback_request') {
             // This button is always in a DM, so guildId is null. We need to fetch settings from a known guild or handle without.
             // For simplicity, we assume the user is only in one server using this bot, or they use the same settings.
             // The resignation process is tied to the guildId (server). Since we can't reliably get the guildId from a DM button interaction, 
             // the logic uses the saved data tied to the user. We assume the client can fetch the guild from the settings inside the logic.
             // But for the simple structure, we must pass the settings object which only contains settings for ONE guild.
             // A true multi-guild bot would require the user to specify the guild in the DM, or store guild context in user_data.
             
             // Since we can't reliably get guildId from DM: we pass a null settings and let the logic handle finding data.
             await handleComebackRequest(interaction, settings);
             
        } else if (customId.startsWith('approve_comeback_')) {
            if (settings) {
                await handleApproveComeback(interaction, settings);
            } else {
                 await interaction.reply({ content: 'The system is not configured. Please contact an admin.', ephemeral: true });
            }
        }
    }
});

// --- MESSAGE HANDLER (Prefix Commands) ---

client.on('messageCreate', async message => {
    // Ignore bots or messages without the prefix
    if (!message.content.startsWith(PREFIX) || message.author.bot || !message.guild) return;

    // Remove prefix and split the message content into command and arguments
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Find the command object
    const command = client.commands.get(commandName);

    // If a command exists and has a custom 'prefixExecute' handler 
    if (command && 'prefixExecute' in command) {
         // Check permissions (e.g., if the command requires administrative rights)
        // Only check for admin if it's NOT a self-service command like break or resign
        if (commandName !== 'break' && commandName !== 'resign' && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ content: 'You need the Administrator permission to run this command.', ephemeral: true });
        }

        try {
            // Pass the message object and arguments to the command's prefix handler
            await command.prefixExecute(message, args);
        } catch (error) {
            console.error(error);
            message.reply('There was an error trying to execute that command!');
        }
    }
});


// Login to Discord
client.login(process.env.DISCORD_TOKEN);