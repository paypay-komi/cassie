const {
	ContainerBuilder,
	TextDisplayBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageFlags,
} = require("discord.js");
const { getRandomActionGif } = require("./randomActionGif");

async function handleActionCommand(message, args, command) {
	const action = command.name;
	const result = await getRandomActionGif(action);
	if (!result) {
		return message.reply(
			`no ${action} GIFs available yet — add one with \`c.action submit\`!`,
		);
	}

	const container = new ContainerBuilder();
	container.addMediaGalleryComponents(
		new MediaGalleryBuilder().addItems(
			new MediaGalleryItemBuilder().setURL(result.url),
		),
	);

	if (command.selfOnly && command.selfText) {
		const text = command.selfText
			.replace("{author}", `${message.author}`)
			.replace("{url}", result.url);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(text),
		);
	} else {
		const target = args.join(" ");
		if (command.requiresTarget && !target) {
			return message.reply(
				`you need to mention someone to ${action} them! (or mention me to ${action} me)`,
			);
		}
		if (target) {
			const verb = conjugate(action);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`${message.author} ${verb} ${target}\n${result.url}`,
				),
			);
		} else {
			const verb = conjugate(action);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`${message.author} ${verb}\n${result.url}`,
				),
			);
		}
	}

	return message.channel.send({
		components: [container],
		flags: MessageFlags.IsComponentsV2,
	});
}

function conjugate(action) {
	if (/[sxz]$/.test(action) || /(ch|sh)$/.test(action)) return action + "es";
	if (/[^aeiou]y$/.test(action)) return action.slice(0, -1) + "ies";
	return action + "s";
}

module.exports = { handleActionCommand };
