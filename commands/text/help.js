const {
	PermissionsBitField,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	ContainerBuilder,
	SeparatorSpacingSize,
	MessageFlags,
} = require("discord.js");
const { ArgsBuilder } = require("../../lib/argsBuilder");

// ─── Discord limits (the only hardcoded values in this file) ────────────

const CATEGORIES_PER_SELECT_PAGE = 25; // String select menu option cap
const COMMANDS_PER_PAGE = 6; // Keeps Section-based pages well under the 40-component budget
const MAX_FEATURED_DISPLAY = 6;
const COLLECTOR_TIME = 120_000;
const ACCENT_COLOR = 0x5865f2;

const UNLABELED_CATEGORY = "Unlabeled";
const DEFAULT_CATEGORY_EMOJI = "📁";
const DEFAULT_PREFIX = "c."; // Last-resort fallback only; see resolvePrefix()

// ─── Prefix resolution ───────────────────────────────────────────────────
//
// Never hardcode the prefix in the render logic. Try whatever prefix
// mechanism the bot actually exposes (a resolver function, a per-guild map,
// or a static client property), and only fall back to DEFAULT_PREFIX if
// nothing is configured.

function resolvePrefix(message) {
	const client = message.client;

	if (typeof client.getPrefix === "function") {
		const resolved = client.getPrefix(message.guildId, message);
		if (resolved) return resolved;
	}

	if (typeof client.prefixResolver === "function") {
		const resolved = client.prefixResolver(message);
		if (resolved) return resolved;
	}

	if (message.guildId && typeof client.guildPrefixes?.get === "function") {
		const guildPrefix = client.guildPrefixes.get(message.guildId);
		if (guildPrefix) return guildPrefix;
	}

	return client.prefix || client.config?.prefix || DEFAULT_PREFIX;
}

// ─── Category metadata resolution ────────────────────────────────────────
//
// `category` may be a plain string or a richer object with emoji,
// description, order, and hidden. Unknown/missing input always falls back
// to "Unlabeled" so nothing breaks for commands that haven't been updated.

function resolveCategoryMeta(cmd) {
	const raw = cmd.category;

	if (!raw)
		return {
			name: UNLABELED_CATEGORY,
			emoji: null,
			description: null,
			order: null,
			hidden: false,
		};

	if (typeof raw === "string") {
		const trimmed = raw.trim();
		return {
			name: trimmed || UNLABELED_CATEGORY,
			emoji: null,
			description: null,
			order: null,
			hidden: false,
		};
	}

	if (typeof raw === "object") {
		return {
			name: (raw.name && String(raw.name).trim()) || UNLABELED_CATEGORY,
			emoji: raw.emoji || null,
			description: raw.description || null,
			order: typeof raw.order === "number" ? raw.order : null,
			hidden: raw.hidden === true,
		};
	}

	return {
		name: UNLABELED_CATEGORY,
		emoji: null,
		description: null,
		order: null,
		hidden: false,
	};
}

function sortCategories(a, b) {
	if (a.name === UNLABELED_CATEGORY) return 1;
	if (b.name === UNLABELED_CATEGORY) return -1;

	const aHasOrder = typeof a.order === "number";
	const bHasOrder = typeof b.order === "number";

	if (aHasOrder && bHasOrder)
		return a.order - b.order || a.name.localeCompare(b.name);
	if (aHasOrder) return -1;
	if (bHasOrder) return 1;
	return a.name.localeCompare(b.name);
}

// ─── Metadata inheritance ────────────────────────────────────────────────
//
// Walks a command's subcommand tree, merging every field a node doesn't
// define itself down from its parent. `name` and `subcommands` are
// structural (identity + children), not descriptive metadata, so they're
// always recomputed rather than blindly inherited. Everything else —
// including fields that don't exist yet — inherits automatically because
// this is a generic object spread, not a fixed field list.

