const {
	Events,
	MessageFlags,
	PermissionFlagsBits,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require("discord.js");
const { getLogger } = require("../lib/logger");
const vm = require("../lib/voiceMaster");

const log = getLogger("VMInterface");

function ephemeral(content, components = []) {
	return {
		content,
		components,
		flags: MessageFlags.Ephemeral,
	};
}

async function respond(interaction, content, components = []) {
	const payload = ephemeral(content, components);
	if (interaction.deferred || interaction.replied) {
		return interaction.followUp(payload).catch(() => {});
	}
	return interaction.reply(payload).catch(() => {});
}

async function resolveTarget(interaction, prisma, channelId) {
	const guild = interaction.guild;
	if (!guild || !channelId) return { error: "This control can only be used in a server." };

	const vc = await prisma.voiceChannel.findUnique({
		where: { guildId_channelId: { guildId: guild.id, channelId } },
	});
	if (!vc) return { error: "This is not a managed voice channel." };

	const channel =
		guild.channels.cache.get(channelId) ||
		(await guild.channels.fetch(channelId).catch(() => null));
	if (!channel) {
		await prisma.voiceChannel.delete({ where: { channelId } }).catch(() => {});
		await prisma.voiceChannelMember.deleteMany({ where: { channelId } }).catch(() => {});
		return { error: "That voice channel no longer exists." };
	}

	return { vc, channel };
}

async function getTarget(interaction, prisma) {
	let result = await resolveTarget(interaction, prisma, interaction.channelId);
	if (!result.error) return result;

	const voiceChannelId = interaction.member?.voice?.channelId;
	if (voiceChannelId && voiceChannelId !== interaction.channelId) {
		result = await resolveTarget(interaction, prisma, voiceChannelId);
	}

	return result;
}

function canManage(interaction, vc) {
	if (vc.ownerId === interaction.user.id) return true;
	return Boolean(interaction.member?.permissions?.has(PermissionFlagsBits.ManageChannels));
}

function parseUserId(value) {
	const raw = String(value || "").trim();
	const match = raw.match(/(\d{5,25})/);
	return match ? match[1] : null;
}

async function refreshInterface(client, guild, vc, channel) {
	const pinned = await channel.messages.fetchPinned().catch(() => null);
	let message = pinned?.find((item) => item.author?.id === client.user.id);

	if (!message) {
		const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
		message = recent?.find((item) => item.author?.id === client.user.id);
	}
	if (!message) return;

	const bitrate = Number(vc.bitrate) || Math.max(8, Math.floor(Number(channel.bitrate || 0) / 1000));
	const userLimit = Number(vc.userLimit) || 0;

	await message
		.edit({
			components: [
				vm.buildInterface({
					name: vc.name || channel.name,
					ownerId: vc.ownerId,
					locked: vc.locked,
					hidden: vc.hidden,
					userLimit,
					bitrate,
				}),
			],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		})
		.catch(() => {});
}

async function getConfig(prisma, guildId) {
	return prisma.voiceMasterConfig.findUnique({ where: { guildId } });
}

function openValueModal(interaction, action, channelId, title, label, value, maxLength, placeholder) {
	const input = new TextInputBuilder()
		.setCustomId("value")
		.setLabel(label)
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setMaxLength(maxLength)
		.setPlaceholder(placeholder)
		.setValue(String(value ?? ""));

	const modal = new ModalBuilder()
		.setCustomId(`vm_modal_${action}:${channelId}`)
		.setTitle(title)
		.addComponents(new ActionRowBuilder().addComponents(input));

	return interaction.showModal(modal);
}

async function handleButton(interaction, client, prisma) {
	const { customId } = interaction;

	if (customId === "vm_cancel") {
		return interaction.update({ content: "Cancelled.", components: [] }).catch(() => {});
	}

	if (customId.startsWith("vm_delete_confirm:")) {
		const channelId = customId.split(":")[1];
		const target = await resolveTarget(interaction, prisma, channelId);
		if (target.error) return respond(interaction, target.error);
		if (!canManage(interaction, target.vc)) {
			return respond(interaction, "Only the channel owner or staff can use this.");
		}

		await target.channel.delete("VoiceMaster panel delete").catch((err) => {
			log.warn("Failed to delete temp channel: " + err.message);
		});
		await prisma.voiceChannel.delete({ where: { channelId } }).catch(() => {});
		await prisma.voiceChannelMember.deleteMany({ where: { channelId } }).catch(() => {});

		return interaction.update({ content: "Channel deleted.", components: [] }).catch(() => {});
	}

	const action = customId.slice(3);
	const target = await getTarget(interaction, prisma);
	if (target.error) return respond(interaction, target.error);
	if (!canManage(interaction, target.vc)) {
		return respond(interaction, "Only the channel owner or staff can use these.");
	}

	const { vc, channel } = target;
	const cfg = await getConfig(prisma, interaction.guild.id);

	if (action === "lock") {
		vc.locked = !vc.locked;
		await prisma.voiceChannel.update({
			where: { channelId: vc.channelId },
			data: { locked: vc.locked },
		});
		await vm.applyPermissions({ client, guild: interaction.guild, channel, vc, cfg });
		await respond(interaction, vc.locked ? "Channel locked." : "Channel unlocked.");
		return refreshInterface(client, interaction.guild, vc, channel);
	}

	if (action === "hide") {
		vc.hidden = !vc.hidden;
		await prisma.voiceChannel.update({
			where: { channelId: vc.channelId },
			data: { hidden: vc.hidden },
		});
		await vm.applyPermissions({ client, guild: interaction.guild, channel, vc, cfg });
		await respond(interaction, vc.hidden ? "Channel hidden." : "Channel visible.");
		return refreshInterface(client, interaction.guild, vc, channel);
	}

	if (action === "rename") {
		return openValueModal(
			interaction,
			"rename",
			vc.channelId,
			"Rename channel",
			"New channel name",
			vc.name || channel.name,
			100,
			"Enter a new name",
		);
	}

	if (action === "limit") {
		return openValueModal(
			interaction,
			"limit",
			vc.channelId,
			"Set user limit",
			"User limit (0 = unlimited)",
			Number(vc.userLimit) || 0,
			2,
			"0-99",
		);
	}

	if (action === "bitrate") {
		return openValueModal(
			interaction,
			"bitrate",
			vc.channelId,
			"Set bitrate",
			`Bitrate in kbps (8-${vm.maxBitrateKbps(interaction.guild)})`,
			Number(vc.bitrate) || 64,
			3,
			`8-${vm.maxBitrateKbps(interaction.guild)}`,
		);
	}

	if (action === "permit") {
		return openValueModal(
			interaction,
			"permit",
			vc.channelId,
			"Allow a member",
			"User ID or @mention",
			"",
			40,
			"Paste a user ID or mention",
		);
	}

	if (action === "kick") {
		return openValueModal(
			interaction,
			"kick",
			vc.channelId,
			"Kick a member",
			"User ID or @mention",
			"",
			40,
			"Paste a user ID or mention",
		);
	}

	if (action === "transfer") {
		return openValueModal(
			interaction,
			"transfer",
			vc.channelId,
			"Transfer ownership",
			"User ID or @mention",
			"",
			40,
			"Paste a user ID or mention",
		);
	}

	if (action === "claim") {
		if (vc.ownerId === interaction.user.id) {
			return respond(interaction, "You already own this channel.");
		}
		if (!channel.members.has(interaction.user.id)) {
			return respond(interaction, "Join the channel before claiming it.");
		}
		if (channel.members.has(vc.ownerId)) {
			return respond(interaction, "The current owner is still in the channel.");
		}

		const previousOwner = vc.ownerId;
		vc.ownerId = interaction.user.id;
		await prisma.voiceChannel.update({
			where: { channelId: vc.channelId },
			data: { ownerId: vc.ownerId },
		});
		await channel.permissionOverwrites.delete(previousOwner).catch(() => {});
		await vm.applyPermissions({ client, guild: interaction.guild, channel, vc, cfg });
		await respond(interaction, "You are now the channel owner.");
		return refreshInterface(client, interaction.guild, vc, channel);
	}

	if (action === "delete") {
		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`vm_delete_confirm:${vc.channelId}`)
				.setLabel("Delete channel")
				.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
				.setCustomId("vm_cancel")
				.setLabel("Cancel")
				.setStyle(ButtonStyle.Secondary),
		);
		return respond(interaction, "Delete this voice channel for everyone?", [row]);
	}

	return respond(interaction, "That control is no longer available.");
}

