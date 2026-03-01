module.exports = {
	name: "eval",
	description: "Evaluate arbitrary JavaScript code. (Owner only)",
	aliases: ["ev"],
	permission: "botOwner",
	async execute(message, args) {
		const client = message.client;
		const code = args.join(" ");

		// Evaluate the provided code
		let result = await eval(code);

		// Log the initial result
		console.log("Initial result:", result);
		try {
			// If the result is a promise or an array of promises, wait for all of them to resolve
			if (result instanceof Promise) {
				result = await result;
				console.log("Resolved result from promise:", result);
			} else if (
				Array.isArray(result) &&
				result.every((item) => item instanceof Promise)
			) {
				result = await Promise.all(result);
				console.log("Resolved result from array of promises:", result);
			}
			/**
			 * @param {any} value
			 */
			function serializeValue(value) {
				const seen = new WeakSet(); // To track circular references

				/**
				 * @param {object | null} value
				 */
				function serializeInternal(value) {
					// Handle primitive values and null directly
					if (typeof value !== "object" || value === null) {
						// Convert BigInt to string
						if (typeof value === "bigint") {
							return value.toString() + "n";
						}
						// Convert functions, symbols, and other non-serializable types to strings
						if (
							typeof value === "function" ||
							typeof value === "symbol"
						) {
							return value.toString();
						}
						return value; // Directly return serializable primitives
					}

					// Check for circular references
					if (seen.has(value)) {
						return "[Circular]"; // Indicate circular references
					}
					seen.add(value); // Mark the object as seen

					// Handle arrays
					if (Array.isArray(value)) {
						return value.map((item) => serializeInternal(item)); // Serialize array elements
					}

					// Handle Map
					if (value instanceof Map) {
						const mapObject = {};
						value.forEach((val, key) => {
							mapObject[key] = serializeInternal(val); // Serialize map values
						});
						return `Map (${value.size} entries):\n${JSON.stringify(mapObject, null, 2)}`;
					}

					// Handle Set
					if (value instanceof Set) {
						const setArray = Array.from(value).map((item) =>
							serializeInternal(item),
						); // Serialize set values
						return `Set (${value.size} entries):\n${JSON.stringify(setArray, null, 2)}`;
					}

					// Handle regular objects
					const obj = {};
					for (const [key, val] of Object.entries(value)) {
						// Check if the value is not undefined or if it can be safely accessed
						if (val === undefined) {
							obj[key] = "undefined"; // Safely handle undefined properties
						} else if (val === null) {
							obj[key] = "null"; // Safely handle null values
						} else if (seen.has(val)) {
							obj[key] = "[Circular]"; // Handle circular reference
						} else {
							obj[key] = serializeInternal(val); // Recursively serialize other properties
						}
					}

					seen.delete(value); // Remove from seen to allow reuse of the object elsewhere
					return obj;
				}

				return {
					resultString: JSON.stringify(
						serializeInternal(value),
						(key, val) => {
							// Convert any unsupported types into strings during final serialization
							if (typeof val === "bigint") {
								return val.toString() + "n";
							}
							if (
								typeof val === "function" ||
								typeof val === "symbol"
							) {
								return val.toString();
							}
							if (typeof val === "undefined") {
								return "undefined";
							}
							return val;
						},
						2,
					),
					fileExtension: determineFileExtension(value), // Assuming determineFileExtension is defined elsewhere
				};
			}

			/**
			 * @param {any} value
			 */
			function determineFileExtension(value) {
				if (
					typeof value === "string" ||
					typeof value === "number" ||
					typeof value === "boolean"
				) {
					return "txt";
				}
				if (
					typeof value === "bigint" ||
					value instanceof Date ||
					value instanceof RegExp
				) {
					return "txt";
				}
				if (value instanceof Map) {
					return "json";
				}
				if (value instanceof Set) {
					return "json";
				}
				if (value instanceof WeakMap || value instanceof WeakSet) {
					return "txt";
				}
				if (Array.isArray(value)) {
					return "json";
				}
				if (typeof value === "function") {
					return "js";
				}
				if (typeof value === "object") {
					return "json";
				}
				return "txt";
			}

			const { resultString, fileExtension } = serializeValue(result);

			console.log(resultString);
			console.log(fileExtension);

			const sensitivePatterns = [
				{
					pattern:
						/\b[mM][a-zA-Z0-9_-]{23}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27}\b/g,
					label: "(redacted: Discord Bot token)",
				},
				{
					pattern:
						/bearer\s+[A-Za-z0-9_\-\\.~:/?#[\]@!$&'()*+,;=]{20,}/gi,
					label: "(redacted: Bearer token)",
				},
				{
					pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
					label: "(redacted: Google API key)",
				},
				{
					pattern: /\bghp_[A-Za-z0-9]{36}\b/g,
					label: "(redacted: GitHub API token)",
				},
				{
					pattern: /\bAKIA[0-9A-Z]{16}\b/g,
					label: "(redacted: AWS Access key)",
				},
				{
					pattern:
						/\b[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
					label: "(redacted: JWT)",
				},
				{
					pattern: /\b[A-Za-z0-9]{32,}\b/g,
					label: "(redacted: Session token)",
				},
				{
					pattern:
						/\bhttps:\/\/discord(app)?\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+\b/g,
					label: "(redacted: Discord Webhook URL)",
				},
				{
					pattern: /\b[A-Za-z0-9_\-\\.]{40,}\b/g,
					label: "(redacted: Generic token)",
				},
			];
			/**
			 * @param {string} inputString
			 */
			function redactSensitiveInformation(inputString) {
				let redactedString = inputString;

				// Iterate over each pattern
				sensitivePatterns.forEach(({ pattern, label }) => {
					// Find all matches for the current pattern
					const matches = redactedString.matchAll(pattern);

					// For each match, determine the best redaction
					for (const match of matches) {
						let bestRedaction = match[0];
						let maxRedactedLength = 0;

						sensitivePatterns.forEach(
							({ pattern: innerPattern, label: innerLabel }) => {
								// Apply inner pattern to the current match
								const redactedMatch = match[0].replace(
									innerPattern,
									innerLabel,
								);
								const redactedLength =
									match[0].length - redactedMatch.length;

								// If this redaction is more extensive, select it
								if (redactedLength > maxRedactedLength) {
									maxRedactedLength = redactedLength;
									bestRedaction = redactedMatch;
								}
							},
						);

						// Replace the match in the original string with the best redaction
						redactedString = redactedString.replace(
							match[0],
							bestRedaction,
						);
					}
				});

				return redactedString;
			}

			let redactedString = redactSensitiveInformation(resultString);
			/**
			 * @param {string} serializedString
			 */
			function replaceNewLineCharacters(serializedString) {
				return serializedString
					.replace(/\\t/g, "\t") // Replace escaped tabs
					.replace(/\\n/g, "\n") // Replace escaped newlines
					.replace(/\\r/g, "\r") // Replace escaped carriage returns
					.replace(/\\"/g, '"') // Replace escaped double quotes
					.replace(/\\\\/g, "\\"); // Replace escaped backslashes
			}
			redactedString = replaceNewLineCharacters(redactedString);
			const resultStringLength = redactedString.length;

			// Check if the result exceeds the message length limit
			if (resultStringLength > 1980) {
				// Send an initial message indicating that the upload is in progress
				const uploadMessage = await message.channel.send(
					"The result is too large to send as a message and is being uploaded as a file. 📤",
				);

				// Create a buffer from the redacted result string
				const buffer = Buffer.from(redactedString, "utf-8");
				// Send the result as a file with the appropriate extension
				await message.channel.send({
					content: "Here is the file containing the result:",
					files: [
						{
							attachment: buffer,
							name: `result.${fileExtension}`,
						},
					],
				});

				// Delete the upload message after the file is sent
				await uploadMessage.delete();
			} else {
				// Send the result as a code block message
				await message.channel.send(
					`\`\`\`${fileExtension}\n${redactedString}\n\`\`\``,
				);
			}
		} catch (error) {
			// Log the error
			console.error("Error during code evaluation:", error);

			// Handle errors during evaluation
			const errorString = `${error}`;
			const errorStringLength = errorString.length;

			// Determine the file extension for error messages
			const errorFileExtension = "error";

			// Check if the error message exceeds the message length limit
			if (errorStringLength > 1980) {
				// Send an initial message indicating that the upload is in progress
				const uploadMessage = await message.channel.send(
					"The error message is too large to send as a message and is being uploaded as a file. 📤",
				);

				// Create a buffer from the error string
				const buffer = Buffer.from(errorString, "utf-8");
				// Send the error message as a file with the appropriate extension
				await message.channel.send({
					content: "Here is the file containing the error message:",
					files: [
						{
							attachment: buffer,
							name: `error.${errorFileExtension}`,
						},
					],
				});

				// Delete the upload message after the file is sent
				await uploadMessage.delete();
			} else {
				// Send the error message as a code block message
				await message.channel.send(
					`Error: \`\`\`js\n${errorString}\n\`\`\``,
				);
			}
		}
	},
};