function buildResolvedTree(raw, flatAccumulator) {
	function walk(node, inheritedMeta, ownName, parentPath) {
		const ownMeta = { ...inheritedMeta, ...node };
		ownMeta.name = node.name || ownName;
		ownMeta.path = [...parentPath, ownMeta.name];

		const inheritableForChildren = { ...ownMeta };
		delete inheritableForChildren.path;
		delete inheritableForChildren.subcommands;

		const rawSubs = node.subcommands || {};
		const subEntries = Object.entries(rawSubs);
		const resolvedSubcommands = {};
		for (const [subName, subRaw] of subEntries) {
			resolvedSubcommands[subName] = walk(
				subRaw || {},
				inheritableForChildren,
				subName,
				ownMeta.path,
			);
		}
		ownMeta.subcommands = subEntries.length
			? resolvedSubcommands
			: undefined;

		flatAccumulator.push(ownMeta);
		return ownMeta;
	}

	return walk(raw, null, raw.name, []);
}

// ─── Index building (done once per invocation, consumed read-only) ─────

function buildIndex(textCommands) {
	const resolvedFlat = [];
	const resolvedRoots = [];

	for (const raw of textCommands.values()) {
		resolvedRoots.push(buildResolvedTree(raw, resolvedFlat));
	}

	const aliasIndex = new Map();
	for (const cmd of resolvedRoots) {
		aliasIndex.set(cmd.name.toLowerCase(), cmd);
		for (const alias of cmd.aliases || [])
			aliasIndex.set(alias.toLowerCase(), cmd);
	}

	const commandGlobalIndex = new Map(
		resolvedFlat.map((node, i) => [node, i]),
	);

	const browsableRoots = resolvedRoots
		.filter((cmd) => !cmd.hidden && !resolveCategoryMeta(cmd).hidden)
		.sort((a, b) => a.name.localeCompare(b.name));

	const searchCorpus = resolvedFlat.filter(
		(node) => !node.hidden && !resolveCategoryMeta(node).hidden,
	);

	const byCategory = new Map();
	for (const cmd of browsableRoots) {
		const meta = resolveCategoryMeta(cmd);
		if (!byCategory.has(meta.name)) {
			byCategory.set(meta.name, {
				emoji: null,
				description: null,
				order: null,
				commands: [],
			});
		}
		const bucket = byCategory.get(meta.name);
		bucket.commands.push(cmd);
		if (meta.emoji && !bucket.emoji) bucket.emoji = meta.emoji;
		if (meta.description && !bucket.description)
			bucket.description = meta.description;
		if (meta.order !== null && bucket.order === null)
			bucket.order = meta.order;
	}
	for (const bucket of byCategory.values()) {
		bucket.commands.sort((a, b) => a.name.localeCompare(b.name));
	}

	const categoryList = [...byCategory.entries()]
		.map(([name, data]) => ({ name, ...data }))
		.sort(sortCategories);

	const featuredCommands = browsableRoots.filter((cmd) => cmd.featured);

	return {
		aliasIndex,
		commandGlobalIndex,
		resolvedFlat,
		visibleCommands: browsableRoots,
		categoryList,
		searchCorpus,
		featuredCommands,
		totalCommands: browsableRoots.length,
		totalCategories: categoryList.length,
	};
}

function findCommand(aliasIndex, query) {
	return aliasIndex.get(query.toLowerCase()) || null;
}

function paginate(items, page, pageSize) {
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
	const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
	const start = clampedPage * pageSize;
	return {
		items: items.slice(start, start + pageSize),
		page: clampedPage,
		totalPages,
	};
}

// ─── Component ID helpers ────────────────────────────────────────────────

const ID_PREFIX = "help";
const ID_DELIMITER = "|";

function createComponentId(msgId, action, args = []) {
	return [ID_PREFIX, msgId, action, ...args].join(ID_DELIMITER);
}

