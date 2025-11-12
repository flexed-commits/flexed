const { getHierarchyRoles, getResignBreakSettings, saveUserHierarchyAndRoles, getUserHierarchyAndRoles, deleteUserResignationData } = require('./db');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

/**
 * Fetches required settings and checks if the system is configured.
 */
async function getSettingsOrReply(guildId, source) {
    const settings = getResignBreakSettings(guildId);
    if (!settings) {
        const isInteraction = 'isChatInputCommand' in source || 'isButton' in source;
        const msg = 'The Resign/Break system is not configured. Please ask an administrator to use `/resign-and-break-setup` first.';
        
        if (isInteraction) {
            await (source.editReply ? source.editReply(msg) : source.reply({ content: msg, ephemeral: true }));
        } else {
            await source.reply(msg);
        }
        return null;
    }
    return settings;
}

/**
 * Handles the "Break" action logic (giving break role, announcing, DMing).
 */
async function handleBreakAction(member, settings, guild) {
    const breakRole = guild.roles.cache.get(settings.break_role);
    const publicChannel = guild.channels.cache.get(settings.break_resign_channel);

    if (!breakRole || !publicChannel) {
        return `Error: Break role or public channel not found. Please re-run the setup command.`;
    }
    
    // Check if user is already on break
    if (member.roles.cache.has(breakRole.id)) {
        return `🚫 ${member.user.tag} is already on break.`;
    }

    try {
        await member.roles.add(breakRole, 'Member taking a break.');

        // 1. DM the user
        await member.send({
            content: `👋 You have successfully been placed on break in **${guild.name}**. The **${breakRole.name}** role has been applied. We hope you have a refreshing time and look forward to your return!`
        }).catch(() => console.log(`Could not DM ${member.user.tag}`));

        // 2. Announce in public channel
        const publicEmbed = new EmbedBuilder()
            .setColor(0xFFA500) // Orange
            .setTitle('⏳ Member Break')
            .setDescription(`${member} has taken a break (≥7 days). We wish them well!`)
            .setTimestamp();
            
        await publicChannel.send({ embeds: [publicEmbed] });
        
        return `✅ ${member.user.tag} is now on break. DM confirmation sent and announced.`;
    } catch (error) {
        console.error('Error during break action:', error);
        return `❌ An error occurred while trying to add the role or send the announcement. Check bot permissions.`;
    }
}


/**
 * Handles the "Resign" action logic (removing hierarchy roles, giving resign role, saving roles, announcing).
 */
async function handleResignAction(member, settings, guild) {
    const resignRole = guild.roles.cache.get(settings.resign_role);
    const hierarchyIds = getHierarchyRoles(guild.id);
    const publicChannel = guild.channels.cache.get(settings.break_resign_channel);
    const adminChannel = guild.channels.cache.get(settings.admin_channel);

    if (!resignRole || !publicChannel || !adminChannel) {
        return `Error: One or more required roles/channels not found. Please re-run the setup command.`;
    }
    
    // Check if user is already resigned
    if (member.roles.cache.has(resignRole.id)) {
        return `🚫 ${member.user.tag} is already resigned.`;
    }
    
    // 1. Identify roles to save
    const rolesToSave = [];
    if (hierarchyIds) {
        for (const roleId of hierarchyIds) {
            if (member.roles.cache.has(roleId)) {
                rolesToSave.push(roleId);
            }
        }
    }
    
    // 2. Remove hierarchy roles and apply resign role
    try {
        const rolesToRemove = rolesToSave; // Only remove the ones we found
        if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove, 'Member resigned: Removing hierarchy roles.');
        }
        await member.roles.add(resignRole, 'Member resigned: Applying resign role.');
        
        // 3. Announce in public channel
        const publicEmbed = new EmbedBuilder()
            .setColor(0xDC143C) // Red
            .setTitle('💔 Member Resignation')
            .setDescription(`${member} has resigned. We thank them for their service!`)
            .setTimestamp();
            
        await publicChannel.send({ embeds: [publicEmbed] });
        
        // 4. DM the user with comeback button
        const comebackButton = new ButtonBuilder()
            .setCustomId('comeback_request')
            .setLabel('Inform Comeback') // Changed label for better clarity
            .setStyle(ButtonStyle.Primary);
            
        const row = new ActionRowBuilder().addComponents(comebackButton);
        
        let dmMessage;
        try {
             dmMessage = await member.send({
                content: `😭 You have successfully resigned from **${guild.name}**. The **${resignRole.name}** role has been applied, and your hierarchy roles have been removed.\n\nTo inform your comeback and request your previous roles restored, click the button below.`,
                components: [row]
            });
        } catch (e) {
            console.log(`Could not DM ${member.user.tag}, skipping button disable feature.`);
        }

        // 5. Save roles to DB
        // Pass the guildId here to contextually handle the comeback request later
        saveUserHierarchyAndRoles(member.id, rolesToSave, dmMessage ? dmMessage.id : null, guild.id);
        
        return `✅ ${member.user.tag} has resigned. DM confirmation sent with comeback button.`;
        
    } catch (error) {
        console.error('Error during resign action:', error);
        return `❌ An error occurred while trying to manage roles or send the announcement. Check bot permissions.`;
    }
}


/**
 * Handles the "Inform Comeback" button clicked by the user (sent in DM).
 */
