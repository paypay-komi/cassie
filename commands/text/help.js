const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
} = require("discord.js");

module.exports = {
	name: "help",
	description: "List all commands or get info about a specific command.",
	aliases: ["h"],

	async execute(message, args) {
		const { textCommands, prefix } = message.client;

		function renderCommand(cmd, depth = 0, isLast = true, prefixStr = "") {
			const aliasText = cmd.aliases?.length
				? ` *(aliases: ${cmd.aliases.join(", ")})*`
				: "";
			const branch = depth === 0 ? "" : isLast ? "└─ " : "├─ ";
			const safePrefixStr = prefixStr.replace(/ /g, "\u00A0");
			const line = `${safePrefixStr}${branch}${prefix}${cmd.name}${aliasText} — ${cmd.description || "No description"}`;

			const subs = cmd.subcommands ? Object.values(cmd.subcommands) : [];
			const subLines = subs.map((sub, i) =>
				renderCommand(
					sub,
					depth + 1,
					i === subs.length - 1,
					prefixStr + (depth === 0 ? "" : isLast ? "   " : "│  "),
				),
			);

			return [line, ...subLines].join("\n");
		}

		if (args.length) {
			const name = args[0].toLowerCase();
			const cmd =
				textCommands.get(name) ||
				[...textCommands.values()].find((c) =>
					c.aliases?.includes(name),
				);

			if (!cmd)
				return message.reply(
					`I couldn't find a command named \`${name}\`.`,
				);

			return message.reply({
				embeds: [
					new EmbedBuilder()
						.setTitle(`Help: ${cmd.name}`)
						.setDescription(renderCommand(cmd))
						.setColor("#00AEEF"),
				],
			});
		}

		const allCommands = [...textCommands.values()].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		const pageSize = 3;
		const totalPages = Math.max(
			1,
			Math.ceil(allCommands.length / pageSize),
		);
		let page = 0;

		const generateEmbed = (pageIndex) => {
			const slice = allCommands.slice(
				pageIndex * pageSize,
				(pageIndex + 1) * pageSize,
			);
			return new EmbedBuilder()
				.setTitle("Available Commands")
				.setDescription(
					slice
						.map((c, i) =>
							renderCommand(c, 0, i === slice.length - 1),
						)
						.join("\n"),
				)
				.setColor("#00AEEF")
				.setFooter({ text: `Page ${pageIndex + 1} / ${totalPages}` });
		};

		const createRow = (msgId, page) =>
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`help:${msgId}:first`)
					.setLabel("⏮️")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === 0),

				new ButtonBuilder()
					.setCustomId(`help:${msgId}:prev`)
					.setLabel("◀️")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === 0),

				new ButtonBuilder()
					.setCustomId(`help:${msgId}:next`)
					.setLabel("▶️")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === totalPages - 1),

				new ButtonBuilder()
					.setCustomId(`help:${msgId}:last`)
					.setLabel("⏭️")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === totalPages - 1),
			);

		const msg = await message.reply({
			embeds: [generateEmbed(page)],
			components: [createRow(null, page)], // temp, fixed immediately
		});

		await msg.edit({
			embeds: [generateEmbed(page)],
			components: [createRow(msg.id, page)],
		});

		const collector = msg.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 120_000,
		});

		collector.on("collect", async (interaction) => {
			if (interaction.user.id !== message.author.id) {
				return interaction.reply({
					content: "🚫 You can't control this help menu.",
					ephemeral: true,
				});
			}

			const [, msgId, action] = interaction.customId.split(":");
			if (msgId !== msg.id) return;

			switch (action) {
				case "first":
					page = 0;
					break;
				case "prev":
					page = Math.max(page - 1, 0);
					break;
				case "next":
					page = Math.min(page + 1, totalPages - 1);
					break;
				case "last":
					page = totalPages - 1;
					break;
			}

			await interaction.update({
				embeds: [generateEmbed(page)],
				components: [createRow(msg.id, page)],
			});
		});

		collector.on("end", async () => {
			const disabledRow = createRow(msg.id, page);
			disabledRow.components.forEach((b) => b.setDisabled(true));
			await msg.edit({ components: [disabledRow] }).catch(() => {});
		});
	},
};