function parseComponentId(customId) {
	const [prefix, msgId, action, ...args] = customId.split(ID_DELIMITER);
	return { prefix, msgId, action, args };
}

// ─── Search ───────────────────────────────────────────────────────────────

function fuzzyScore(query, target) {
	if (!query || !target) return -1;
	const q = query.toLowerCase();
	const t = target.toLowerCase();

	if (t.includes(q)) return 1000 - t.indexOf(q);

	let qi = 0;
	let score = 0;
	let lastMatchIndex = -1;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			score += lastMatchIndex === ti - 1 ? 5 : 1;
			lastMatchIndex = ti;
			qi++;
		}
	}
	return qi === q.length ? score : -1;
}

function scoreCommand(cmd, query) {
	const label = cmd.path ? cmd.path.join(" ") : cmd.name;
	const nameScore = fuzzyScore(query, label);
	const aliasScore = cmd.aliases?.length
		? Math.max(...cmd.aliases.map((a) => fuzzyScore(query, a)))
		: -1;
	const descScore = cmd.description
		? fuzzyScore(query, cmd.description) / 4
		: -1;
	return Math.max(nameScore, aliasScore, descScore);
}

function searchCommands(corpus, query) {
	if (!query) return [];
	const scored = [];
	for (const cmd of corpus) {
		const score = scoreCommand(cmd, query);
		if (score > -1) scored.push({ cmd, score });
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.map((s) => s.cmd);
}

// ─── Text formatting helpers ──────────────────────────────────────────────

function pluralize(count, singular, plural = `${singular}s`) {
	return `${count} ${count === 1 ? singular : plural}`;
}

function truncate(str, max) {
	if (!str) return str;
	return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function prettifyKey(key) {
	return key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/^./, (c) => c.toUpperCase());
}

function stringifyValue(value, prefix) {
	if (value === null || value === undefined) return "";
	if (typeof value === "string")
		return prefix && value.startsWith(prefix) ? `\`${value}\`` : value;
	if (typeof value === "bigint") return value.toString();
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (typeof value === "function") return "";
	try {
		return JSON.stringify(value, (_, v) => {
			if (typeof v === "bigint") return v.toString();
			if (typeof v === "function") return undefined;
			return v;
		});
	} catch {
		return "[complex value]";
	}
}

// Renders any metadata field generically: booleans only when true, arrays
// as bullet lists, plain objects as key/value pairs, everything else as
// natural text. New fields on a command object need zero changes here.
function resolvePermission(value) {
	if (typeof value === "number") {
		const flag = Object.entries(PermissionsBitField.Flags).find(
			([, v]) => v === value,
		);
		if (flag) return flag[0];
	}
	return null;
}

function isPermissionField(key) {
	return /perm/i.test(key);
}

function renderGenericField(key, value, prefix) {
	if (value === null || value === undefined || typeof value === "function")
		return null;

	if (typeof value === "boolean") {
		return value ? `⚠️ **${prettifyKey(key)}**` : null;
	}

	if (Array.isArray(value)) {
		if (!value.length) return null;
		const items = isPermissionField(key)
			? value.map((v) => {
				const name = resolvePermission(v);
				return name || String(v);
			})
			: value.map((v) => stringifyValue(v, prefix));
		return `**${prettifyKey(key)}**\n${items.map((v) => `• ${v}`).join("\n")}`;
	}

	if (typeof value === "object") {
		const entries = Object.entries(value).filter(
			([, v]) => v !== undefined && typeof v !== "function",
		);
		if (!entries.length) return null;
		return `**${prettifyKey(key)}**\n${entries.map(([k, v]) => {
			const resolved = isPermissionField(key) ? resolvePermission(v) : null;
			return `${prettifyKey(k)}: ${resolved || stringifyValue(v, prefix)}`;
		}).join("\n")}`;
	}

	return `**${prettifyKey(key)}**\n${stringifyValue(value, prefix)}`;
}

function formatCommandHeading(cmd, prefix) {
	const icon = cmd.emoji ? `${cmd.emoji} ` : "";
	const label = cmd.path?.length ? cmd.path.join(" ") : cmd.name;
	return `${icon}**\`${prefix}${label}\`**`;
}

function formatCommandMeta(cmd, prefix) {
	const subCount = cmd.subcommands ? Object.keys(cmd.subcommands).length : 0;
	const parts = [];
	if (subCount) parts.push(pluralize(subCount, "subcommand"));
	if (cmd.aliases?.length) {
		parts.push(
			`aliases: ${cmd.aliases.map((a) => `\`${prefix}${a}\``).join(", ")}`,
		);
	}
	return parts.join(" • ");
}

// Fields handled specially elsewhere (title, category block, aliases,
// the interactive subcommand browser) or that are internal plumbing rather
// than display metadata. Everything else renders generically and
// automatically.
const DISPLAY_EXCLUDED_FIELDS = new Set([
	"name",
	"subcommands",
	"path",
	"category",
	"aliases",
	"description",
	"execute",
	"args",
	"commandId",
	"requiredBotPermissions",
	"hidden",
	"featured",
	"emoji",
	"parentRef",
]);

// Known fields get a fixed, sensible order; anything not in this list still
// renders (see the generic pass below), just without a curated position.
const KNOWN_FIELD_ORDER = [
	"usage",
	"examples",
	"cooldown",
	"permissions",
	"beta",
	"deprecated",
];

function buildDetailSections(cmd, prefix) {
	const sections = [
		`**Description**\n${cmd.description || "No description provided."}`,
	];

	const { name: categoryName, emoji: categoryEmoji } =
		resolveCategoryMeta(cmd);
	sections.push(
		`**Category**\n${categoryEmoji || DEFAULT_CATEGORY_EMOJI} ${categoryName}`,
	);

	for (const key of KNOWN_FIELD_ORDER) {
		if (!(key in cmd)) continue;
		const rendered = renderGenericField(key, cmd[key], prefix);
		if (rendered) sections.push(rendered);
	}

	if (cmd.aliases?.length) {
		sections.push(
			`**Aliases**\n${cmd.aliases.map((a) => `\`${prefix}${a}\``).join(", ")}`,
		);
	}

	const knownKeys = new Set([
		...DISPLAY_EXCLUDED_FIELDS,
		...KNOWN_FIELD_ORDER,
	]);
	for (const key of Object.keys(cmd)) {
		if (knownKeys.has(key)) continue;
		const rendered = renderGenericField(key, cmd[key], prefix);
		if (rendered) sections.push(rendered);
	}

	return sections;
}

// ─── Component builders ─────────────────────────────────────────────────

function addSeparator(container, spacing = SeparatorSpacingSize.Small) {
	container.addSeparatorComponents((sep) =>
		sep.setDivider(true).setSpacing(spacing),
	);
	return container;
}

function buildHomeButton(msgId, disabled) {
	return new ButtonBuilder()
		.setCustomId(createComponentId(msgId, "home"))
		.setLabel("🏠 Home")
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(disabled);
}

function buildBackButton(msgId, disabled, hasHistory) {
	return new ButtonBuilder()
		.setCustomId(createComponentId(msgId, "back"))
		.setLabel("◀ Back")
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(disabled || !hasHistory);
}

function buildCommandSection(ctx, cmd, msgId, disabled) {
	const globalIndex = ctx.commandGlobalIndex.get(cmd);
	const meta = formatCommandMeta(cmd, ctx.prefix);
	const lines = [
		formatCommandHeading(cmd, ctx.prefix),
		cmd.description || "No description provided.",
	];
	if (meta) lines.push(`*${meta}*`);

	return (section) =>
		section
			.addTextDisplayComponents((td) => td.setContent(lines.join("\n")))
			.setButtonAccessory((btn) =>
				btn
					.setCustomId(
						createComponentId(msgId, "detail", [globalIndex]),
					)
					.setLabel("Details")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(disabled),
			);
}

function addCommandSections(ctx, container, commands, msgId, disabled) {
	commands.forEach((cmd, i) => {
		container.addSectionComponents(
			buildCommandSection(ctx, cmd, msgId, disabled),
		);
		if (i < commands.length - 1) addSeparator(container);
	});
}

function buildPageNavRow(
	msgId,
	action,
	actionArgs,
	page,
	totalPages,
	disabled,
) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(
				createComponentId(msgId, action, [
					...actionArgs,
					Math.max(page - 1, 0),
				]),
			)
			.setLabel("◀ Previous")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled || page === 0),
		new ButtonBuilder()
			.setCustomId(
				createComponentId(msgId, action, [
					...actionArgs,
					Math.min(page + 1, totalPages - 1),
				]),
			)
			.setLabel("Next ▶")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled || page === totalPages - 1),
	);
}

function buildCategorySelectRows(ctx, state, disabled) {
	const { items, page, totalPages } = paginate(
		ctx.categoryList,
		state.categoryPage,
		CATEGORIES_PER_SELECT_PAGE,
	);

	const options = items.map((cat, i) => ({
		label: truncate(cat.name, 100),
		description: truncate(
			cat.description || pluralize(cat.commands.length, "command"),
			100,
		),
		value: String(page * CATEGORIES_PER_SELECT_PAGE + i),
		emoji: cat.emoji ? { name: cat.emoji } : undefined,
	}));

	const placeholder =
		totalPages > 1
			? `Browse categories… (page ${page + 1}/${totalPages})`
			: `Browse categories… (${pluralize(ctx.totalCategories, "category", "categories")})`;

	const rows = [
		new ActionRowBuilder().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(createComponentId(state.msgId, "selectcat"))
				.setPlaceholder(placeholder)
				.setDisabled(disabled || !options.length)
				.addOptions(
					...(options.length
						? options
						: [
								{
									label: "No categories available",
									value: "none",
								},
							]),
				),
		),
	];

	if (totalPages > 1) {
		rows.push(
			buildPageNavRow(
				state.msgId,
				"catpage",
				[],
				page,
				totalPages,
				disabled,
			),
		);
	}

	return rows;
}

// Shared by category / all-commands / search views so pagination and
// section rendering only exist in one place.
function buildListContainer(ctx, state, disabled, config) {
	const {
		header,
		subheader,
		commands,
		emptyText,
		action,
		actionArgs = [],
	} = config;
	const container = new ContainerBuilder().setAccentColor(ACCENT_COLOR);

	container.addTextDisplayComponents((td) => td.setContent(header));
	if (subheader)
		container.addTextDisplayComponents((td) => td.setContent(subheader));
	addSeparator(container, SeparatorSpacingSize.Large);

	const { items, page, totalPages } = paginate(
		commands,
		state.page,
		COMMANDS_PER_PAGE,
	);

	if (!items.length) {
		container.addTextDisplayComponents((td) => td.setContent(emptyText));
	} else {
		addCommandSections(ctx, container, items, state.msgId, disabled);
	}

	addSeparator(container);
	container.addTextDisplayComponents((td) =>
		td.setContent(`Page ${page + 1}/${totalPages}`),
	);

	if (totalPages > 1) {
		container.addActionRowComponents(
			buildPageNavRow(
				state.msgId,
				action,
				actionArgs,
				page,
				totalPages,
				disabled,
			),
		);
	}

	container.addActionRowComponents((row) =>
		row.addComponents(buildHomeButton(state.msgId, disabled)),
	);

	return container;
}

function buildHomeContainer(ctx, state, disabled) {
	const botName = ctx.client.user?.username || "the bot";
	const container = new ContainerBuilder().setAccentColor(ACCENT_COLOR);

	container.addTextDisplayComponents((td) =>
		td.setContent(`# ${botName} Help`),
	);
	container.addTextDisplayComponents((td) =>
		td.setContent(
			`Welcome to ${botName}! ${pluralize(ctx.totalCommands, "command")} across ${pluralize(ctx.totalCategories, "category", "categories")}.`,
		),
	);

	if (ctx.featuredCommands.length) {
		addSeparator(container);
		container.addTextDisplayComponents((td) =>
			td.setContent("### ⭐ Featured Commands"),
		);
		const featuredText = ctx.featuredCommands
			.slice(0, MAX_FEATURED_DISPLAY)
			.map(
				(c) =>
					`${formatCommandHeading(c, ctx.prefix)}\n${c.description || "No description provided."}`,
			)
			.join("\n\n");
		container.addTextDisplayComponents((td) => td.setContent(featuredText));
	}

	addSeparator(container, SeparatorSpacingSize.Large);

	if (!ctx.totalCategories) {
		container.addTextDisplayComponents((td) =>
			td.setContent("*No commands are currently available.*"),
		);
		return container;
	}

	container.addTextDisplayComponents((td) => td.setContent("**Categories**"));
	container.addActionRowComponents(
		...buildCategorySelectRows(ctx, state, disabled),
	);

	addSeparator(container);
	container.addActionRowComponents((row) =>
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(createComponentId(state.msgId, "viewall", [0]))
				.setLabel(`📚 View All Commands (${ctx.totalCommands})`)
				.setStyle(ButtonStyle.Success)
				.setDisabled(disabled || !ctx.totalCommands),
		),
	);

	return container;
}

