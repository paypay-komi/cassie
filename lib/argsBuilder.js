/**
 * ArgsBuilder — optional typed argument declaration API for text commands.
 *
 * Commands can optionally export an `args` property built with this API.
 * The slash auto-generator uses it to create proper Discord option types.
 * Commands WITHOUT it fall back to a generic string option.
 *
 * Usage in a command file:
 *
 *   const { ArgsBuilder } = require("../../lib/argsBuilder");
 *
 *   module.exports = {
 *     name: "tag",
 *     description: "View or manage tags.",
 *     args: ArgsBuilder.create()
 *       .string("name", { required: true, description: "Tag name" })
 *       .string("content", { description: "Tag content" }),
 *     async execute(message, args) { ... }
 *   };
 *
 * `args` is still a string[] when the command executes — this is purely
 * for generating better slash command definitions.
 */

class ArgsBuilder {
  constructor() {
    /** @type {Array<{type: string, name: string, required: boolean, description: string}>} */
    this._options = [];
  }

  /**
   * Create a new ArgsBuilder instance.
   */
  static create() {
    return new ArgsBuilder();
  }

  /**
   * Add a string option.
   *
   * @param {string} name Option name
   * @param {{required?: boolean, description?: string, autocomplete?: function}} opts
   *   If `autocomplete` is a function, it receives `(focusedValue, client)` and
   *   must return an array of `{name, value}` objects (max 25). The option is
   *   automatically marked with `.setAutocomplete(true)`.
   */
  string(name, opts = {}) {
    const opt = {
      type: "string",
      name,
      required: opts.required ?? false,
      description: opts.description ?? name,
    };
    if (typeof opts.autocomplete === "function") {
      opt.autocomplete = opts.autocomplete;
    }
    this._options.push(opt);
    return this;
  }

  /**
   * Add an integer option.
   */
  integer(name, opts = {}) {
    this._options.push({
      type: "integer",
      name,
      required: opts.required ?? false,
      description: opts.description ?? name,
    });
    return this;
  }

  /**
   * Add a boolean option.
   */
  boolean(name, opts = {}) {
    this._options.push({
      type: "boolean",
      name,
      required: opts.required ?? false,
      description: opts.description ?? name,
    });
    return this;
  }

  /**
   * Add a user option.
   */
  user(name, opts = {}) {
    this._options.push({
      type: "user",
      name,
      required: opts.required ?? false,
      description: opts.description ?? name,
    });
    return this;
  }

  /**
   * Add a channel option.
   */
  channel(name, opts = {}) {
    this._options.push({
      type: "channel",
      name,
      required: opts.required ?? false,
      description: opts.description ?? name,
    });
    return this;
  }

  /**
   * Add a role option.
   */
  role(name, opts = {}) {
    this._options.push({
      type: "role",
      name,
      required: opts.required ?? false,
      description: opts.description ?? name,
    });
    return this;
  }

  /**
   * Add a number option.
   */
  number(name, opts = {}) {
    this._options.push({
      type: "number",
      name,
      required: opts.required ?? false,
      description: opts.description ?? name,
    });
    return this;
  }

  /**
   * Return the declared options (used by the auto-generator).
   */
  get options() {
    return this._options;
  }

  /**
   * Map option types to Discord API option types.
   */
  static _typeToDiscordType(type) {
    const map = {
      string: 3,
      integer: 4,
      boolean: 5,
      user: 6,
      channel: 7,
      role: 8,
      number: 10,
    };
    return map[type] ?? 3;
  }

  /**
   * Convert to Discord API option objects for SlashCommandBuilder.
   */
  toSlashOptions() {
    return this._options.map((opt) => ({
      type: ArgsBuilder._typeToDiscordType(opt.type),
      name: opt.name,
      description: opt.description,
      required: opt.required,
      autocomplete: typeof opt.autocomplete === "function",
    }));
  }

  /**
   * Get the autocomplete function for a named option, or null.
   * @param {string} name
   * @returns {function|null}
   */
  getAutocompleteFn(name) {
    const opt = this._options.find((o) => o.name === name);
    return opt && typeof opt.autocomplete === "function" ? opt.autocomplete : null;
  }

  /**
   * Extract args from a ChatInputCommandInteraction into a string array.
   * This is what gets passed to `command.execute(message, args)`.
   */
  toArgs(interaction) {
    return this._options.map((opt) => {
      let value;
      switch (opt.type) {
        case "string":
          value = interaction.options.getString(opt.name);
          break;
        case "integer":
          value = interaction.options.getInteger(opt.name);
          break;
        case "boolean":
          value = interaction.options.getBoolean(opt.name);
          break;
        case "user": {
          const user = interaction.options.getUser(opt.name);
          value = user ? user.toString() : null; // <@userId> mention string
          break;
        }
        case "channel": {
          const ch = interaction.options.getChannel(opt.name);
          value = ch ? ch.toString() : null; // <#channelId> mention string
          break;
        }
        case "role": {
          const role = interaction.options.getRole(opt.name);
          value = role ? role.toString() : null; // <@&roleId> mention string
          break;
        }
        case "number":
          value = interaction.options.getNumber(opt.name);
          break;
        default:
          value = interaction.options.getString(opt.name);
      }
      return value != null ? String(value) : undefined;
    }).filter((v) => v !== undefined);
  }
}

module.exports = { ArgsBuilder };
