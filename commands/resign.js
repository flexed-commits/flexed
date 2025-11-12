 
const { SlashCommandBuilder } = require('discord.js');
const { handleResignAction, getSettingsOrReply } = require('../util/resignBreakLogic');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resign')
        .setDescription('Resign from the staff (removes hierarchy roles, gives resign role).'),

    // --- Slash Command Execution ---
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const settings = await getSettingsOrReply(interaction.guildId, interaction);
        if (!settings) return;

        const result = await handleResignAction(interaction.member, settings, interaction.guild);
        await interaction.editReply(result);
    },

    // --- Button Execution (Called from index.js) ---
    async buttonExecute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const settings = await getSettingsOrReply(interaction.guildId, interaction);
        if (!settings) return;

        const result = await handleResignAction(interaction.member, settings, interaction.guild);
        await interaction.editReply(result);
    },
    
    // --- Prefix Command Execution ---
    async prefixExecute(message, args) {
        // No admin check needed for self-service command
        
        const settings = await getSettingsOrReply(message.guildId, message);
        if (!settings) return;
        
        // message.member is the user running the command
        const result = await handleResignAction(message.member, settings, message.guild);
        await message.reply(result);
    }
};