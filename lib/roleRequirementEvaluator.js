const NODE_TYPES = Object.freeze({
	AND: "AND",
	OR: "OR",
	CONDITION: "condition",
});

const LOGICAL_OPERATORS = Object.freeze({
	AND: "AND",
	OR: "OR",
});

const COMPARISON_OPERATORS = Object.freeze({
	GREATER_THAN_OR_EQUAL: ">=",
	LESS_THAN_OR_EQUAL: "<=",
	EQUAL: "==",
	GREATER_THAN: ">",
	LESS_THAN: "<",
});

const METRICS = Object.freeze({
	MESSAGE_COUNT: "messageCount",
	VOICE_SECONDS: "voiceSeconds",
	DAYS_IN_SERVER: "daysInServer",
});

const VALID_METRICS = new Set(Object.values(METRICS));

const VALID_OPERATORS = new Set(Object.values(COMPARISON_OPERATORS));

const METRIC_NAMES = Object.freeze({
	[METRICS.MESSAGE_COUNT]: "message count",
	[METRICS.VOICE_SECONDS]: "voice time",
	[METRICS.DAYS_IN_SERVER]: "days in the server",
});

class RequirementParseError extends Error {
	constructor({ code, message, userMessage, position, expression }) {
		const { line, column } = getLineColumn(expression, position);
		const sourceLine = expression.split("\n")[line - 1] ?? "";

		const diagnostic =
			`${message} at line ${line}, column ${column}\n` +
			`${sourceLine}\n` +
			`${" ".repeat(Math.max(0, column - 1))}^`;

		super(diagnostic);

		this.name = "RequirementParseError";
		this.code = code;
		this.userMessage = userMessage;
		this.position = position;
		this.line = line;
		this.column = column;
		this.sourceLine = sourceLine;
	}

	get developerMessage() {
		return this.message;
	}
}

function getLineColumn(expression, position) {
	const before = expression.slice(0, position);

	const line = (before.match(/\n/g) || []).length + 1;

	const lastNewline = before.lastIndexOf("\n");

	const column =
		lastNewline === -1
			? position + 1
			: position - lastNewline;

	return { line, column };
}

function createError(code, message, userMessage, position, expression) {
	return new RequirementParseError({
		code,
		message,
		userMessage,
		position,
		expression,
	});
}

