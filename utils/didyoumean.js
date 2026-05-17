/**
 * Compute Levenshtein distance (edit distance) between two strings
 */
function levenshtein(a, b) {
	const dp = Array(b.length + 1)
		.fill()
		.map(() => Array(a.length + 1).fill(0));

	for (let i = 0; i <= b.length; i++) dp[i][0] = i;
	for (let j = 0; j <= a.length; j++) dp[0][j] = j;

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b[i - 1] === a[j - 1]) dp[i][j] = dp[i - 1][j - 1];
			else
				dp[i][j] =
					1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
		}
	}
	return dp[b.length][a.length];
}

/**
 * Flatten command tree to all possible paths including aliases
 */
function flattenCommandTree(cmd, parents = []) {
	const paths = [];
	const names = [cmd.name, ...(cmd.aliases || [])];

	for (const name of names) {
		const newParents = [...parents, name];

		if (!cmd.subcommands || Object.keys(cmd.subcommands).length === 0) {
			paths.push({ path: newParents.join(" "), command: cmd });
			continue;
		}

		for (const sub of Object.values(cmd.subcommands)) {
			if (sub.parentRef === cmd) {
				paths.push(...flattenCommandTree(sub, newParents));
			}
		}
	}

	return paths;
}

/**
 * Find the closest command path to a user input
 * @param {string} input - user input string
 * @param {Map<string, object>} textCommands - client.textCommands
 */
function didYouMean(input, textCommands) {
	const allPaths = [];

	for (const cmd of textCommands.values()) {
		allPaths.push(...flattenCommandTree(cmd));
	}

	let best = null;
	let minDistance = Infinity;

	for (const { path } of allPaths) {
		const distance = levenshtein(input.toLowerCase(), path.toLowerCase());
		if (distance < minDistance) {
			minDistance = distance;
			best = path;
		}
	}

	return best;
}

module.exports = didYouMean;
