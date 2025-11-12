const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { getCurrentRankIndex, updateHierarchyRoles, getTargetMember, getHierarchyOrReply } = require('../util/roleLogic');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promotes a member to the next rank in the hierarchy.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to promote.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        
        const targetUser = interaction.options.getUser('user');
        
        // 1. Get hierarchy or reply if not set
        const hierarchyIds = await getHierarchyOrReply(interaction.guildId, interaction);
        if (!hierarchyIds) return;

        // 2. Get target member object and check manageability
        const targetMember = await getTargetMember(interaction, targetUser.id);
        if (!targetMember) return;
        
        // 3. Find current rank
        const currentRankIndex = getCurrentRankIndex(targetMember, hierarchyIds);

        // 4. Calculate new rank index (next rank)
        const newRankIndex = currentRankIndex + 1;
        
        // Check for max rank limit
        if (newRankIndex >= hierarchyIds.length) {
            return interaction.editReply(`🚫 Promotion failed: ${targetMember.user.tag} is already at the highest rank: **${targetMember.roles.cache.get(hierarchyIds[hierarchyIds.length - 1]).name}**.`);
        }

        // 5. Update roles and get result message
        const result = await updateHierarchyRoles(targetMember, hierarchyIds, newRankIndex);
        await interaction.editReply(result);
    },
    
    async prefixExecute(message, args) {
        // Prefix commands assume the user is mentioned or the ID is provided as the first argument
        const targetIdentifier = args[0];
        if (!targetIdentifier) {
            return message.reply('Please mention a user or provide their ID to promote them.');
        }

        // 1. Get hierarchy or reply if not set
        const hierarchyIds = await getHierarchyOrReply(message.guildId, message);
        if (!hierarchyIds) return;

        // Extract user ID from mention or use raw argument
        const targetUserId = targetIdentifier.replace(/<@!?|>/g, '');
        
        // 2. Get target member object and check manageability
        const targetMember = await getTargetMember(message, targetUserId);
        if (!targetMember) return;

        // 3. Find current rank
        const currentRankIndex = getCurrentRankIndex(targetMember, hierarchyIds);

        // 4. Calculate new rank index (next rank)
        const newRankIndex = currentRankIndex + 1;

        if (newRankIndex >= hierarchyIds.length) {
            const highestRole = message.guild.roles.cache.get(hierarchyIds[hierarchyIds.length - 1]);
            return message.reply(`🚫 Promotion failed: ${targetMember.user.tag} is already at the highest rank: **${highestRole ? highestRole.name : 'Unknown'}**.`);
        }

        // 5. Update roles and get result message
        const result = await updateHierarchyRoles(targetMember, hierarchyIds, newRankIndex);
        await message.reply(result);
    }
};