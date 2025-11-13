const { getHierarchyRoles, getResignBreakSettings, saveUserHierarchyAndRoles, getUserHierarchyAndRoles, deleteUserResignationData } = require('./db');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

/**
 * Checks if required settings exist and fetches the actual Guild objects.
 * @param {string} guildId The ID of the guild.
 * @param {object} source The Message or Interaction object for replying.
 * @returns {Promise<object|null>} The enriched settings object or null if not configured/missing components.
 */
async function getSettingsAndValidate(guildId, source) {
    const settings = getResignBreakSettings(guildId);
    if (!settings) {
        const msg = 'The Resign/Break system is not configured. Please ask an administrator to use `/resign-and-break-setup` first.';
        await (source.editReply ? source.editReply(msg) : source.reply({ content: msg, ephemeral: true }));
        return null;
    }

    const guild = source.guild || await source.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null; // Should not happen in command/button context

    const missingComponents = [];
    const enrichedSettings = { ...settings };

    // Validate Roles
    enrichedSettings.breakRole = guild.roles.cache.get(settings.break_role);
    if (!enrichedSettings.breakRole) missingComponents.push({ type: 'Role', name: 'Break Role' });
    
    enrichedSettings.resignRole = guild.roles.cache.get(settings.resign_role);
    if (!enrichedSettings.resignRole) missingComponents.push({ type: 'Role', name: 'Resign Role' });

    // Validate Channels
    enrichedSettings.publicChannel = guild.channels.cache.get(settings.break_resign_channel);
    if (!enrichedSettings.publicChannel) missingComponents.push({ type: 'Channel', name: 'Breaks/Resign Channel', id: settings.break_resign_channel });
    
    enrichedSettings.adminChannel = guild.channels.cache.get(settings.admin_channel);
    if (!enrichedSettings.adminChannel) missingComponents.push({ type: 'Channel', name: 'Admin Channel', id: settings.admin_channel });

    if (missingComponents.length > 0) {
        let replyMsg = '⚠️ **Configuration Error:** One or more components from the setup are missing from the server:\n';
        missingComponents.forEach(comp => {
            if (comp.id) {
                 replyMsg += `\n- The ${comp.name} was found in the database but is missing from the server (ID: \`${comp.id}\`).`;
            } else {
                 replyMsg += `\n- The ${comp.name} is missing.`;
            }
        });
        replyMsg += '\nPlease re-run `/resign-and-break-setup`.';
        
        await (source.editReply ? source.editReply(replyMsg) : source.reply({ content: replyMsg, ephemeral: true }));
        return null;
    }

    return enrichedSettings;
}

/**
 * Checks if the member has any role from the saved hierarchy.
 * @param {GuildMember} member The member to check.
 * @param {string} guildId The ID of the guild.
 * @returns {boolean} True if the member has a hierarchy role, false otherwise.
 */
function hasHierarchyRole(member, guildId) {
    const hierarchyIds = getHierarchyRoles(guildId);
    if (!hierarchyIds || hierarchyIds.length === 0) return false;
    
    return hierarchyIds.some(roleId => member.roles.cache.has(roleId));
}


/**
 * Handles the "Break" action logic (giving break role, announcing, DMing).
 */
async function handleBreakAction(member, settings, guild, source) {
    const hierarchyCheck = hasHierarchyRole(member, guild.id);

    if (!hierarchyCheck) {
        return `🚫 You must hold a rank role from the established hierarchy to use the break system.`;
    }

    if (member.roles.cache.has(settings.breakRole.id)) {
        return `🚫 You are already on break.`;
    }

    let dmStatus = "DM failed (User may have DMs closed).";
    
    try {
        await member.roles.add(settings.breakRole, 'Member taking a break.');

        // 1. DM the user
        try {
            await member.send({
                content: `👋 You have successfully been placed on break in **${guild.name}**. The **${settings.breakRole.name}** role has been applied. We hope you have a refreshing time and look forward to your return!`
            });
            dmStatus = "DM success.";
        } catch (e) {
            // DM failed, but role was applied. dmStatus remains "DM failed..."
        }

        // 2. Announce in public channel
        const publicEmbed = new EmbedBuilder()
            .setColor(0xFFA500) // Orange
            .setTitle('⏳ Member Break')
            .setDescription(`${member} has taken a break (≥7 days). **DM Status: ${dmStatus}**`)
            .setTimestamp();
            
        await settings.publicChannel.send({ embeds: [publicEmbed] });
        
        return `✅ You are now on break. **DM Status: ${dmStatus}**`;
    } catch (error) {
        console.error('Error during break action:', error);
        return `❌ An error occurred while trying to apply the role. Check bot permissions.`;
    }
}


/**
 * Handles the "Resign" action logic (removing hierarchy roles, giving resign role, saving roles, announcing).
 */
