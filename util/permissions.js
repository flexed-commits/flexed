const { PermissionsBitField } = require('discord.js');
const { readData } = require('./db'); 

/**
 * Ensures the bot has necessary permissions in all channels and removes @everyone pings.
 * @param {Guild} guild The target guild object.
 * @param {Client} client The bot client instance.
 * @returns {Promise<string>} A status message indicating success or failure.
 */
async function setupChannelPermissions(guild, client) {
    try {
        console.log('[PERMS] Starting channel permission setup...');
        
        const botMember = await guild.members.fetch(client.user.id);
        const everyoneRole = guild.roles.everyone;

        if (!botMember) {
            return 'Failed to fetch bot member. Is the bot in the server?';
        }

        let report = '';

        // --- GLOBAL CHANNEL CONFIGURATION (Applies to all channels) ---
        console.log('[PERMS] Applying global permission rules...');

        const channels = await guild.channels.fetch();

        for (const [id, channel] of channels) {
            if (!channel || channel.deleted) continue;
            
            try {
                // 1. Grant critical bot permissions globally (View, Send, Embeds, Attachments, Reactions)
                await channel.permissionOverwrites.edit(botMember.id, {
                    [PermissionsBitField.Flags.ViewChannel]: true,     // MUST VIEW
                    [PermissionsBitField.Flags.SendMessages]: true,    // MUST SEND MESSAGES
                    [PermissionsBitField.Flags.EmbedLinks]: true,      // For rich output
                    [PermissionsBitField.Flags.AttachFiles]: true,     // For sending images/files
                    [PermissionsBitField.Flags.AddReactions]: true,    // For interactive buttons/reactions
                });

                // 2. Deny @everyone pings globally
                await channel.permissionOverwrites.edit(everyoneRole.id, {
                    [PermissionsBitField.Flags.MentionEveryone]: false, // Explicit DENY
                });
                
            } catch (error) {
                // Log fatal error if we can't manage permissions
                if (error.code === 50013) {
                    report += `\n❌ FATAL ERROR: Missing permissions to manage channel overwrites in #${channel.name}. Bot role is too low!`;
                    console.error(`[PERMS] FATAL ERROR: Missing permissions to manage channel overwrites in #${channel.name}. Bot role is too low!`);
                }
            }
        }
        report += '\n✅ **Global rules applied:** Bot has R/W/Embed/React/Attach access everywhere. @everyone pings are disabled everywhere.';
        
        console.log('[PERMS] Channel permission setup complete.');
        return `**Permission check and setup complete!**\n\n${report}\n\n**If any errors occurred (❌), please ensure the bot's highest role is above all other roles in the Server Settings.**`;

    } catch (error) {
        console.error('Fatal error during permission setup:', error);
        return `A fatal error occurred during permission setup: \`${error.message}\``;
    }
}

module.exports = { setupChannelPermissions };
