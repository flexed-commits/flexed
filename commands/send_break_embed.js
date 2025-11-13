const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { getResignBreakSettings } = require('../util/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send_break_embed')
        .setDescription('Sends the interactive Breaks & Resignations embed to the current channel.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // 1. Check if the system is configured 
        const settings = getResignBreakSettings(interaction.guildId);
        if (!settings) {
             return interaction.editReply('The Resign/Break system is not configured. Please ask an administrator to use `/resign-and-break-setup` first.');
        }

        // 2. Define the Embed
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Breaks & Resignations')
            .setDescription('If you want to take a break (≥7 Days) then click on the `Break` button below. And if you want to resign then click on the `Resign` button below.\n\n**Note:** These buttons are active only for members who hold an established hierarchy rank.')
            .setAuthor({ 
                name: 'Ψ.1nOnly.Ψ', 
                url: 'https://discord.com/users/1081876265683927080', 
                iconURL: 'https://cdn.discordapp.com/avatars/1081876265683927080/2537ebc8954961dfc5b0dda504ec2084.webp?size=2048' 
            })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `Current Time & Date: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` })
            .setTimestamp();

        // 3. Define the Buttons
        const breakButton = new ButtonBuilder()
            .setCustomId('break_button')
            .setLabel('Break')
            .setStyle(ButtonStyle.Primary);

        const resignButton = new ButtonBuilder()
            .setCustomId('resign_button')
            .setLabel('Resign')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(breakButton, resignButton);

        // 4. Send the message
        try {
            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.editReply('✅ Breaks & Resignations embed sent successfully to this channel.');
        } catch (error) {
            console.error('Error sending break/resign embed:', error);
            await interaction.editReply('❌ Failed to send the embed. Check bot permissions to send messages and embeds in this channel.');
        }
    },
};