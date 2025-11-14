/**
 * Utility functions to manage command execution logic, keeping index.js clean.
 */

const { handleBreakAction, handleResignAction, handleComebackRequest, handleApproveComeback, getSettingsAndValidate } = require('./resignBreakLogic');
const { getHierarchyRank, getHierarchyRoles } = require('./db');
const { promoteUser, demoteUser, hireUser, fireUser } = require('./roleLogic');
const { PermissionsBitField } = require('discord.js');

/**
 * Handles the execution logic for button interactions (Break, Resign, Comeback).
 * This function is called from the main index.js interactionCreate event.
 * * @param {ButtonInteraction} interaction The interaction object.
 * @param {Client} client The Discord client instance.
 */
async function buttonExecute(interaction, client) {
    if (!interaction.inGuild()) {
        return interaction.reply({ content: 'These actions must be performed in a server.', ephemeral: true });
    }

    // Defer the reply right away, especially for comeback requests which hit the DB
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    const guild = interaction.guild;
    const customId = interaction.customId;

    if (customId === 'break_button' || customId === 'resign_button') {
        const settings = await getSettingsAndValidate(guild.id, interaction);
        if (!settings) return; // Validation failed, error message already sent

        // The ephemeral reply logic is handled inside the action functions
        let replyContent;
        if (customId === 'break_button') {
            replyContent = await handleBreakAction(member, settings, guild, interaction);
        } else if (customId === 'resign_button') {
            replyContent = await handleResignAction(member, settings, guild, interaction);
        }
        
        await interaction.editReply({ content: replyContent, ephemeral: true });

    } else if (customId === 'comeback_request') {
        // This is sent in the user's DM and doesn't rely on guild settings for validation
        // The logic file will handle fetching context and validation
        await handleComebackRequest(interaction); 

    } else if (customId.startsWith('approve_comeback_')) {
        // Admin approval button - only available in the admin channel
        const settings = await getSettingsAndValidate(guild.id, interaction);
        if (!settings) return; 

        // Check if the interaction is in the configured admin channel
        if (interaction.channelId !== settings.admin_channel) {
             return interaction.editReply({ content: 'This action can only be taken in the designated Admin Channel.', ephemeral: true });
        }
        
        await handleApproveComeback(interaction, settings);
    } else {
         await interaction.editReply({ content: 'Unknown button action.', ephemeral: true });
    }
}


/**
 * Core logic for handling promote/demote/hire/fire commands for both slash and prefix.
 * @param {string} commandName The name of the command ('promote', 'demote', 'hire', 'fire').
 * @param {GuildMember} targetMember The member being targeted.
 * @param {Interaction|Message} source The interaction or message object.
 * @param {string} guildId The ID of the guild.
 * @returns {Promise<string>} The status message.
 */
async function handleHierarchyAction(commandName, targetMember, source, guildId) {
    const hierarchy = getHierarchyRoles(guildId);
    if (!hierarchy || hierarchy.length === 0) {
        return "❌ Hierarchy roles are not set up. Please use `/role-hierarchy-setup` first.";
    }

    let statusMessage = '';

    switch (commandName) {
        case 'promote':
            statusMessage = await promoteUser(targetMember, hierarchy, source);
            break;
        case 'demote':
            statusMessage = await demoteUser(targetMember, hierarchy, source);
            break;
        case 'hire':
            statusMessage = await hireUser(targetMember, hierarchy, source);
            break;
        case 'fire':
            statusMessage = await fireUser(targetMember, hierarchy, source);
            break;
        default:
            statusMessage = `Unknown hierarchy action: ${commandName}`;
    }

    return statusMessage;
}


module.exports = {
    buttonExecute,
    handleHierarchyAction,
};