function buildCategoryContainer(ctx, state, disabled) {
	const category = ctx.categoryList[state.catIndex];

	if (!category) {
		const container = new ContainerBuilder().setAccentColor(ACCENT_COLOR);
		container.addTextDisplayComponents((td) =>
			td.setContent("*This category no longer exists.*"),
		);
		addSeparator(container);
		container.addActionRowComponents((row) =>
			row.addComponents(buildHomeButton(state.msgId, disabled)),
		);
		return container;
	}

	const icon = category.emoji || DEFAULT_CATEGORY_EMOJI;
	return buildListContainer(ctx, state, disabled, {
		header: `# ${icon} ${category.name}`,
		subheader:
			category.description ||
			pluralize(category.commands.length, "command"),
		commands: category.commands,
		emptyText: "*No commands in this category.*",
		action: "viewcat",
		actionArgs: [state.catIndex],
	});
}

function buildAllCommandsContainer(ctx, state, disabled) {
	return buildListContainer(ctx, state, disabled, {
		header: "# 📚 All Commands",
		subheader: pluralize(ctx.totalCommands, "command"),
		commands: ctx.visibleCommands,
		emptyText: "*No commands are currently available.*",
		action: "viewall",
	});
}

function buildSearchContainer(ctx, state, disabled) {
	const query = state.searchQuery || "";
	const results = searchCommands(ctx.searchCorpus, query);

	return buildListContainer(ctx, state, disabled, {
		header: "# 🔎 Search Results",
		subheader: query
			? `Results for "${query}" — ${pluralize(results.length, "match", "matches")}`
			: "Enter a search term.",
		commands: results,
		emptyText: "*No commands matched your search.*",
		action: "search",
	});
}

