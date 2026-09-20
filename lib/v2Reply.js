const {
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	MessageFlags,
} = require("discord.js");

function buildMessage(text, color) {
	const container = new ContainerBuilder().addTextDisplayComponents(
		new TextDisplayBuilder().setContent(text),
	);
	if (color !== undefined) container.setAccentColor(color);
	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { parse: [] },
	};
}

function buildMessageBlocks(blocks, color) {
	const container = new ContainerBuilder();
	blocks.forEach((block, i) => {
		if (i > 0) container.addSeparatorComponents(new SeparatorBuilder());
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(block),
		);
	});
	if (color !== undefined) container.setAccentColor(color);
	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { parse: [] },
	};
}

module.exports = { buildMessage, buildMessageBlocks };
