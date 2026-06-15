/**
 * SlashAdapter — converts a Discord ChatInputCommandInteraction into a
 * fully functional fake Discord.Message that text commands can use
 * without modification.
 *
 * The fake message is a Proxy over the interaction's reply message,
 * but overrides key properties (author, member, guild, channel, reply,
 * etc.) to delegate back to the interaction.
 *
 * Usage (in slashCommandHandeler):
 *
 *   await interaction.deferReply({ fetchReply: true });
 *   const fakeMsg = buildFakeMessage(interaction);
 *   const args = extractArgs(interaction, textCommand);
 *   fakeMsg.content = buildContent(commandName, args, subPath);
 *   await textCommand.execute(fakeMsg, args);
 */

const { Collection } = require("discord.js");

// ──────────────────────────────────────────────
// Internal: flatten interaction options into generic "input" string
// ──────────────────────────────────────────────
/**
 * Recursively collect option values from interaction.options.data.
 *
 * Discord nests options inside SUB_COMMAND (type 1) and
 * SUB_COMMAND_GROUP (type 2) containers.  This walks into them
 * to find the actual leaf options.
 */
function flattenOptionsToArgs(interaction) {
  const args = [];

  function walk(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    // Recurse into subcommand/subcommand-group containers
    if (node.type === 1 || node.type === 2) {
      if (node.options) walk(node.options);
      return;
    }

    // ── Leaf option ──
    switch (node.type) {
      case 3: {
        // String — split by spaces to match text command behavior
        // (commands without args builder get a single "input" string)
        const parts = String(node.value).split(/ +/).filter(Boolean);
        args.push(...parts);
        break;
      }
      case 4:  // integer
      case 10: // number
        args.push(String(node.value));
        break;
      case 5:
        args.push(node.value ? "true" : "false");
        break;
      case 6: {
        const user = interaction.options.getUser(node.name);
        if (user) args.push(user.toString());
        break;
      }
      case 7: {
        const ch = interaction.options.getChannel(node.name);
        if (ch) args.push(ch.toString());
        break;
      }
      case 8: {
        const role = interaction.options.getRole(node.name);
        if (role) args.push(role.toString());
        break;
      }
    }
  }

  walk(interaction.options.data);
  return args;
}

// ──────────────────────────────────────────────
// Populate mentions from interaction resolved data
// ──────────────────────────────────────────────
function populateMentions(interaction, mentions) {
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    // Recurse into subcommand/subcommand-group wrappers
    if (node.type === 1 || node.type === 2) {
      if (node.options) walk(node.options);
      return;
    }

    switch (node.type) {
      case 6: {
        const user = interaction.options.getUser(node.name);
        if (user) mentions.users.set(user.id, user);
        if (mentions.members) {
          const member = interaction.options.getMember(node.name);
          if (member) mentions.members.set(member.id, member);
        }
        break;
      }
      case 7: {
        const ch = interaction.options.getChannel(node.name);
        if (ch) mentions.channels.set(ch.id, ch);
        break;
      }
      case 8: {
        const role = interaction.options.getRole(node.name);
        if (role) mentions.roles.set(role.id, role);
        break;
      }
    }
  }

  walk(interaction.options.data);
}

/**
 * Parse mention patterns from a string and resolve them from cache.
 * This handles commands that rely on message.mentions.users.first()
 * but only have a generic string "input" option (no typed user option).
 *
 * Best-effort — uses cache only, no API calls.
 */
function parseMentionsFromContent(content, interaction, mentions) {
  if (!content || typeof content !== "string") return;
  const client = interaction.client;
  const guild = interaction.guild;

  // Users: <@id> or <@!id>
  const userPattern = /<@!?(\d+)>/g;
  let match;
  while ((match = userPattern.exec(content)) !== null) {
    const id = match[1];
    if (mentions.users.has(id)) continue;
    const user = client.users.cache.get(id);
    if (user) {
      mentions.users.set(id, user);
      // Member
      if (guild) {
        const member = guild.members.cache.get(id);
        if (member) mentions.members?.set(id, member);
      }
    }
  }

  // Channels: <#id>
  const channelPattern = /<#(\d+)>/g;
  while ((match = channelPattern.exec(content)) !== null) {
    const id = match[1];
    if (mentions.channels.has(id)) continue;
    const ch = client.channels.cache.get(id);
    if (ch) mentions.channels.set(id, ch);
  }

  // Roles: <@&id>
  const rolePattern = /<@&(\d+)>/g;
  while ((match = rolePattern.exec(content)) !== null) {
    const id = match[1];
    if (mentions.roles.has(id)) continue;
    if (guild) {
      const role = guild.roles.cache.get(id);
      if (role) mentions.roles.set(id, role);
    }
  }
}