async function handleModal(interaction, client, prisma) {
	const [modalId, channelId] = interaction.customId.split(":");
	const action = modalId.replace("vm_modal_", "");
	const target = await resolveTarget(interaction, prisma, channelId);
	if (target.error) return respond(interaction, target.error);
	if (!canManage(interaction, target.vc)) {
		return respond(interaction, "Only the channel owner or staff can use these.");
	}

	const { vc, channel } = target;
	const value = interaction.fields.getTextInputValue("value").trim();
	const cfg = await getConfig(prisma, interaction.guild.id);

	if (action === "rename") {
		if (!value) return respond(interaction, "Enter a channel name.");
		if (value.length > 100) return respond(interaction, "Channel names cannot be longer than 100 characters.");

		const updated = await channel.setName(value, "VoiceMaster rename").catch((err) => {
			log.warn("Failed to rename channel: " + err.message);
			return null;
		});
		if (!updated) return respond(interaction, "I could not rename that channel.");

		vc.name = value;
		await prisma.voiceChannel.update({
			where: { channelId: vc.channelId },
			data: { name: value },
		});
		await respond(interaction, `Channel renamed to **${value}**.`);
		return refreshInterface(client, interaction.guild, vc, channel);
	}

	if (action === "limit") {
		const limit = Number.parseInt(value, 10);
		if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
			return respond(interaction, "Enter a number from 0 to 99. Use 0 for unlimited.");
		}

		const updated = await channel.setUserLimit(limit).catch(() => null);
		if (!updated) return respond(interaction, "I could not update the user limit.");

		vc.userLimit = limit;
		await prisma.voiceChannel.update({
			where: { channelId: vc.channelId },
			data: { userLimit: limit },
		});
		await respond(interaction, `User limit set to **${limit || "unlimited"}**.`);
		return refreshInterface(client, interaction.guild, vc, channel);
	}

	if (action === "bitrate") {
		const max = vm.maxBitrateKbps(interaction.guild);
		const bitrate = Number.parseInt(value, 10);
		if (!Number.isInteger(bitrate) || bitrate < 8 || bitrate > max) {
			return respond(interaction, `Enter a bitrate from 8 to ${max} kbps.`);
		}

		const updated = await channel.setBitrate(bitrate * 1000).catch(() => null);
		if (!updated) return respond(interaction, "I could not update the bitrate.");

		vc.bitrate = bitrate;
		await prisma.voiceChannel.update({
			where: { channelId: vc.channelId },
			data: { bitrate },
		});
		await respond(interaction, `Bitrate set to **${bitrate} kbps**.`);
		return refreshInterface(client, interaction.guild, vc, channel);
	}

	const userId = parseUserId(value);
	if (!userId) return respond(interaction, "Paste a valid user ID or mention.");

	const member = await interaction.guild.members.fetch(userId).catch(() => null);
	if (!member) return respond(interaction, "I could not find that member in this server.");

	if (action === "permit") {
		await channel.permissionOverwrites
			.edit(member.id, {
				ViewChannel: true,
				Connect: true,
				Speak: true,
				Stream: true,
			})
			.catch(() => {});
		await prisma.voiceChannelMember
			.upsert({
				where: { channelId_userId: { channelId: vc.channelId, userId: member.id } },
				create: { channelId: vc.channelId, userId: member.id, permitted: true },
				update: { permitted: true },
			})
			.catch(() => {});
		return respond(interaction, `${member} can now join your channel.`);
	}

	if (action === "kick") {
		if (member.id === vc.ownerId) return respond(interaction, "You cannot kick the channel owner.");
		if (!channel.members.has(member.id)) return respond(interaction, "That member is not in your channel.");

		await member.voice.disconnect("Kicked from VoiceMaster channel").catch(() => {});
		return respond(interaction, `${member} was kicked from the channel.`);
	}

	if (action === "transfer") {
		if (member.id === vc.ownerId) return respond(interaction, "That member already owns the channel.");
		if (!channel.members.has(member.id)) return respond(interaction, "That member must be in your channel.");

		const previousOwner = vc.ownerId;
		vc.ownerId = member.id;
		await prisma.voiceChannel.update({
			where: { channelId: vc.channelId },
			data: { ownerId: vc.ownerId },
		});
		await channel.permissionOverwrites.delete(previousOwner).catch(() => {});
		await vm.applyPermissions({ client, guild: interaction.guild, channel, vc, cfg });
		await respond(interaction, `Ownership transferred to ${member}.`);
		return refreshInterface(client, interaction.guild, vc, channel);
	}

	return respond(interaction, "That control is no longer available.");
}

module.exports = {
	name: Events.InteractionCreate,
	description: "Handles VoiceMaster control panel interactions",

	async execute(client, interaction) {
		if (!interaction.guild) return;

		if (interaction.isButton()) {
			const customId = interaction.customId || "";
			if (!customId.startsWith("vm_")) return;
			return handleButton(interaction, client, client.db.prisma).catch((err) => {
				log.error("VoiceMaster button error: " + err.message);
				return respond(interaction, "Something went wrong while updating the channel.").catch(() => {});
			});
		}

		if (interaction.isModalSubmit()) {
			const customId = interaction.customId || "";
			if (!customId.startsWith("vm_modal_")) return;
			return handleModal(interaction, client, client.db.prisma).catch((err) => {
				log.error("VoiceMaster modal error: " + err.message);
				return respond(interaction, "Something went wrong while updating the channel.").catch(() => {});
			});
		}
	},
};
