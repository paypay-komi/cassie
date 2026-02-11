module.exports = function reloadEvents(client) {
    const fs = require('fs');
    const path = require('path');

    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

    // Remove only your custom listeners
    for (const [eventName, listeners] of client._events ? Object.entries(client._events) : []) {
        for (const listener of Array.isArray(listeners) ? listeners : [listeners]) {
            if (listener && listener.__isCustomEvent) {
                client.removeListener(eventName, listener);
            }
        }
    }

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        delete require.cache[require.resolve(filePath)];

        try {
            const event = require(filePath);

            if (!event.name || typeof event.execute !== 'function') {
                console.warn(`⚠️ Event missing "name" or "execute()" in ${file}`);
                continue;
            }

            const wrapped = (...args) => event.execute(client, ...args);
            wrapped.__isCustomEvent = true; // mark it so we can remove it later

            client.on(event.name, wrapped);

            console.log(`✓ Reloaded event: ${event.name}`);
        } catch (err) {
            console.error(`❌ Failed to reload event ${file}:`, err);
        }
    }

    console.log(`\n📦 Reloaded ${eventFiles.length} events.\n`);
};