async function handleResignAction(member, settings, guild, source) {
    const hierarchyCheck = hasHierarchyRole(member, guild.id);

    if (!hierarchyCheck) {
        return `🚫 You must hold a rank role from the established hierarchy to use the resignation system.`;
    }
    
    if (member.roles.cache.has(settings.resignRole.id)) {
        return `🚫 You are already resigned.`;
    }

    const hierarchyIds = getHierarchyRoles(guild.id);
    
    // 1. Identify roles to save
    const rolesToSave = [];
    if (hierarchyIds) {
        for (const roleId of hierarchyIds) {
            if (member.roles.cache.has(roleId)) {
                rolesToSave.push(roleId);
            }
        }
    }
    
    let dmStatus = "DM failed (User may have DMs closed, comeback request disabled).";

    // 2. Remove hierarchy roles and apply resign role
    try {
        const rolesToRemove = rolesToSave;
        if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove, 'Member resigned: Removing hierarchy roles.');
        }
        await member.roles.add(settings.resignRole, 'Member resigned: Applying resign role.');
        
        let dmMessage = null;
        
        // 3. DM the user with comeback button
        const comebackButton = new ButtonBuilder()
            .setCustomId('comeback_request')
            .setLabel('Inform Comeback')
            .setStyle(ButtonStyle.Primary);
            
        const row = new ActionRowBuilder().addComponents(comebackButton);
        
        try {
             dmMessage = await member.send({
                content: `😭 You have successfully resigned from **${guild.name}**. The **${settings.resignRole.name}** role has been applied, and your hierarchy roles have been removed.\n\nTo inform your comeback and request your previous roles restored, click the button below.`,
                components: [row]
            });
            dmStatus = "DM success (Comeback button sent).";
        } catch (e) {
            // DM failed. dmMessage remains null.
        }

        // 4. Save roles to DB
        // Pass the guildId here to contextually handle the comeback request later
        saveUserHierarchyAndRoles(member.id, rolesToSave, dmMessage ? dmMessage.id : null, guild.id);

        // 5. Announce in public channel
        const publicEmbed = new EmbedBuilder()
            .setColor(0xDC143C) // Red
            .setTitle('💔 Member Resignation')
            .setDescription(`${member} has resigned. We thank them for their service! **DM Status: ${dmStatus}**`)
            .setTimestamp();
            
        await settings.publicChannel.send({ embeds: [publicEmbed] });
        
        return `✅ You have resigned. **DM Status: ${dmStatus}**`;
        
    } catch (error) {
        console.error('Error during resign action:', error);
        return `❌ An error occurred while trying to manage roles or send the announcement. Check bot permissions.`;
    }
}


/**
 * Handles the "Inform Comeback" button clicked by the user (sent in DM).
 */
async function handleComebackRequest(interaction) {
    // This logic relies entirely on the saved user data from the DB.
    
    const userData = getUserHierarchyAndRoles(interaction.user.id);
    
    if (!userData || !userData.guild_id) {
         return interaction.reply({ content: 'Error: I cannot find your previous role data or server context. Please contact an admin directly.', ephemeral: true });
    }
    
    await interaction.deferReply({ ephemeral: true });

    // Fetch the guild, settings, and channels to validate the request
    const guild = interaction.client.guilds.cache.get(userData.guild_id);
    if (!guild) {
        return interaction.editReply('Error: I am no longer in the server you resigned from. Please contact an admin.');
    }
    
    const settings = getResignBreakSettings(userData.guild_id);
    if (!settings || !settings.admin_channel) {
         return interaction.editReply('Error: Admin channel not configured in the server. Please contact an admin to check the setup.');
    }
    
    const adminChannel = guild.channels.cache.get(settings.admin_channel);
    
    if (!adminChannel) {
         return interaction.editReply(`Error: The Admin Channel was found in the database but is missing from the server (ID: \`${settings.admin_channel}\`). Please contact an admin to fix the setup.`);
    }
    
    // 1. Disable the button in the user's DM
    const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(interaction.component).setDisabled(true).setLabel('Comeback Requested')
    );
    if (userData.comeback_request_message_id) {
        await interaction.message.edit({ components: [disabledRow] }).catch(e => console.error("Could not disable comeback button:", e));
    }
    
    // 2. Send the approval request to the Admin Channel
    const approveButton = new ButtonBuilder()
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
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'You must be an administrator to approve a comeback.', ephemeral: true });
    }
    
    await interaction.deferReply({ ephemeral: true });

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
    const publicChannel = guild.channels.cache.get(settings.break_resign_channel);
    
    // Convert role IDs to mention string for announcement
    const roleMentions = rolesToRestore.length > 0 ? rolesToRestore.map(id => `<@&${id}>`).join(', ') : 'None';

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
        
        // 6. Announce in public channel
        if (publicChannel) {
             const comebackEmbed = new EmbedBuilder()
                .setColor(0x32CD32) // Lime Green
                .setTitle('⬆️ Member Comeback')
                .setDescription(`${targetMember} has come back to their previous role(s): **${roleMentions}**`)
                .setTimestamp();
            await publicChannel.send({ embeds: [comebackEmbed] });
        }
        
        await interaction.editReply(`✅ Successfully approved comeback for **${targetMember.user.tag}**. Roles restored, public announcement sent, and user DMed.`);
        
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
    getSettingsAndValidate // Updated name to reflect validation
};