// The detail view doubles as a subcommand browser: if the command has
// children, they're rendered as the same paginated Section list used
// everywhere else, and each child's "Details" button recurses into this
// same view — so nesting depth is never hardcoded.
function buildCommandDetailContainer(ctx, cmd, state, disabled) {
	const container = new ContainerBuilder().setAccentColor(ACCENT_COLOR);
	const icon = cmd.emoji ? `${cmd.emoji} ` : "";
	const label = cmd.path?.length ? cmd.path.join(" ") : cmd.name;

	container.addTextDisplayComponents((td) =>
		td.setContent(`# ${icon}Help: ${label}`),
	);
	addSeparator(container, SeparatorSpacingSize.Large);

	const sections = buildDetailSections(cmd, ctx.prefix);
	container.addTextDisplayComponents((td) =>
		td.setContent(sections.join("\n\n")),
	);

	const subcommands = cmd.subcommands ? Object.values(cmd.subcommands) : [];
	if (subcommands.length) {
		addSeparator(container, SeparatorSpacingSize.Large);
		container.addTextDisplayComponents((td) =>
			td.setContent(
				`**Subcommands** — ${pluralize(subcommands.length, "command")}`,
			),
		);

		const { items, page, totalPages } = paginate(
			subcommands,
			state.detailPage,
			COMMANDS_PER_PAGE,
		);
		addCommandSections(ctx, container, items, state.msgId, disabled);

		addSeparator(container);
		container.addTextDisplayComponents((td) =>
			td.setContent(`Page ${page + 1}/${totalPages}`),
		);

		if (totalPages > 1) {
			container.addActionRowComponents(
				buildPageNavRow(
					state.msgId,
					"detailpage",
					[],
					page,
					totalPages,
					disabled,
				),
			);
		}
	}

	addSeparator(container);
	container.addActionRowComponents((row) =>
		row.addComponents(
			buildBackButton(state.msgId, disabled, state.stack.length > 0),
			buildHomeButton(state.msgId, disabled),
		),
	);

	return container;
}

