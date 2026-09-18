// Shared cache for reaction role messages — imported by reactionRoleAdd and reactionRoleRemove
const trackedMessages = new Map(); // messageId -> { guildId, channelId, entries: [{emoji, roleId}] }
module.exports = trackedMessages;
