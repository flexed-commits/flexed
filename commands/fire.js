const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { getCurrentRankIndex, updateHierarchyRoles, getTargetMember, getHierarchyOrReply } = require('../util/roleLogic');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fire')
        .setDescription('Removes all hierarchy roles from a member.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to fire/remove roles from.')
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
        
        // 3. The 'fire' action is setting the rank to index -1, which triggers role removal logic.
        const targetIndex = -1; 

        // 4. Check if the user actually has any roles to remove
        const currentRankIndex = getCurrentRankIndex(targetMember, hierarchyIds);
        if (currentRankIndex === -1) {
            return interaction.editReply(`🚫 Fire failed: ${targetMember.user.tag} does not currently hold any hierarchy roles.`);
        }
        
        // 5. Update roles and get result message
        const result = await updateHierarchyRoles(targetMember, hierarchyIds, targetIndex);
        await interaction.editReply(result);
    },
    
    async prefixExecute(message, args) {
        const targetIdentifier = args[0];
        if (!targetIdentifier) {
            return message.reply('Please mention a user or provide their ID to fire them.');
        }

        // 1. Get hierarchy or reply if not set
        const hierarchyIds = await getHierarchyOrReply(message.guildId, message);
        if (!hierarchyIds) return;

        // Extract user ID from mention or use raw argument
        const targetUserId = targetIdentifier.replace(/<@!?|>/g, '');
        
        // 2. Get target member object and check manageability
        const targetMember = await getTargetMember(message, targetUserId);
        if (!targetMember) return;

        // 3. The 'fire' action is setting the rank to index -1, which triggers role removal logic.
        const targetIndex = -1; 
        
        // 4. Check if the user actually has any roles to remove
        const currentRankIndex = getCurrentRankIndex(targetMember, hierarchyIds);
        if (currentRankIndex === -1) {
            return message.reply(`🚫 Fire failed: ${targetMember.user.tag} does not currently hold any hierarchy roles.`);
        }

        // 5. Update roles and get result message
        const result = await updateHierarchyRoles(targetMember, hierarchyIds, targetIndex);
        await message.reply(result);
    }
};