async function handleComebackRequest(interaction) {
    // The user clicked this button in a DM, so guild context is missing.
    // We must rely on the data saved in the DB.
    
    const userData = getUserHierarchyAndRoles(interaction.user.id);
    
    if (!userData || !userData.guild_id) {
         return interaction.reply({ content: 'Error: I cannot find your previous role data or server context. Please contact an admin directly.', ephemeral: true });
    }
    
    // Fetch the guild based on the saved context
    const guild = interaction.client.guilds.cache.get(userData.guild_id);
    if (!guild) {
        return interaction.reply({ content: 'Error: I am no longer in the server you resigned from. Please contact an admin.', ephemeral: true });
    }
    
    const settings = getResignBreakSettings(userData.guild_id);
    if (!settings || !settings.admin_channel) {
         return interaction.reply({ content: 'Error: Admin channel not configured in the server. Please contact an admin to check the setup.', ephemeral: true });
    }
    
    const adminChannel = guild.channels.cache.get(settings.admin_channel);
    
    if (!adminChannel) {
         return interaction.reply({ content: 'Error: Admin channel not found. It might have been deleted. Please contact an admin to check the setup.', ephemeral: true });
    }
    
    await interaction.deferReply({ ephemeral: true });

    // 1. Disable the button in the user's DM
    const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(interaction.component).setDisabled(true).setLabel('Comeback Requested')
    );
    // Only attempt to edit if we saved a message ID
    if (userData.comeback_request_message_id) {
        await interaction.message.edit({ components: [disabledRow] }).catch(e => console.error("Could not disable comeback button:", e));
    }
    
    // 2. Send the approval request to the Admin Channel
    const approveButton = new ButtonBuilder()
        // Use a unique ID to identify the action and the user
        .setCustomId(`approve_comeback_${interaction.user.id}`)
        .setLabel('Approve Comeback')
        .setStyle(ButtonStyle.Success);
        
    const row = new ActionRowBuilder().addComponents(approveButton);
    
    const adminEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Green
        .setTitle('⬆️ Comeback Request')
        .setDescription(`**${interaction.user.tag}** (${interaction.user.id}) has requested to return to staff/rank structure in **${guild.name}**.`)
        .addFields(
            { name: 'Previous Roles Saved', value: userData.saved_roles.length > 0 ? userData.saved_roles.map(id => `<@&${id}>`).join(', ') : 'None', inline: false },
            { name: 'Action', value: 'Click the button below to restore their roles and remove the resign role.', inline: false }
        )
        .setTimestamp();
        
    await adminChannel.send({ embeds: [adminEmbed], components: [row] });
    
    // 3. Confirm to user
    await interaction.editReply({ content: 'Your comeback request has been sent to the Administration team. You will be notified when it is approved.' });
}


/**
 * Handles the "Approve Comeback" button clicked by an administrator.
 */
async function handleApproveComeback(interaction, settings) {
    // 1. Admin Permission Check
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'You must be an administrator to approve a comeback.', ephemeral: true });
    }
    
    await interaction.deferReply({ ephemeral: true });

    // 2. Extract target user ID from the custom ID
    const targetUserId = interaction.customId.split('_')[2];
    const guild = interaction.guild;
    
    let targetMember;
    try {
        targetMember = await guild.members.fetch(targetUserId);
    } catch (e) {
        return interaction.editReply(`Error: Could not find user with ID ${targetUserId} in this server. They may have left.`);
    }

    const userData = getUserHierarchyAndRoles(targetUserId);

    if (!userData) {
        return interaction.editReply(`Error: Role data for ${targetMember.user.tag} was not found. They might have been approved already or data was lost.`);
    }

    const resignRole = guild.roles.cache.get(settings.resign_role);
    const rolesToRestore = userData.saved_roles;

    // 3. Modify Roles
    try {
        // Remove resign role
        if (targetMember.roles.cache.has(resignRole.id)) {
            await targetMember.roles.remove(resignRole, 'Comeback approved: Removing resign role.');
        }

        // Add back saved roles
        if (rolesToRestore && rolesToRestore.length > 0) {
            await targetMember.roles.add(rolesToRestore, 'Comeback approved: Restoring previous hierarchy roles.');
        }
        
        // 4. Clean up DB and Interaction
        deleteUserResignationData(targetUserId);
        
        // Disable the button in the admin channel
        const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(interaction.component).setDisabled(true).setLabel('Comeback Approved')
        );
        await interaction.message.edit({ components: [disabledRow] });
        
        // 5. DM the user about approval
        await targetMember.send({
            content: `🎉 Your comeback request in **${guild.name}** has been approved by ${interaction.user.tag}! Your previous roles have been restored.`
        }).catch(() => console.log(`Could not DM ${targetMember.user.tag}`));
        
        await interaction.editReply(`✅ Successfully approved comeback for **${targetMember.user.tag}**. Roles restored and user DMed.`);
        
    } catch (error) {
        console.error('Error during comeback approval:', error);
        return interaction.editReply(`❌ An error occurred while managing roles for comeback. Check bot permissions. Error: ${error.message}`);
    }
}


module.exports = {
    handleBreakAction,
    handleResignAction,
    handleComebackRequest,
    handleApproveComeback,
    getSettingsOrReply
};