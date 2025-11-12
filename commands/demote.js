const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { getCurrentRankIndex, updateHierarchyRoles, getTargetMember, getHierarchyOrReply } = require('../util/roleLogic');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote')
        .setDescription('Demotes a member to the previous rank in the hierarchy, or removes all roles.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to demote.')
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
        
        // 4. Check if the user has any hierarchy role to demote
        if (currentRankIndex === -1) {
            return interaction.editReply(`🚫 Demotion failed: ${targetMember.user.tag} does not currently hold any hierarchy roles.`);
        }

        // 5. Calculate new rank index (previous rank). 
        // If currentRankIndex is 0 (lowest role), newRankIndex will be -1, which results in removing all roles.
        const newRankIndex = currentRankIndex - 1;
        
        // 6. Update roles and get result message
        const result = await updateHierarchyRoles(targetMember, hierarchyIds, newRankIndex);
        await interaction.editReply(result);
    },
    
    async prefixExecute(message, args) {
        const targetIdentifier = args[0];
        if (!targetIdentifier) {
            return message.reply('Please mention a user or provide their ID to demote them.');
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

        // 4. Check if the user has any hierarchy role to demote
        if (currentRankIndex === -1) {
            return message.reply(`🚫 Demotion failed: ${targetMember.user.tag} does not currently hold any hierarchy roles.`);
        }

        // 5. Calculate new rank index (previous rank)
        const newRankIndex = currentRankIndex - 1;

        // 6. Update roles and get result message
        const result = await updateHierarchyRoles(targetMember, hierarchyIds, newRankIndex);
        await message.reply(result);
    }
};