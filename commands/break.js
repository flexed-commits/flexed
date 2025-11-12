const { SlashCommandBuilder } = require('discord.js');
const { handleBreakAction, getSettingsOrReply } = require('../util/resignBreakLogic');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('break')
        .setDescription('Take a break (gives the break role, announces it).'),

    // --- Slash Command Execution ---
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const settings = await getSettingsOrReply(interaction.guildId, interaction);
        if (!settings) return;

        const result = await handleBreakAction(interaction.member, settings, interaction.guild);
        await interaction.editReply(result);
    },

    // --- Button Execution (Called from index.js) ---
    async buttonExecute(interaction) {
        await interaction.deferReply({ ephemeral: true }); 

        const settings = await getSettingsOrReply(interaction.guildId, interaction);
        if (!settings) return;

        const result = await handleBreakAction(interaction.member, settings, interaction.guild);
        await interaction.editReply(result);
    },
    
    // --- Prefix Command Execution ---
    async prefixExecute(message, args) {
        // No admin check needed for self-service command
        
        const settings = await getSettingsOrReply(message.guildId, message);
        if (!settings) return;
        
        // message.member is the user running the command
        const result = await handleBreakAction(message.member, settings, message.guild);
        await message.reply(result);
    }
};