function buildView(ctx, state, disabled = false) {
	switch (state.view) {
		case "category":
			return buildCategoryContainer(ctx, state, disabled);
		case "all":
			return buildAllCommandsContainer(ctx, state, disabled);
		case "search":
			return buildSearchContainer(ctx, state, disabled);
		case "detail": {
			const cmd = ctx.resolvedFlat[state.detailIndex];
			if (!cmd) {
				state.view = "home";
				state.stack = [];
				return buildHomeContainer(ctx, state, disabled);
			}
			return buildCommandDetailContainer(ctx, cmd, state, disabled);
		}
		case "home":
		default:
			return buildHomeContainer(ctx, state, disabled);
	}
}

// ─── Interaction state machine ───────────────────────────────────────────
//
// `state.stack` is a history of snapshots. Entering a detail view (from a
// list, or by drilling into a subcommand from another detail view) pushes
// the current snapshot; "Back" pops one level regardless of how deep the
// subcommand nesting goes. Paginating within a view never touches the
// stack.

const SNAPSHOT_FIELDS = [
	"view",
	"categoryPage",
	"catIndex",
	"page",
	"detailIndex",
	"detailPage",
	"searchQuery",
];

function snapshotState(state) {
	const snapshot = {};
	for (const field of SNAPSHOT_FIELDS) snapshot[field] = state[field];
	return snapshot;
}

