const {
	SectionBuilder,
	ButtonBuilder,
	ContainerBuilder,
	TextDisplayBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require("discord.js");

function render(messages, skip, max, authorId) {
	let i = 1;
	const sections = [];
	for (const current of messages) {
		if (i > max) break;
		const section = new SectionBuilder();

		let finalString = `${i}.`;
		i++;
		if (current.content) {
			finalString += `content: ${current.content.slice(0, 100)}\n`;
		}
		if (current.embeds) {
			finalString +=
				"has embeds (Unable to Dissplay them  At this time)\n";
		}
		if (current.attachments) {
			finalString += `has attachments (I will add an api endpoint to show the files at some point for now this won't work)\n`;
		}
		if (current.poll) {
			finalString +=
				"has a poll (can't display it due to it being undocumented by discord at this time)";
		}
		section.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(finalString.trim()),
		);
		section.setButtonAccessory(
			new ButtonBuilder()
				.setCustomId(
					`echoChamberMessage_delete_${authorId}_${current.id}_${skip}`,
				)
				.setLabel("delete")
				.setStyle(ButtonStyle.Danger),
		);
		sections.push(section);
	}
	const group = new ContainerBuilder()
		.addSectionComponents(sections)
		.addActionRowComponents(
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(
						`echoChamberMessage_changePage_${authorId}_${skip - max}`,
					)
					.setEmoji("⬅️")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(skip < max),
				new ButtonBuilder()
					.setCustomId(
						`echoChamberMessage_changePage_${authorId}_${skip + max}`,
					)
					.setEmoji("➡️")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(max > i),
			),
		);
	return group;
}
module.exports = render;
