const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readData, isGuildSetup } = require('../util/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resign')
        .setDescription('Submits a resignation request.')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for your resignation.')
                .setRequired(true)),
    
    // Prefix command is not implemented for complex workflow like this
    // prefixExecute is omitted here.

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const { guild, user, options } = interaction;
        const reason = options.getString('reason');
        const guildId = guild.id;

        if (!await isGuildSetup(guildId)) {
            return interaction.editReply('❌ Bot settings are incomplete. Please contact an administrator to run `/setup`.');
        }

        const data = await readData();
        const settings = data.resign_break_settings[guildId];

        try {
            const requestsChannel = await guild.channels.fetch(settings.break_resign_channel);

            if (!requestsChannel) {
                return interaction.editReply('❌ The resignation channel is invalid. Please contact an administrator.');
            }

            // 1. Construct Embed for Admin Channel
            const resignEmbed = new EmbedBuilder()
                .setTitle(`⚠️ Resignation Request from ${user.tag}`)
                .setDescription(`A user has submitted a request to resign.`)
                .addFields(
                    { name: 'User', value: `${user} (${user.id})`, inline: true },
                    { name: 'Time', value: new Date().toUTCString(), inline: true },
                    { name: 'Reason', value: reason }
                )
                .setColor(0xFFA500);

            // 2. Construct Buttons for Admin Action
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`process_resign_${user.id}`)
                        .setLabel('Process Resignation')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`deny_request_${user.id}`)
                        .setLabel('Deny / Ask for Details')
                        .setStyle(ButtonStyle.Secondary),
                );

            // 3. Send message to the private requests channel
            await requestsChannel.send({
                content: `<@&${settings.admin_channel}> New resignation request!`,
                embeds: [resignEmbed],
                components: [row]
            });

            // 4. Confirm to the user
            await interaction.editReply({ 
                content: `✅ Your resignation request has been submitted to the staff channel <#${settings.break_resign_channel}>. You will be notified when it is processed.`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error processing resignation request:', error);
            await interaction.editReply('❌ An error occurred while submitting your request. Check channel permissions.');
        }
    },
};