function pushHistory(state) {
	state.stack.push(snapshotState(state));
}

function popHistory(state) {
	const previous = state.stack.pop();
	if (previous) {
		Object.assign(state, previous);
	} else {
		state.view = "home";
	}
}

function applyAction(state, action, idArgs) {
	switch (action) {
		case "home":
			state.view = "home";
			state.stack = [];
			return true;
		case "catpage":
			state.view = "home";
			state.categoryPage = Number(idArgs[0]) || 0;
			return true;
		case "viewcat":
			state.view = "category";
			state.catIndex = Number(idArgs[0]);
			state.page = Number(idArgs[1]) || 0;
			return true;
		case "viewall":
			state.view = "all";
			state.page = Number(idArgs[0]) || 0;
			return true;
		case "search":
			state.view = "search";
			state.page = Number(idArgs[0]) || 0;
			return true;
		case "detail":
			pushHistory(state);
			state.view = "detail";
			state.detailIndex = Number(idArgs[0]);
			state.detailPage = 0;
			return true;
		case "detailpage":
			state.detailPage = Number(idArgs[0]) || 0;
			return true;
		case "back":
			popHistory(state);
			return true;
		default:
			return false;
	}
}

async function startBrowser(message, ctx, initialState) {
	const state = {
		view: "home",
		categoryPage: 0,
		catIndex: null,
		page: 0,
		detailIndex: null,
		detailPage: 0,
		searchQuery: null,
		stack: [],
		msgId: null,
		...initialState,
	};

	const msg = await message.reply({ content: "Loading help menu..." });
	state.msgId = msg.id;

	await msg.edit({
		content: "",
		components: [buildView(ctx, state, false)],
		flags: MessageFlags.IsComponentsV2,
	});

	const collector = msg.createMessageComponentCollector({
		time: COLLECTOR_TIME,
	});

	collector.on("collect", async (interaction) => {
		if (interaction.user.id !== message.author.id) {
			return interaction.reply({
				content: "🚫 You can't control this help menu.",
				flags: MessageFlags.Ephemeral,
			});
		}

		if (interaction.isStringSelectMenu()) {
			const { msgId, action } = parseComponentId(interaction.customId);
			if (msgId !== msg.id || action !== "selectcat") return;

			const chosenIndex = Number(interaction.values[0]);
			if (
				!Number.isInteger(chosenIndex) ||
				!ctx.categoryList[chosenIndex]
			)
				return;

			state.view = "category";
			state.catIndex = chosenIndex;
			state.page = 0;
		} else if (interaction.isButton()) {
			const {
				msgId,
				action,
				args: idArgs,
			} = parseComponentId(interaction.customId);
			if (msgId !== msg.id) return;
			if (!applyAction(state, action, idArgs)) return;
		} else {
			return;
		}

		await interaction.update({
			components: [buildView(ctx, state, false)],
			flags: MessageFlags.IsComponentsV2,
		});
	});

	collector.on("end", async () => {
		await msg
			.edit({
				components: [buildView(ctx, state, true)],
				flags: MessageFlags.IsComponentsV2,
			})
			.catch(() => {});
	});
}

