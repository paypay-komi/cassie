const {
	Events,
	Client,
	Interaction,
	MessageFlags,
	messageLink,
} = require("discord.js");
const { getLogger } = require("../lib/logger");
const db = require("../db");

const log = getLogger("court case vote handler");

module.exports = {
	name: Events.InteractionCreate,
	description: "handles court case buttons",

	/**
	 * @param {Client} client
	 * @param {Interaction} interaction
	 */
	async execute(client, interaction) {
		if (!interaction.isButton()) return;
		if (!interaction.customId.startsWith("court")) return;

		const [_, action, caseId] = interaction.customId.split("_");

		const courtCase = await db.prisma.courtCase.findUnique({
			where: { id: caseId },
		});

		if (!courtCase) {
			log.warn(`invalid court case ${caseId}`);
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "this case no longer exists",
			});
		}

		const value = action == "guilty" ? 1 : -1;

		const existingVote = await db.prisma.courtVote.findUnique({
			where: {
				caseId_voterId: {
					caseId: caseId,
					voterId: interaction.user.id,
				},
			},
		});

		// user wants to change their vote sigh
		if (existingVote && existingVote.value === value) {
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: `you already voted ${action} for this case`,
			});
		}

		await db.prisma.courtVote.upsert({
			where: {
				caseId_voterId: {
					caseId: caseId,
					voterId: interaction.user.id,
				},
			},
			create: {
				caseId: caseId,
				voterId: interaction.user.id,
				value: value,
			},
			update: {
				value: value,
			},
		});

		// there is a vote
		// save a db write and notife the user
		if (!existingVote) {
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Recorded vote",
			});
		}

		return interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: "updated your vote",
		});
	},
};