function parseExpression(expression) {
	const tokens = tokenize(expression);

	let position = 0;

	function peek() {
		return tokens[position];
	}

	function consume() {
		return tokens[position++];
	}

	function parsePrimary() {
		const token = peek();

		if (!token) {
			throw createError(
				"UNEXPECTED_END",
				"Expected a condition but reached the end of the expression",
				"Your requirement ends unexpectedly. Make sure every condition has a metric, comparison, and value.",
				expression.length,
				expression,
			);
		}

		// Parenthesized expression
		if (token.value === "(") {
			consume();

			// Don't allow ()
			if (peek()?.value === ")") {
				throw createError(
					"EMPTY_GROUP",
					"Empty parentheses are not allowed",
					"There's an empty pair of parentheses in your requirement. Put a condition inside them.",
					peek().position,
					expression,
				);
			}

			const node = parseOr();

			const closing = peek();

			if (!closing || closing.value !== ")") {
				throw createError(
					"MISSING_CLOSING_PAREN",
					`Expected ")" but got ${
						closing
							? `"${closing.value}"`
							: "end of expression"
					}`,
					closing
						? `I couldn't finish reading this group. Something near \`${closing.value}\` looks wrong. Make sure every \`(\` has a matching \`).`
						: "Your requirement has an opening `(` without a matching `)`. Make sure all parentheses are closed.",
					closing?.position ?? expression.length,
					expression,
				);
			}

			consume();

			return node;
		}

		// A condition must start with an identifier
		if (token.type !== "identifier") {
			throw createError(
				"EXPECTED_METRIC",
				`Expected a metric but got "${token.value}"`,
				`I expected a requirement such as \`messageCount >= 100\`, but found \`${token.value}\` instead.`,
				token.position,
				expression,
			);
		}

		const metricToken = consume();
		const metric = metricToken.value;

		if (
			metric === LOGICAL_OPERATORS.AND ||
			metric === LOGICAL_OPERATORS.OR
		) {
			throw createError(
				"UNEXPECTED_LOGICAL_OPERATOR",
				`Unexpected logical operator "${metric}"`,
				`I found \`${metric}\` where I expected a requirement. You need a condition before \`${metric}\`.`,
				metricToken.position,
				expression,
			);
		}

		if (!VALID_METRICS.has(metric)) {
			const available = [...VALID_METRICS]
				.map((metric) => `\`${metric}\``)
				.join(", ");

			throw createError(
				"UNKNOWN_METRIC",
				`Unknown metric "${metric}"`,
				`I don't recognize \`${metric}\` as a requirement. Available requirements are: ${available}.`,
				metricToken.position,
				expression,
			);
		}

		const operatorToken = peek();

		if (!operatorToken) {
			throw createError(
				"MISSING_OPERATOR",
				`Expected an operator after "${metric}"`,
				`Your \`${METRIC_NAMES[metric]}\` requirement is missing a comparison. Try something like \`${metric} >= 100\`.`,
				expression.length,
				expression,
			);
		}

		if (operatorToken.type !== "operator") {
			throw createError(
				"INVALID_OPERATOR",
				`Expected an operator after "${metric}" but got "${operatorToken.value}"`,
				`I expected a comparison after \`${METRIC_NAMES[metric]}\`. Try \`>=\`, \`<=\`, \`>\`, \`<\`, or \`==\`.`,
				operatorToken.position,
				expression,
			);
		}

		const operator = consume().value;

		// This should normally already be guaranteed by the tokenizer,
		// but keeping validation here makes the parser defensive.
		if (!VALID_OPERATORS.has(operator)) {
			throw createError(
				"INVALID_OPERATOR",
				`Unknown operator "${operator}"`,
				`I don't recognize \`${operator}\` as a valid comparison operator.`,
				operatorToken.position,
				expression,
			);
		}

		const valueToken = peek();

		if (!valueToken) {
			throw createError(
				"MISSING_VALUE",
				`Expected a value after "${metric} ${operator}"`,
				`Your \`${METRIC_NAMES[metric]}\` requirement is missing a number. For example: \`${metric} ${operator} 100\`.`,
				expression.length,
				expression,
			);
		}

		if (valueToken.type !== "number") {
			throw createError(
				"INVALID_VALUE",
				`Expected a numeric value after "${metric} ${operator}" but got "${valueToken.value}"`,
				`I expected a number after \`${metric} ${operator}\`, but found \`${valueToken.value}\`.`,
				valueToken.position,
				expression,
			);
		}

		const value = Number(consume().value);

		return {
			type: NODE_TYPES.CONDITION,
			metric,
			operator,
			value,
		};
	}

	function parseAnd() {
		let node = parsePrimary();

		while (peek()?.value === LOGICAL_OPERATORS.AND) {
			consume();

			if (!peek()) {
				throw createError(
					"MISSING_CONDITION",
					"Expected a condition after AND",
					"Your requirement ends with `AND`. Add another condition after it.",
					expression.length,
					expression,
				);
			}

			if (peek().value === ")") {
				throw createError(
					"MISSING_CONDITION",
					"Expected a condition after AND",
					"`AND` needs another condition after it. For example: `messageCount >= 100 AND voiceSeconds >= 3600`.",
					peek().position,
					expression,
				);
			}

			const right = parsePrimary();

			node = {
				type: NODE_TYPES.AND,
				conditions: [node, right],
			};
		}

		return node;
	}

	function parseOr() {
		let node = parseAnd();

		while (peek()?.value === LOGICAL_OPERATORS.OR) {
			consume();

			if (!peek()) {
				throw createError(
					"MISSING_CONDITION",
					"Expected a condition after OR",
					"Your requirement ends with `OR`. Add another condition after it.",
					expression.length,
					expression,
				);
			}

			if (peek().value === ")") {
				throw createError(
					"MISSING_CONDITION",
					"Expected a condition after OR",
					"`OR` needs another condition after it. For example: `messageCount >= 100 OR voiceSeconds >= 3600`.",
					peek().position,
					expression,
				);
			}

			const right = parseAnd();

			node = {
				type: NODE_TYPES.OR,
				conditions: [node, right],
			};
		}

		return node;
	}

	const result = parseOr();

	if (position < tokens.length) {
		const token = peek();

		throw createError(
			"UNEXPECTED_TOKEN",
			`Unexpected token "${token.value}"`,
			`I wasn't expecting \`${token.value}\` here. Check that your conditions and \`AND\`/\`OR\` operators are arranged correctly.`,
			token.position,
			expression,
		);
	}

	return result;
}

