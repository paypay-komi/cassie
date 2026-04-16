const Discord = require("discord.js");
const db = require("../../../db/boobs.js");
const ct = require("countries-and-timezones");

module.exports = {
	name: "set",
	description: "sets your time zone following a simple flow",
	parent: "time",

	/**
	 * @param {Discord.Message} message
	 * @param {String[]} args
	 */
	async execute(message, args) {
		if (args.length === 0) {
			return message.reply(
				"please include your current time either in 24H time or 12H time",
			);
		}

		const joinedArgs = args.join(" ").trim();

		const regex12Hour = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*([ap]m)$/i;
		const regex24Hour = /^([01]\d|2[0-3])([0-5]\d)$/i;

		const match12 = joinedArgs.match(regex12Hour);
		const match24 = joinedArgs.match(regex24Hour);

		if (!match12 && !match24) {
			return message.reply(
				"no valid time found. For 12h use hh:mm am/pm. For 24h use HHmm (no colon).",
			);
		}

		// Convert user time → 24h
		let userHour = NaN;
		let userMin = 0;

		if (match12) {
			let hour = parseInt(match12[1], 10);
			userMin = parseInt(match12[2], 10);
			const period = match12[3].toLowerCase();

			if (period === "am") {
				userHour = hour === 12 ? 0 : hour;
			} else {
				userHour = hour === 12 ? 12 : hour + 12;
			}
		}

		if (match24) {
			userHour = parseInt(match24[1], 10);
			userMin = parseInt(match24[2], 10);
		}

		// Compute offset
		const now = new Date();
		const utcHour = now.getUTCHours();
		const utcMin = now.getUTCMinutes();

		const sysTotal = utcHour * 60 + utcMin;
		const userTotal = userHour * 60 + userMin;

		let offsetMinutes = userTotal - sysTotal;

		// Normalize to ±12 hours
		if (offsetMinutes > 720) offsetMinutes -= 1440;
		if (offsetMinutes < -720) offsetMinutes += 1440;

		const offsetHours = offsetMinutes / 60;

		// Ask user if they want to pick a real timezone
		const row = new Discord.ActionRowBuilder().addComponents(
			new Discord.ButtonBuilder()
				.setCustomId(`time-set_yes_${message.author.id}`)
				.setLabel("✅")
				.setStyle(Discord.ButtonStyle.Primary),
			new Discord.ButtonBuilder()
				.setCustomId(`time-set_no_${message.author.id}`)
				.setLabel("❎")
				.setStyle(Discord.ButtonStyle.Secondary),
		);

		const question = await message.reply({
			content: `Your timezone offset is approximately **${offsetHours.toFixed(
				2,
			)} hours** from UTC.\nWould you like to select your exact timezone (for DST accuracy)?`,
			components: [row],
		});

		const collector = question.createMessageComponentCollector({
			time: 60000,
			componentType: Discord.ComponentType.Button,
		});

		collector.on("collect", async (interaction) => {
			if (!interaction.isButton()) return;

			const [prefix, choice, creatorId] = interaction.customId.split("_");

			if (creatorId !== interaction.user.id) {
				return interaction.reply({
					content: "this is not your message",
					flags: Discord.MessageFlags.Ephemeral,
				});
			}

			await interaction.deferUpdate();
			collector.stop(choice);
		});
		/**
		 * @param {ct.Timezone[]} options
		 */
		function paganateMenu(options) {
			let current_page = 0;
			// used for inteelesn4e
			/** @type {ct.Timezone[][]} */
			const pages = [];
			const max_page_length = 25;
			const left_over_options = options;

			let current_page_array = [];
			while (left_over_options.length > 0) {
				current_page_array.push(left_over_options.pop());
				if (current_page_array.length == max_page_length) {
					pages.push(current_page_array);
					current_page_array = [];
				}
			}
			if (current_page_array.length > 0) {
				pages.push(current_page_array);
				current_page_array = [];
			}
			console.log(pages);
			const option_collector = question.createMessageComponentCollector({
				idle: 60_000,
			});
			function create_selection_menu_row() {
				const select_menu = new Discord.StringSelectMenuBuilder();
				console.log(current_page);
				const this_pages_options = pages[current_page];
				console.log(this_pages_options);
				for (let i = 0; i < this_pages_options.length; i++) {
					const this_option = this_pages_options[i];
					select_menu.addOptions(
						new Discord.StringSelectMenuOptionBuilder()
							.setLabel(this_option.name)
							.setValue(this_option.name),
					);
				}
				return new Discord.ActionRowBuilder().addComponents(
					select_menu
						.setPlaceholder(
							"select timezone or use the arrows below if not found",
						)
						.setCustomId("timezone_menu"),
				);
			}
			const button_row = new Discord.ActionRowBuilder().addComponents(
				new Discord.ButtonBuilder()
					.setCustomId("last")
					.setLabel("⬅️")
					.setStyle(Discord.ButtonStyle.Secondary),
				new Discord.ButtonBuilder()
					.setCustomId("next")
					.setLabel("➡️")
					.setStyle(Discord.ButtonStyle.Secondary),
			);
			function update_message() {
				// remove the old page line if it exists
				const contentWithoutPage = question.content.replace(
					/\npage: \d+$/,
					"",
				);

				return question.edit({
					components: [create_selection_menu_row(), button_row],
					content: `${contentWithoutPage}\npage: ${current_page}`,
				});
			}
			update_message();
			option_collector.on("collect", async (i) => {
				if (i.user.id !== message.author.id)
					return i.reply({ content: "this is not your message!!!" });
				// always ackloage it
				i.deferUpdate();
				if (i.isButton()) {
					let direction = NaN;
					if (i.customId == "next") {
						direction = 1;
					}
					if (i.customId == "last") {
						direction = -1;
					}
					if (isNaN(direction)) {
						return i.reply(
							`invalid button press of id ${i.customId} should be either "next" or "last" (how did you manage this contact my owner if you did )`,
						);
					}
					current_page = current_page + direction;
					if (current_page < 0) current_page = pages.length - 1;
					// wraps around
					current_page = current_page % pages.length;
				}
				if (i.isStringSelectMenu()) {
					await db.prisma.userTimezone.upsert({
						where: { userId: message.author.id },
						update: {
							timeZoneString: i.values[0],
							minsOffset: 0,
						},
						create: {
							userId: message.author.id,
							timeZoneString: i.values[0],
							minsOffset: 0,
						},
					});

					return option_collector.stop("time zone selected");
				}
				await update_message();
			});
			option_collector.on("end", (collected, reason) => {
				if (reason == "time") {
					question.edit({
						content: `# TIMED OUT \n ## try again \n ${question.content}`,
						components: [],
					});
				}
				if (reason == "time zone selected") {
					question.edit({
						content: `# saved to the db~`,
						components: [],
					});
				}
			});
		}
		collector.on("end", async (_, reason) => {
			if (reason === "yes") {
				// Find matching timezones (DST-aware)
				const zones = Object.values(ct.getAllTimezones()).filter(
					(tz) =>
						tz.utcOffset === offsetMinutes ||
						tz.dstOffset === offsetMinutes,
				);

				if (zones.length === 0) {
					await db.prisma.userTimezone.upsert({
						where: { userId: message.author.id },
						create: {
							userId: message.author.id,
							minsOffset: offsetMinutes,
						},
						update: { minsOffset: offsetMinutes },
					});
					return question.edit({
						content:
							"### setting raw offset \n no timezones found for this offset \n maybe you entered your time wrong? ",
						components: [],
					});
				}
				await question.edit({
					content:
						"Select your timezone from the drop-down menu below. Use the arrows to navigate between chunks.\n" +
						"If you don't see your exact state, you more than likely share a timezone with another one — select the closest one to you.\n" +
						"You can also select ETC/your_offset if you are not sure, but this won’t handle daylight saving time.",
					components: [],
				});
				paganateMenu(zones);
			}

			// User said no → store offset
			if (reason === "no" || reason === "time") {
				await db.prisma.userTimezone.upsert({
					where: { userId: message.author.id },
					create: {
						userId: message.author.id,
						minsOffset: offsetMinutes,
					},
					update: { minsOffset: offsetMinutes },
				});

				return question.edit({
					content: "Your offset was set.",
					components: [],
				});
			}
		});
	},
};
