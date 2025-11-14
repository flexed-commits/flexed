const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setupChannelPermissions } = require('../util/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fixperms')
        .setDescription('Forces the bot to check and correct its channel permissions across the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    // Prefix command execution
    async prefixExecute(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: 'You must be an administrator to run this command.', ephemeral: true });
        }
        await message.deferReply({ ephemeral: true });
        const result = await setupChannelPermissions(message.guild, message.client);
        await message.editReply({ content: result });
    },

    // Slash command execution
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const result = await setupChannelPermissions(interaction.guild, interaction.client);
        
        await interaction.editReply({ content: result });
    },
};
