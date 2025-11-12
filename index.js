// Discord.js v14 Bot Client Setup
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, IntentsBitField, Collection, REST, Routes, PermissionsBitField } = require('discord.js');

// Define the bot's prefix
const PREFIX = '!';

const client = new Client({
    intents: [
        // Required for reading messages and prefix commands
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        // Required for interactions (slash commands) and guild information
        IntentsBitField.Flags.Guilds,
        // Required for managing roles (promote/demote)
        IntentsBitField.Flags.GuildMembers,
    ],
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

            // The following registers commands globally. Use Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) 
            // for development/testing in a single guild to avoid waiting for global deployment.
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


// --- COMMAND HANDLER (Slash & Prefix) ---

// Interaction Handler (Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

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
});

// Message Handler (Prefix Commands)
client.on('messageCreate', async message => {
    // Ignore bots or messages without the prefix
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    // Remove prefix and split the message content into command and arguments
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Find the command object
    const command = client.commands.get(commandName);

    // If a command exists and has a custom 'prefixExecute' handler (which all your role commands will have)
    if (command && 'prefixExecute' in command) {
         // Check permissions (e.g., if the command requires administrative rights)
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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