// ──────────────────────────────────────────────
// Proxy handler that makes the fake Message behave
// ──────────────────────────────────────────────
function createMessageProxy(interaction, replyTarget) {
  // Mentions — populated from interaction's resolved options
  const mentions = {
    users: new Collection(),
    roles: new Collection(),
    channels: new Collection(),
    members: interaction.inGuild() ? new Collection() : new Collection(),
    everyone: false,
    crosspostedChannels: new Collection(),
    _members: null,
    has(data, type) {
      const id = typeof data === "object" && data !== null ? data.id : data;
      if (!id) return false;
      if (type === "user") return mentions.users.has(id);
      if (type === "role") return mentions.roles.has(id);
      if (type === "channel") return mentions.channels.has(id);
      return mentions.users.has(id) || mentions.roles.has(id) || mentions.channels.has(id);
    },
  };
  populateMentions(interaction, mentions);

  // We use a closure-based handler so methods close over the interaction
  const handler = {
    // ── Identity properties ──
    author: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    client: interaction.client,
    id: replyTarget?.id ?? interaction.id,
    createdTimestamp: interaction.createdTimestamp,
    partial: false,
    system: false,
    pinned: false,
    tts: false,
    type: 0,
    webhookId: null,
    cleanContent: "",
    _content: "",
    get content() {
      return handler._content;
    },
    set content(v) {
      handler._content = v;
      handler.cleanContent = v;
      // Parse mention patterns from content (for commands that use
      // message.mentions.users.first() with generic string options)
      parseMentionsFromContent(v, interaction, mentions);
    },

    // ── Channel proxy (channel.send → interaction.followUp) ──
    get channel() {
      return new Proxy(interaction.channel, {
        get(target, prop) {
          if (prop === "send") {
            return (options) => {
              if (typeof options === "string") options = { content: options };
              return interaction.followUp(options);
            };
          }
          if (prop === "sendTyping") {
            return () => {};
          }
          const val = Reflect.get(target, prop);
          return typeof val === "function" ? val.bind(target) : val;
        },
      });
    },

    // ── inGuild ──
    inGuild() {
      return interaction.inGuild();
    },

    // ── reply → interaction.editReply (always edit the deferred response) ──
    reply(options) {
      if (typeof options === "string") options = { content: options };
      return interaction.editReply(options);
    },

    // ── edit → interaction.editReply ──
    edit(options) {
      if (typeof options === "string") options = { content: options };
      return interaction.editReply(options);
    },

    // ── delete → no-op (can't delete slash replies) ──
    delete() {
      return Promise.resolve();
    },

    // ── react → no-op ──
    react() {
      return Promise.resolve();
    },

    // ── fetch → return self ──
    fetch() {
      return Promise.resolve(handler._proxy);
    },

    // ── crosspost → no-op ──
    crosspost() {
      return Promise.resolve(handler._proxy);
    },

    // ── pin/unpin → no-op ──
    pin() {
      return Promise.resolve(handler._proxy);
    },
    unpin() {
      return Promise.resolve(handler._proxy);
    },

    // ── awaitReactions → empty ──
    awaitReactions() {
      return Promise.resolve(new Collection());
    },

    // ── createReactionCollector → null ──
    createReactionCollector() {
      return null;
    },

    // ── startThread → null ──
    startThread() {
      return Promise.resolve(null);
    },
    fetchReference() {
      return Promise.resolve(null);
    },

    // ── attachments/stickers/embeds/components ──
    attachments: new Collection(),
    stickers: new Collection(),
    embeds: [],
    components: [],

    // ── mentions (populated from interaction options above) ──
    mentions,

    // ── flags ──
    flags: null,

    // ── reference ──
    reference: null,
    referenceId: null,

    // ── url ──
    url: null,

    // ── activity ──
    activity: null,

    // ── applicationId ──
    applicationId: interaction.applicationId,
  };

  // Create the Proxy
  const proxy = new Proxy(replyTarget || {}, {
    get(target, prop) {
      if (prop in handler) {
        const val = handler[prop];
        if (typeof val === "function" && !prop.startsWith("_")) {
          return val.bind(handler);
        }
        return val;
      }
      // Fallback to the real reply message
      if (target && prop in target) {
        const val = Reflect.get(target, prop);
        return typeof val === "function" ? val.bind(target) : val;
      }
      return undefined;
    },
    set(target, prop, value) {
      if (prop in handler) {
        handler[prop] = value;
        if (prop === "content") {
          handler.cleanContent = value;
        }
        return true;
      }
      return Reflect.set(target, prop, value);
    },
  });

  // Store proxy reference for self-returning methods
  handler._proxy = proxy;
  // Store original interaction for debugging
  handler._interaction = interaction;

  return proxy;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Build a fake Message object from a ChatInputCommandInteraction.
 *
 * Must be called AFTER deferReply/inital reply so fetchReply works.
 *
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @returns {import("discord.js").Message} A fake Message-like Proxy
 */
async function buildFakeMessage(interaction) {
  let replyTarget = null;
  try {
    replyTarget = await interaction.fetchReply();
  } catch {
    // Interaction may not have a fetchable reply yet — still create a proxy
  }
  return createMessageProxy(interaction, replyTarget);
}

/**
 * Extract args array from an interaction for the given text command.
 *
 * If the command has an args builder (cmd.args), use its typed extraction.
 * Otherwise collect options generically and return as string[].
 *
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {object} textCommand
 * @returns {string[]}
 */
function extractArgs(interaction, textCommand) {
  // If the command has an ArgsBuilder, delegate to it
  if (textCommand.args && typeof textCommand.args.toArgs === "function") {
    return textCommand.args.toArgs(interaction);
  }

  // Fallback: collect options as strings
  return flattenOptionsToArgs(interaction);
}

/**
 * Reconstruct the message.content string as it would appear for a prefix command.
 *
 * @param {string} commandName
 * @param {string[]} args
 * @param {string[]} [subcommandPath]
 * @returns {string}
 */
function buildContent(commandName, args, subcommandPath = []) {
  const parts = [...subcommandPath, commandName, ...args];
  return `c.${parts.join(" ")}`;
}

/**
 * Check if a text command has any args metadata (ArgsBuilder).
 */
function hasArgsBuilder(textCommand) {
  return !!(
    textCommand.args &&
    typeof textCommand.args.toArgs === "function"
  );
}

module.exports = {
  buildFakeMessage,
  extractArgs,
  buildContent,
  hasArgsBuilder,
};
