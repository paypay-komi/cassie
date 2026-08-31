const { PermissionsBitField, MessageFlags } = require("discord.js");

const { getLogger } = require("../../../lib/logger.js");

const log = getLogger("autoroles:delete");

const prisma = require("../../../db/index.js").prisma;

module.exports = {

commandId: "00446761-1be1-438d-8b9f-b779f01ea701",
    name: "delete",
    description: "deletes an auto role",

    requiredBotPermissions: [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageRoles,
    ],

    requiredUserPermissions: [PermissionsBitField.Flags.ManageRoles],

    parent: "autorole",
    aliases: ["remove", "rm"],

    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const role = interaction.options.getRole("role");

        if (!role) {
            return interaction.reply({
                content: "Please specify an auto role to delete.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const autorole =
            await prisma.guildMemberRoleRequirement.findUnique({
                where: {
                    guildId_roleId: {
                        guildId: interaction.guildId,
                        roleId: role.id,
                    },
                },
            });

        if (!autorole) {
            return interaction.reply({
                content: `${role} isn't configured as an auto role.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            await prisma.guildMemberRoleRequirement.delete({
                where: {
                    guildId_roleId: {
                        guildId: interaction.guildId,
                        roleId: role.id,
                    },
                },
            });
        } catch (error) {
            log.error(
                `Failed to delete autorole ${role.id} in guild ${interaction.guildId}:`,
                error,
            );

            return interaction.reply({
                content: "Something went wrong while deleting that auto role.",
                flags: MessageFlags.Ephemeral,
            });
        }

        return interaction.reply({
            content: `Auto role ${role} deleted successfully!`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
