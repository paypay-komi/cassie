const { PermissionsBitField } = require("discord.js");
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

		if (action === "list") {
			const forms = await prisma.ticketForm.findMany({ where: { guildId: guild.id } });
			if (!forms.length) return message.reply(buildMessage("No form questions. Add one with `tickets form add <question>`.", 0xe05252));
			const lines = forms.map((f, i) => `${i + 1}. ${f.question}${f.required ? " *(required)*" : ""}`);
			return message.reply(buildMessage(`## 📝 Ticket Form\n${lines.join("\n")}`, 0x5865f2));
		}

		if (action === "remove") {
			const idx = parseInt(args[1], 10) - 1;
			const forms = await prisma.ticketForm.findMany({ where: { guildId: guild.id }, orderBy: { createdAt: "asc" } });
			if (idx < 0 || idx >= forms.length) return message.reply(buildMessage("Provide a valid question number.", 0xe05252));
			await prisma.ticketForm.delete({ where: { id: forms[idx].id } });
			return message.reply(buildMessage(`Removed question ${idx + 1}.`, 0x57f287));
		}

		if (action === "add") {
			const question = args.slice(1).join(" ");
			if (!question) return message.reply(buildMessage("Provide a question: `tickets form add <question>`", 0xe05252));
			const required = question.endsWith("!") || question.endsWith("(required)");
			const qText = question.replace(/[!(]+\s*required\s*[)!]*$/i, "").trim();
			await prisma.ticketForm.create({ data: { guildId: guild.id, question: qText, required } });
			return message.reply(buildMessage(`Question added: **${qText}**${required ? " *(required)*" : ""}`, 0x57f287));
		}

		return message.reply(buildMessage("Usage: `tickets form <add|remove|list>`", 0xe05252));
	},
};