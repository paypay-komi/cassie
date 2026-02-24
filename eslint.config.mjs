import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{
		ignores: ["node_modules", ".history"],
	},
	{
		files: ["**/*.js"],
		languageOptions: {
			sourceType: "commonjs",
			globals: globals.node,
		},
		rules: {
			// 🔥 Logic Safety
			eqeqeq: ["error", "always"],
			"no-constant-condition": "warn",
			"no-unreachable": "error",

			// 🧠 Variable Sanity
			"no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"no-var": "error",
			"prefer-const": "warn",

			// 🧹 Clean Code
			yoda: ["error", "never"],
			"no-trailing-spaces": "warn",
			"eol-last": ["warn", "always"],
			quotes: ["error", "single", { avoidEscape: true }],

			// 🚫 Bug Prevention
			"no-async-promise-executor": "error",
			"require-await": "warn",
			"no-duplicate-imports": "error",

			// 🧯 Optional but Nice
			"no-console": "off",
		},
	},
]);
