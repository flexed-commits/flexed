const { SlashCommandBuilder } = require('discord.js');
const { handleResignAction, getSettingsAndValidate } = require('../util/resignBreakLogic'); // **UPDATED FUNCTION NAME**

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resign')
        .setDescription('Resign from the staff (removes hierarchy roles, gives resign role).'),

    // --- Slash Command Execution ---
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Use the corrected function name
        const settings = await getSettingsAndValidate(interaction.guildId, interaction);
        if (!settings) return;

        const result = await handleResignAction(interaction.member, settings, interaction.guild, interaction);
        await interaction.editReply(result);
    },

    // --- Button Execution (Called from index.js) ---
    async buttonExecute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Use the corrected function name
        const settings = await getSettingsAndValidate(interaction.guildId, interaction);
        if (!settings) return;

        const result = await handleResignAction(interaction.member, settings, interaction.guild, interaction);
        await interaction.editReply(result);
    },
    
    // --- Prefix Command Execution ---
    async prefixExecute(message, args) {
        // message is passed as 'source' for prefix commands
        const settings = await getSettingsAndValidate(message.guildId, message);
        if (!settings) return;
        
        const result = await handleResignAction(message.member, settings, message.guild, message);
        await message.reply(result);
    }
};