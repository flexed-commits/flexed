const { getHierarchyRoles } = require('./db');

/**
 * Finds the highest hierarchy role a member currently possesses.
 * @param {object} member The GuildMember object.
 * @param {Array<string>} hierarchyIds Array of role IDs (lowest to highest).
 * @returns {number} The index of the highest hierarchy role found, or -1 if none found.
 */
function getCurrentRankIndex(member, hierarchyIds) {
    let currentRankIndex = -1;

    // Iterate over the hierarchy from lowest to highest rank
    hierarchyIds.forEach((roleId, index) => {
        if (member.roles.cache.has(roleId)) {
            // Update the index if the member has this role. 
            // Since we iterate lowest to highest, this ensures we find the HIGHEST rank they hold.
            currentRankIndex = index;
        }
    });

    return currentRankIndex;
}

/**
 * Performs the core role update logic (Promote, Demote, Hire, Fire).
 * @param {object} member The GuildMember object to modify.
 * @param {Array<string>} hierarchyIds The hierarchy role IDs (lowest to highest).
 * @param {number} targetIndex The desired index in the hierarchyIds array.
 * @returns {string} A descriptive status message.
 */
async function updateHierarchyRoles(member, hierarchyIds, targetIndex) {
    if (!member || !hierarchyIds || hierarchyIds.length === 0) {
        return "Internal Error: Hierarchy not configured or member object missing.";
    }
    
    // 1. Get current roles
    const currentHierarchyIds = hierarchyIds.filter(id => member.roles.cache.has(id));
    const allHierarchyRoles = hierarchyIds.map(id => member.guild.roles.cache.get(id)).filter(r => r);

    // 2. Remove all current hierarchy roles in one go
    if (currentHierarchyIds.length > 0) {
        await member.roles.remove(currentHierarchyIds, 'Hierarchy action: Removing previous rank(s).');
    }

    // 3. Check if we need to add a new role (targetIndex is within bounds)
    if (targetIndex >= 0 && targetIndex < hierarchyIds.length) {
        const targetRoleId = hierarchyIds[targetIndex];
        const targetRole = member.guild.roles.cache.get(targetRoleId);

        if (targetRole) {
            await member.roles.add(targetRole, 'Hierarchy action: Setting new rank.');
            return `✅ Success! ${member.user.tag} has been granted the **${targetRole.name}** role.`;
        } else {
            // Should not happen if setup was successful, but a safeguard
            return `Error: Target role ID ${targetRoleId} not found.`;
        }
    } else {
        // This covers demoting below the lowest rank (Fire action) or invalid indices
        return `✅ Success! All hierarchy roles have been removed from ${member.user.tag}.`;
    }
}

/**
 * A helper function to fetch the member object and handle common error checks.
 * @param {object} sourceMessageOrInteraction The source object (Message or Interaction).
 * @param {string} targetUserId The ID of the user to target.
 * @returns {Promise<object|null>} The GuildMember object or null if checks fail.
 */
async function getTargetMember(sourceMessageOrInteraction, targetUserId) {
    const guild = sourceMessageOrInteraction.guild;
    const isInteraction = 'isChatInputCommand' in sourceMessageOrInteraction;
    
    let targetMember;
    try {
        targetMember = await guild.members.fetch(targetUserId);
    } catch (e) {
        const errorContent = "Could not find that user in this server.";
        if (isInteraction) {
            await sourceMessageOrInteraction.editReply(errorContent);
        } else {
            await sourceMessageOrInteraction.reply(errorContent);
        }
        return null;
    }

    // Check if the target member can be modified by the bot
    if (!targetMember.manageable) {
        const errorContent = `I cannot modify roles for ${targetMember.user.tag}. My role must be higher than theirs and all hierarchy roles.`;
        if (isInteraction) {
            await sourceMessageOrInteraction.editReply(errorContent);
        } else {
            await sourceMessageOrInteraction.reply(errorContent);
        }
        return null;
    }
    
    // You cannot promote/demote yourself
    if (targetMember.id === sourceMessageOrInteraction.member.id) {
         const errorContent = `You cannot use this command on yourself.`;
        if (isInteraction) {
            await sourceMessageOrInteraction.editReply(errorContent);
        } else {
            await sourceMessageOrInteraction.reply(errorContent);
        }
        return null;
    }

    return targetMember;
}

/**
 * A helper function to fetch hierarchy and handle the not-setup case.
 * @param {string} guildId The ID of the guild.
 * @param {object} sourceMessageOrInteraction The source object (Message or Interaction).
 * @returns {Promise<Array<string>|null>} The hierarchy array or null if checks fail.
 */
async function getHierarchyOrReply(guildId, sourceMessageOrInteraction) {
    const hierarchyIds = getHierarchyRoles(guildId);
    if (!hierarchyIds || hierarchyIds.length === 0) {
        const isInteraction = 'isChatInputCommand' in sourceMessageOrInteraction;
        const setupMessage = 'The role hierarchy has not been set up yet. Please use `/role-hierarchy-setup` first.';
        
        if (isInteraction) {
            await sourceMessageOrInteraction.editReply(setupMessage);
        } else {
            await sourceMessageOrInteraction.reply(setupMessage);
        }
        return null;
    }
    return hierarchyIds;
}

module.exports = {
    getCurrentRankIndex,
    updateHierarchyRoles,
    getTargetMember,
    getHierarchyOrReply,
};

