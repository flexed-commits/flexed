const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { setHierarchyRoles } = require('../util/db');

// This command is used to set the ordered list of role IDs that form the hierarchy.

module.exports = {
    // Slash Command Data
    data: new SlashCommandBuilder()
        .setName('role-hierarchy-setup')
        .setDescription('Sets up the role hierarchy for promotion/demotion (lowest rank first).')
        .addStringOption(option =>
            option.setName('roles')
                .setDescription('List of roles (IDs or Names), separated by spaces, from lowest to highest rank.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator), // Only Administrators can use this

    // Slash Command Execution Logic
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // 1. Permission Check (redundant due to defaultMemberPermissions, but good practice)
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply('You must be an administrator to set up the role hierarchy.');
        }

        const roleInput = interaction.options.getString('roles').trim();
        const inputTokens = roleInput.split(/\s+/).filter(token => token.length > 0);
        
        if (inputTokens.length < 2) {
             return interaction.editReply('Please provide at least two roles (IDs or names) separated by spaces to establish a hierarchy.');
        }

        const roleIds = [];
        const roleNames = [];
        const guild = interaction.guild;

        for (const token of inputTokens) {
            // Clean up role mention format (e.g., <@&1234567890>)
            const roleId = token.replace(/<@&|>/g, '');
            const role = guild.roles.cache.get(roleId) || guild.roles.cache.find(r => r.name.toLowerCase() === token.toLowerCase());

            if (role) {
                // Ensure the bot can manage the role (crucial for promoting/demoting later)
                if (!role.editable) {
                    return interaction.editReply(`Error: The role \`${role.name}\` cannot be managed by the bot. Ensure the bot's role is higher than all roles in the hierarchy.`);
                }
                roleIds.push(role.id);
                roleNames.push(role.name);
            } else {
                return interaction.editReply(`Error: Could not find a role matching \`${token}\`. Please check your input.`);
            }
        }
        
        // 2. Save the hierarchy
        setHierarchyRoles(guild.id, roleIds);

        // 3. Confirm success
        const hierarchyList = roleNames.map((name, index) => `${index + 1}. ${name}`).join('\n');
        
        await interaction.editReply({
            content: `**✅ Role Hierarchy Setup Complete!**\n\nThe following roles have been set in order (Lowest Rank to Highest Rank):\n\`\`\`\n${hierarchyList}\`\`\``,
            ephemeral: false // Show to everyone for confirmation
        });
    },
    
    // Prefix Command Execution Logic (uses the same core functionality)
    async prefixExecute(message, args) {
        if (!args.length) {
            return message.reply(`Usage: \`${message.client.PREFIX}role-hierarchy-setup <RoleIDs or Names separated by space>\``);
        }
        
        // The args array already contains the tokens separated by space, so we just pass them as input
        const inputTokens = args.filter(token => token.length > 0);
        
        if (inputTokens.length < 2) {
             return message.reply('Please provide at least two roles (IDs or names) separated by spaces to establish a hierarchy.');
        }
        
        const roleIds = [];
        const roleNames = [];
        const guild = message.guild;

        for (const token of inputTokens) {
            const roleId = token.replace(/<@&|>/g, '');
            const role = guild.roles.cache.get(roleId) || guild.roles.cache.find(r => r.name.toLowerCase() === token.toLowerCase());

            if (role) {
                if (!role.editable) {
                    return message.reply(`Error: The role \`${role.name}\` cannot be managed by the bot. Ensure the bot's role is higher than all roles in the hierarchy.`);
                }
                roleIds.push(role.id);
                roleNames.push(role.name);
            } else {
                return message.reply(`Error: Could not find a role matching \`${token}\`. Please check your input.`);
            }
        }
        
        setHierarchyRoles(guild.id, roleIds);

        const hierarchyList = roleNames.map((name, index) => `${index + 1}. ${name}`).join('\n');
        
        await message.reply({
            content: `**✅ Role Hierarchy Setup Complete!**\n\nThe following roles have been set in order (Lowest Rank to Highest Rank):\n\`\`\`\n${hierarchyList}\`\`\``
        });
    }
};