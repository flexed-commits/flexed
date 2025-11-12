const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { setResignBreakSettings } = require('../util/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resign-and-break-setup')
        .setDescription('Sets up roles and channels required for the break and resignation system.')
        .addRoleOption(option =>
            option.setName('break_role')
                .setDescription('The role given to members on break.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('resign_role')
                .setDescription('The role given to members who resign.')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('break_and_resign_channel')
                .setDescription('The channel where breaks/resignations are announced publicly.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('admin_channel')
                .setDescription('The channel where comeback requests are announced privately to admins.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // 1. Collect options
        const breakRole = interaction.options.getRole('break_role');
        const resignRole = interaction.options.getRole('resign_role');
        const breakResignChannel = interaction.options.getChannel('break_and_resign_channel');
        const adminChannel = interaction.options.getChannel('admin_channel');

        // Check bot permissions (can the bot manage these roles?)
        if (!breakRole.editable || !resignRole.editable) {
            return interaction.editReply('Error: I cannot manage one or both of the selected roles. Ensure my role is higher than the break and resign roles.');
        }

        // 2. Save settings
        const settings = {
            break_role: breakRole.id,
            resign_role: resignRole.id,
            break_resign_channel: breakResignChannel.id,
            admin_channel: adminChannel.id,
        };

        setResignBreakSettings(interaction.guildId, settings);

        // 3. Confirmation
        await interaction.editReply({
            content: `**✅ Resign/Break System Setup Complete!**\n\nSettings saved:\n- Break Role: ${breakRole}\n- Resign Role: ${resignRole}\n- Public Channel: ${breakResignChannel}\n- Admin Channel: ${adminChannel}`,
        });
    }
};