const { NODE_TYPES, COMPARISON_OPERATORS } = require("./roleRequirementEvaluator");

// Progress bar: 10 chars, filled █, empty ░
function progressBar(ratio, length = 10) {
	const clamped = Math.max(0, Math.min(1, ratio));
	const filled = Math.round(clamped * length);
	const empty = length - filled;
	return "█".repeat(filled) + "░".repeat(empty);
}

function leafProgress(leaf, actual) {
	const required = leaf.value;
	let met = false;
	let ratio = 0;
	let needed = 0;

	switch (leaf.operator) {
		case COMPARISON_OPERATORS.GREATER_THAN_OR_EQUAL:
			met = actual >= required;
			ratio = required === 0 ? 1 : Math.min(actual / required, 1);
			needed = Math.max(0, required - actual);
			break;
		case COMPARISON_OPERATORS.GREATER_THAN:
			met = actual > required;
			ratio = required === 0 ? 1 : Math.min(actual / (required + 1), 1);
			needed = Math.max(0, required + 1 - actual);
			break;
		case COMPARISON_OPERATORS.LESS_THAN_OR_EQUAL:
			met = actual <= required;
			ratio = met ? 1 : Math.max(0, 1 - (actual - required) / Math.max(required, 1));
			needed = met ? 0 : actual - required;
			break;
		case COMPARISON_OPERATORS.LESS_THAN:
			met = actual < required;
			ratio = met ? 1 : Math.max(0, 1 - (actual - required + 1) / Math.max(required, 1));
			needed = met ? 0 : actual - required + 1;
			break;
		case COMPARISON_OPERATORS.EQUAL:
			met = actual === required;
			ratio = met ? 1 : 0;
			needed = met ? 0 : Math.abs(required - actual);
			break;
		default:
			met = false;
			ratio = 0;
			needed = required;
	}

	return { metric: leaf.metric, operator: leaf.operator, required, actual, met, ratio, needed };
}

function collectLeaves(ast, arr = []) {
	if (!ast) return arr;
	if (ast.type === NODE_TYPES.CONDITION) {
		arr.push(ast);
	} else if (ast.type === NODE_TYPES.AND || ast.type === NODE_TYPES.OR) {
		for (const c of ast.conditions) collectLeaves(c, arr);
	}
	return arr;
}

// Analyze node recursively: returns { met, progress, leaves: [{leaf, prog}], closestPath: string, missing: [] }
function analyzeNode(node, progress) {
	if (!node) return { met: false, progress: 0, leaves: [], closestPath: "", missing: [] };

	if (node.type === NODE_TYPES.CONDITION) {
		const actual = progress[node.metric] ?? 0;
		const lp = leafProgress(node, actual);
		return {
			met: lp.met,
			progress: lp.ratio,
			leaves: [lp],
			closestPath: `${lp.metric} ${lp.operator} ${lp.required}`,
			missing: lp.met ? [] : [lp],
			bestLeaf: lp,
		};
	}

	if (node.type === NODE_TYPES.AND) {
		const children = node.conditions.map((c) => analyzeNode(c, progress));
		const met = children.every((c) => c.met);
		const progressAvg = children.reduce((sum, c) => sum + c.progress, 0) / children.length;
		// For AND, all leaves are required, but closest is the one with lowest progress (bottleneck)
		const sortedMissing = children.flatMap((c) => c.missing).sort((a, b) => a.ratio - b.ratio);
		const bottleneck = children.slice().sort((a, b) => a.progress - b.progress)[0];
		return {
			met,
			progress: progressAvg,
			leaves: children.flatMap((c) => c.leaves),
			closestPath: children.map((c) => `(${c.closestPath})`).join(" AND "),
			missing: sortedMissing,
			bottleneck: bottleneck?.bestLeaf || bottleneck,
			children,
		};
	}

	if (node.type === NODE_TYPES.OR) {
		const children = node.conditions.map((c) => analyzeNode(c, progress));
		const met = children.some((c) => c.met);
		// For OR, progress is max (best branch)
		let best = children[0];
		for (const c of children) if (c.progress > best.progress) best = c;
		// If none met, the closest is the best branch's missing
		const missing = met ? [] : best.missing;
		return {
			met,
			progress: best.progress,
			leaves: children.flatMap((c) => c.leaves),
			closestPath: best.closestPath,
			missing,
			bestBranch: best,
			children,
		};
	}

	return { met: false, progress: 0, leaves: [], closestPath: "", missing: [] };
}

function formatLeafProgress(lp) {
	const pct = Math.round(lp.ratio * 100);
	const bar = progressBar(lp.ratio);
	const neededStr = lp.met ? "" : ` — need **${lp.needed}** more`;
	const status = lp.met ? "✅" : "❌";
	return `${status} \`${lp.metric} ${lp.operator} ${lp.required}\` — \`${lp.actual}/${lp.required}\` ${bar} **${pct}%**${neededStr}`;
}

function formatClosest(missing) {
	if (!missing.length) return "All met!";
	// Sort by ratio descending (closest first)
	const sorted = [...missing].sort((a, b) => b.ratio - a.ratio);
	const top = sorted[0];
	return `Closest: \`${top.metric} ${top.operator} ${top.required}\` → ${Math.round(top.ratio * 100)}% (need ${top.needed} more ${top.metric})`;
}

module.exports = {
	progressBar,
	leafProgress,
	collectLeaves,
	analyzeNode,
	formatLeafProgress,
	formatClosest,
};