function tokenize(expression) {
	const tokens = [];

	let position = 0;

	while (position < expression.length) {
		const char = expression[position];

		// Whitespace
		if (/\s/.test(char)) {
			position++;
			continue;
		}

		// Parentheses
		if (char === "(" || char === ")") {
			tokens.push({
				type: "parenthesis",
				value: char,
				position,
			});

			position++;
			continue;
		}

		// Operators
		const operatorMatch = expression
			.slice(position)
			.match(/^(>=|<=|==|>|<)/);

		if (operatorMatch) {
			const value = operatorMatch[1];

			tokens.push({
				type: "operator",
				value,
				position,
			});

			position += value.length;
			continue;
		}

		// Numbers
		const numberMatch = expression
			.slice(position)
			.match(/^\d+(?:\.\d+)?/);

		if (numberMatch) {
			const value = numberMatch[0];

			tokens.push({
				type: "number",
				value,
				position,
			});

			position += value.length;
			continue;
		}

		// Identifiers / AND / OR
		const identifierMatch = expression
			.slice(position)
			.match(/^[A-Za-z_][A-Za-z0-9_]*/);

		if (identifierMatch) {
			const rawValue = identifierMatch[0];

			let value = rawValue;

			if (
				rawValue.toUpperCase() ===
				LOGICAL_OPERATORS.AND
			) {
				value = LOGICAL_OPERATORS.AND;
			} else if (
				rawValue.toUpperCase() ===
				LOGICAL_OPERATORS.OR
			) {
				value = LOGICAL_OPERATORS.OR;
			}

			tokens.push({
				type: "identifier",
				value,
				position,
			});

			position += rawValue.length;
			continue;
		}

		// Invalid character
		throw createError(
			"INVALID_CHARACTER",
			`Unexpected character "${char}"`,
			`I found a character \`${char}\` that I don't understand. Check your requirement for typos.`,
			position,
			expression,
		);
	}

	return tokens;
}

function evaluateRequirement(ast, memberProgress) {
	if (!ast) {
		throw new Error("Invalid requirement AST");
	}

	// Single condition
	if (ast.type === NODE_TYPES.CONDITION) {
		const actualValue = memberProgress[ast.metric];

		if (actualValue === undefined) {
			throw new Error(`Unknown metric: ${ast.metric}`);
		}

		switch (ast.operator) {
			case COMPARISON_OPERATORS.GREATER_THAN_OR_EQUAL:
				return actualValue >= ast.value;

			case COMPARISON_OPERATORS.LESS_THAN_OR_EQUAL:
				return actualValue <= ast.value;

			case COMPARISON_OPERATORS.GREATER_THAN:
				return actualValue > ast.value;

			case COMPARISON_OPERATORS.LESS_THAN:
				return actualValue < ast.value;

			case COMPARISON_OPERATORS.EQUAL:
				return actualValue === ast.value;

			default:
				throw new Error(
					`Unknown operator: ${ast.operator}`,
				);
		}
	}

	// AND
	if (ast.type === NODE_TYPES.AND) {
		return ast.conditions.every((condition) =>
			evaluateRequirement(condition, memberProgress),
		);
	}

	// OR
	if (ast.type === NODE_TYPES.OR) {
		return ast.conditions.some((condition) =>
			evaluateRequirement(condition, memberProgress),
		);
	}

	throw new Error(`Unknown AST node type: ${ast.type}`);
}

module.exports = {
	NODE_TYPES,
	LOGICAL_OPERATORS,
	COMPARISON_OPERATORS,
	METRICS,

	VALID_METRICS,
	VALID_OPERATORS,
	METRIC_NAMES,

	parseExpression,
	tokenize,
	RequirementParseError,
	evaluateRequirement,
};
