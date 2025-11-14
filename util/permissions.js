const { PermissionsBitField } = require('discord.js');
const { readData } = require('./db'); // <-- Corrected import

/**
 * Ensures the bot has necessary permissions in all channels and specifically in the setup channels.
 * @param {Guild} guild The target guild object.
 * @param {Client} client The bot client instance.
 * @returns {Promise<string>} A status message indicating success or failure.
 */
async function setupChannelPermissions(guild, client) {
    try {
        console.log('[PERMS] Starting channel permission setup...');
        
        const botMember = await guild.members.fetch(client.user.id);
        if (!botMember) {
            return 'Failed to fetch bot member. Is the bot in the server?';
        }

        // Use the correctly imported readData function
        const settings = await readData(); 
        const guildSettings = settings.resign_break_settings[guild.id];

        // 1. Grant View Channel Permission in ALL Channels
        console.log('[PERMS] Granting bot ViewChannel permissions across all channels...');
        const channels = await guild.channels.fetch();

        for (const [id, channel] of channels) {
            if (!channel || channel.deleted) continue;
            
            try {
                // Check if the bot already has ViewChannel to avoid unnecessary API calls
                const currentPerms = channel.permissionsFor(botMember);
                if (currentPerms && currentPerms.has(PermissionsBitField.Flags.ViewChannel)) {
                    continue;
                }

                await channel.permissionOverwrites.edit(botMember.id, {
                    [PermissionsBitField.Flags.ViewChannel]: true,
                });
                console.log(`[PERMS] Set ViewChannel for bot in: #${channel.name}`);
            } catch (error) {
                if (error.code === 50013) {
                    console.error(`[PERMS] FATAL ERROR: Missing permissions to set ViewChannel in #${channel.name}. Bot role is too low!`);
                }
                // Ignore other errors (like restricted channel types)
            }
        }
        console.log('[PERMS] Finished granting bot ViewChannel permissions.');

        // 2. Set Specific Permissions for Setup Channels
        let specificChannelReport = '';
        if (guildSettings) {
            const channelMap = {
                'Break/Resign Channel': guildSettings.break_resign_channel,
                'Public Announce Channel': guildSettings.public_announce_channel,
                'Admin Channel': guildSettings.admin_channel,
            };

            for (const [name, channelId] of Object.entries(channelMap)) {
                try {
                    const channel = await guild.channels.fetch(channelId);
                    if (!channel) {
                        specificChannelReport += `\n⚠️ Configured ${name} (${channelId}) not found.`;
                        continue;
                    }
                    
                    // Set the critical permissions
                    await channel.permissionOverwrites.edit(botMember.id, {
                        [PermissionsBitField.Flags.ViewChannel]: true,
                        [PermissionsBitField.Flags.SendMessages]: true,
                        [PermissionsBitField.Flags.EmbedLinks]: true,
                        [PermissionsBitField.Flags.ManageRoles]: true,
                    });
                    specificChannelReport += `\n✅ Set necessary R/W/Role permissions for bot in ${name}: #${channel.name}`;

                } catch (error) {
                    specificChannelReport += `\n❌ ERROR setting permissions for ${name}. Check bot role position.`;
                    console.error(`[PERMS] ERROR setting permissions for ${name}:`, error.message);
                }
            }
        } else {
            specificChannelReport = '\n⚠️ Resign/Break settings not found. Specific channel perms skipped.';
        }
        
        console.log('[PERMS] Channel permission setup complete.');
        return `Permission check and setup complete! ${specificChannelReport}\n\n**If any errors occurred (❌), please ensure the bot's highest role is above all other roles in the Server Settings.**`;

    } catch (error) {
        console.error('Fatal error during permission setup:', error);
        return `A fatal error occurred during permission setup: \`${error.message}\``;
    }
}

module.exports = { setupChannelPermissions };
