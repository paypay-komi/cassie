const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const tickets = require("../../../lib/tickets");

const MAX_QUESTIONS = 5;

async function getForm(prisma, option) {
	if (!option?.formId) return null;
	return prisma.ticketForm.findUnique({
		where: { id: option.formId },
		include: { fields: { orderBy: { order: "asc" } } },
	});
}

module.exports = {
	commandId: "63cdf859-0a0b-43aa-b413-749f4710364d",
	name: "form",
	parent: "tickets",
	description: "Add, remove, or list ticket form questions",
	usage: "tickets form <add|remove|list> [question] [required:true|false]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const action = (args[0] || "").toLowerCase();
		const panel = await tickets.getPanel(prisma, guild.id);

		if (!panel) {
			return message.reply(buildMessage("No ticket panel found. Run `tickets setup` first.", 0xe05252));
		}

		const option = panel.options[0];
		if (!option) {
			return message.reply(buildMessage("No ticket options found. Run `tickets option add` first.", 0xe05252));
		}

		if (action === "list") {
			const form = await getForm(prisma, option);
			if (!form?.fields?.length) {
				return message.reply(
					buildMessage("No form questions yet. Add one with `tickets form add <question>`.", 0xe05252),
				);
			}

			const lines = form.fields.map(
				(field, index) =>
					`${index + 1}. ${field.label}${field.required ? " *(required)*" : ""}`,
			);
			return message.reply(
				buildMessage(
					`## Ticket Form\nApplying to **${option.label}**\n\n${lines.join("\n")}`,
					0x5865f2,
				),
			);
		}

		if (action === "remove") {
			const index = Number.parseInt(args[1], 10) - 1;
			const form = await getForm(prisma, option);
			if (!form?.fields?.length) {
				return message.reply(buildMessage("There are no form questions to remove.", 0xe05252));
			}
			if (!Number.isInteger(index) || index < 0 || index >= form.fields.length) {
				return message.reply(buildMessage("Provide a valid question number.", 0xe05252));
			}

			await prisma.ticketFormField.delete({ where: { id: form.fields[index].id } });
			return message.reply(buildMessage(`Removed question ${index + 1}.`, 0x57f287));
		}

		if (action === "add") {
			let question = args.slice(1).join(" ").trim();
			let required = true;

			const requiredMatch = question.match(/\s+required:(true|false)\s*$/i);
			if (requiredMatch) {
				required = requiredMatch[1].toLowerCase() === "true";
				question = question.slice(0, requiredMatch.index).trim();
			} else if (/\s+--optional\s*$/i.test(question)) {
				required = false;
				question = question.replace(/\s+--optional\s*$/i, "").trim();
			}

			if (!question) {
				return message.reply(
					buildMessage("Provide a question: `tickets form add <question> [required:true|false]`", 0xe05252),
				);
			}
			if (question.length > 45) {
				return message.reply(buildMessage("Questions must be 45 characters or fewer.", 0xe05252));
			}

			let form = await getForm(prisma, option);
			if (!form) {
				form = await prisma.ticketForm.upsert({
					where: { guildId_name: { guildId: guild.id, name: "default" } },
					create: { guildId: guild.id, name: "default", title: "Support Request" },
					update: {},
					include: { fields: true },
				});
			}
			if (option.formId !== form.id) {
				await prisma.ticketOption.update({
					where: { id: option.id },
					data: { formId: form.id },
				});
			}

			if (form.fields.length >= MAX_QUESTIONS) {
				return message.reply(
					buildMessage(`A ticket form can have at most ${MAX_QUESTIONS} questions.`, 0xe05252),
				);
			}

			await prisma.ticketFormField.create({
				data: {
					formId: form.id,
					key: `q${Date.now().toString(36)}`,
					label: question,
					type: "short_text",
					required,
					order: form.fields.length + 1,
				},
			});

			return message.reply(
				buildMessage(
					`Question added to **${option.label}**: **${question}**${required ? " *(required)*" : ""}`,
					0x57f287,
				),
			);
		}

		return message.reply(
			buildMessage("Usage: `tickets form <add|remove|list> [question]`", 0xe05252),
		);
	},
};
