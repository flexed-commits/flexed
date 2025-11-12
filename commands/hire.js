const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { getCurrentRankIndex, updateHierarchyRoles, getTargetMember, getHierarchyOrReply } = require('../util/roleLogic');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hire')
        .setDescription('Gives a member the lowest rank in the hierarchy.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to hire/give the starting role.')
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
        
        // 3. The 'hire' action is always setting the rank to index 0 (the lowest rank).
        const targetIndex = 0; 

        // 4. Update roles and get result message
        const result = await updateHierarchyRoles(targetMember, hierarchyIds, targetIndex);
        await interaction.editReply(result);
    },
    
    async prefixExecute(message, args) {
        const targetIdentifier = args[0];
        if (!targetIdentifier) {
            return message.reply('Please mention a user or provide their ID to hire them.');
        }

        // 1. Get hierarchy or reply if not set
        const hierarchyIds = await getHierarchyOrReply(message.guildId, message);
        if (!hierarchyIds) return;

        // Extract user ID from mention or use raw argument
        const targetUserId = targetIdentifier.replace(/<@!?|>/g, '');
        
        // 2. Get target member object and check manageability
        const targetMember = await getTargetMember(message, targetUserId);
        if (!targetMember) return;

        // 3. The 'hire' action is always setting the rank to index 0 (the lowest rank).
        const targetIndex = 0; 
        
        // 4. Update roles and get result message
        const result = await updateHierarchyRoles(targetMember, hierarchyIds, targetIndex);
        await message.reply(result);
    }
};