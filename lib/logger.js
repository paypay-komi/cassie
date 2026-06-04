// ---------------------------------------------------------------------------
// Structured logger — levels, timestamps, colors, per-module named instances
// ---------------------------------------------------------------------------
// Usage:
//   const { getLogger } = require("../lib/logger");
//   const log = getLogger("MyModule");
//   log.info("doing the thing");
//   log.warn("something off", details);
//   log.error("oh no", err);
//   log.debug("verbose stuff only shown with LOG_LEVEL=debug");
//
// Set LOG_LEVEL env var to: debug, info, warn, error (default: info)
// ---------------------------------------------------------------------------

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

const COLORS = {
  debug: 36, // cyan
  info: 32,  // green
  warn: 33,  // yellow
  error: 31, // red
};

function ts() {
  const d = new Date();
  return d.toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function write(level, module, msg, args) {
  const color = COLORS[level];
  const label = level.toUpperCase().padEnd(5);

  // Colorized to console — clean formatting
  let formatted = `\x1b[90m${ts()}\x1b[0m \x1b[${color}m${label}\x1b[0m`;
  if (module) formatted += ` \x1b[36m[${module}]\x1b[0m`;
  formatted += ` ${msg}`;

  if (args.length > 0) {
    console[level](formatted, ...args);
  } else {
    console[level](formatted);
  }
}

function getLogger(module) {
  return {
    debug: (msg, ...args) => {
      if (currentLevel <= LEVELS.debug) write("debug", module, msg, args);
    },
    info: (msg, ...args) => {
      if (currentLevel <= LEVELS.info) write("info", module, msg, args);
    },
    warn: (msg, ...args) => {
      if (currentLevel <= LEVELS.warn) write("warn", module, msg, args);
    },
    error: (msg, ...args) => {
      if (currentLevel <= LEVELS.error) write("error", module, msg, args);
    },
  };
}

module.exports = { getLogger };
