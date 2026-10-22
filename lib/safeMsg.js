// utils/mentions.js

const MENTIONS = {
	ALL: {
		parse: ["users", "roles", "everyone"],
		repliedUser: true,
	},

	NONE: {
		parse: [],
		repliedUser: false,
	},

	ONLY_REPLY: {
		parse: [],
		repliedUser: true,
	},

	NO_REPLY: {
		parse: ["users", "roles", "everyone"],
		repliedUser: false,
	},

	NO_USERS: {
		parse: ["roles", "everyone"],
		repliedUser: true,
	},

	NO_ROLES: {
		parse: ["users", "everyone"],
		repliedUser: true,
	},

	NO_EVERYONE: {
		parse: ["users", "roles"],
		repliedUser: true,
	},
};

function pingSafeMesage(content, mentions = MENTIONS.NONE, extra = {}) {
	return {
		content,
		allowedMentions: mentions,
		...extra,
	};
}

module.exports = {
	MENTIONS,
	pingSafeMesage,
};
