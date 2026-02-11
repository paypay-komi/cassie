const fs = require('fs');
const path = require('path');

/**
 * Recursively walk directories to collect .js files
 */
function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            walk(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Recursively collect all possible invocation paths including aliases
 */
function collectAllPaths(cmd, parents = []) {
    const paths = [];
    const currentNames = [cmd.name, ...(cmd.aliases || [])]; // canonical + aliases

    for (const name of currentNames) {
        const newParents = [...parents, name];

        if (!cmd.subcommands || Object.keys(cmd.subcommands).length === 0) {
            // no more subcommands, push current path
            paths.push(newParents.join(' '));
            continue;
        }

        // iterate over direct subcommands (canonical names only)
        for (const sub of Object.values(cmd.subcommands)) {
            if (sub.parentRef === cmd) {
                paths.push(...collectAllPaths(sub, newParents));
            }
        }
    }

    return paths;
}

/**
 * Reload text commands and build nested subcommands
 */
module.exports = function reloadTextCommands(client, targetName) {
    const textPath = path.join(__dirname, '../commands/text');

    client.textCommands ??= new Map();
    client.textAliases ??= new Map();

    let reloaded = 0;
    let subcommands = 0;
    const failed = [];

    const files = walk(textPath);
    console.log('🔹 Files found for loading:', files);

    const allCommands = new Map();

    // --------------------------------------------------
    // Load all command modules
    // --------------------------------------------------
    for (const filePath of files) {
        delete require.cache[require.resolve(filePath)];

        try {
            const cmd = require(filePath);

            if (!cmd?.name) {
                console.log(`⚠️ Skipping ${filePath}: no name found`);
                continue;
            }

            cmd.name = cmd.name.toLowerCase();
            cmd.parent = cmd.parent?.toLowerCase() ?? null;
            cmd.aliases = (cmd.aliases || []).map(a => a.toLowerCase());

            // ONLY canonical subcommands
            cmd.subcommands ??= {};
            cmd.parentRef = null;

            if (targetName && cmd.name !== targetName && cmd.parent !== targetName) {
                continue;
            }

            const key = `${cmd.parent ?? 'root'}:${cmd.name}`;

            if (allCommands.has(key)) {
                console.warn(
                    `⚠️ Duplicate command "${cmd.name}" under parent "${cmd.parent ?? 'root'}"`
                );
                continue;
            }

            allCommands.set(key, cmd);
            console.log(`✅ Loaded command: ${key} from ${filePath}`);
        } catch (err) {
            console.error(`❌ Failed loading ${filePath}`);
            console.error(err);
            failed.push(path.basename(filePath));
        }
    }

    console.log('🔹 All commands after first pass:', [...allCommands.keys()]);

    if (!targetName) {
        client.textCommands.clear();
        client.textAliases.clear();
    }

    // --------------------------------------------------
    // Link parents and register top-level commands
    // --------------------------------------------------
    for (const cmd of allCommands.values()) {
        // -------------------------
        // Subcommand
        // -------------------------
        if (cmd.parent) {
            const parent = [...allCommands.values()].find(
                c => c.name === cmd.parent
            );

            if (!parent) {
                console.warn(
                    `⚠️ Parent "${cmd.parent}" not found for "${cmd.name}"`
                );
                continue;
            }

            // ONLY store canonical name
            parent.subcommands[cmd.name] = cmd;
            cmd.parentRef = parent;

            subcommands++;
            console.log(`🔹 Linked ${cmd.name} as subcommand of ${parent.name}`);
            continue;
        }

        // -------------------------
        // Top-level command
        // -------------------------
        client.textCommands.set(cmd.name, cmd);

        for (const alias of cmd.aliases) {
            client.textAliases.set(alias, cmd.name);
        }

        reloaded++;
        console.log(`🔹 Registered top-level command: ${cmd.name}`);
    }

    console.log(
        '🔹 Final client.textCommands:',
        [...client.textCommands.keys()]
    );
    console.log(
        '🔹 Final client.textAliases:',
        [...client.textAliases.keys()]
    );

    // --------------------------------------------------
    // 🔹 Print all valid invocation paths (including aliases)
    // --------------------------------------------------
    console.log('\n📋 All valid command invocations:');
    for (const rootCmd of client.textCommands.values()) {
        const paths = collectAllPaths(rootCmd);
        paths.forEach(p => console.log(`!${p}`));
    }

    return { reloaded, subcommands, failed };
};
