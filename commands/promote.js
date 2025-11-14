const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readData, writeData, isGuildSetup } = require('../util/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promotes a user to the next role in the defined hierarchy.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to promote.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for the promotion.')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const { guild, options, member } = interaction;
        const targetMember = options.getMember('target');
        const reason = options.getString('reason');
        const guildId = guild.id;

        if (!await isGuildSetup(guildId)) {
            return interaction.editReply('❌ Bot settings are incomplete. Please run `/setup` first.');
        }

        const data = await readData();
        const hierarchy = data.hierarchy[guildId];

        if (!hierarchy || hierarchy.length < 2) {
            return interaction.editReply('❌ Hierarchy is not set up or has too few roles. Please run `/setup hierarchy`.');
        }

        // 1. Find the target's current role that exists in the hierarchy
        const targetHierarchyRole = targetMember.roles.cache.find(r => hierarchy.includes(r.id));
        const currentIndex = targetHierarchyRole ? hierarchy.indexOf(targetHierarchyRole.id) : -1;

        // 2. Determine the next role index
        const nextIndex = currentIndex + 1;

        if (nextIndex >= hierarchy.length) {
            return interaction.editReply('✅ This user is already at the highest available rank or they hold a role not in the hierarchy.');
        }
        
        // 3. Get Role IDs
        const nextRoleId = hierarchy[currentIndex]; // Next role in Discord is the one *below* in the array
        const roleToKeep = hierarchy[nextIndex]; // The role to remove is the one *above*

        const nextRole = guild.roles.cache.get(nextRoleId);
        const roleToRemove = guild.roles.cache.get(roleToKeep);

        if (!nextRole) {
            return interaction.editReply(`❌ Could not find the next role ID \`${nextRoleId}\` in this server.`);
        }
        
        try {
            // Remove the old role (if found)
            if (roleToRemove && targetMember.roles.cache.has(roleToRemove.id)) {
                 await targetMember.roles.remove(roleToRemove, `Promotion by ${member.user.tag}`);
            }

            // Add the new role
            await targetMember.roles.add(nextRole, `Promotion by ${member.user.tag}`);

            const embed = new EmbedBuilder()
                .setTitle('🎉 Promotion Successful')
                .setDescription(`${targetMember} was promoted to ${nextRole} by ${member}!`)
                .addFields(
                    { name: 'New Role', value: `${nextRole}`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setColor(0x00FF00);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Failed to manage roles. Check the bot\'s role hierarchy and permissions.');
        }
    },
};