// ─── Command ────────────────────────────────────────────────────────────

module.exports = {
	commandId: "b0f7624f-a39e-49b2-b653-e0c61c15b2e5",
	name: "help",
	description: "List all commands or get info about a specific command.",
	category: {
		name: "Bot",
		emoji: "🤖",
		description: "Bot information and configuration.",
		order: 10,
	},
	args: ArgsBuilder.create().string("command", {
		description: "Command to get help for",
	}),
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	aliases: ["h"],

	async execute(message, args) {
		const { textCommands } = message.client;
		const prefix = resolvePrefix(message);
		const ctx = {
			...buildIndex(textCommands),
			client: message.client,
			prefix,
		};

		// c.help search <query> — enters the interactive browser on the search view.
		if (args[0]?.toLowerCase() === "search") {
			const query = args.slice(1).join(" ").trim();
			if (!query) {
				return message.reply(`Usage: \`${prefix}help search <query>\``);
			}
			return startBrowser(message, ctx, {
				view: "search",
				searchQuery: query,
				page: 0,
			});
		}

		// c.help <command> — interactive detail view. Subcommands (if any) are
		// browsable from here, recursively, via the same "detail" action.
		if (args.length) {
			const cmd = findCommand(ctx.aliasIndex, args[0]);

			if (!cmd) {
				return message.reply(
					`I couldn't find a command named \`${args[0]}\`.`,
				);
			}

			const detailIndex = ctx.commandGlobalIndex.get(cmd);
			return startBrowser(message, ctx, {
				view: "detail",
				detailIndex,
				detailPage: 0,
			});
		}

		// c.help — interactive browser starting at the home screen.
		return startBrowser(message, ctx, { view: "home" });
	},
};
