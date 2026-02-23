module.exports = {
	name: "watch",
	async execute(payload, client) {
		console.log("Received watch event:", payload);
	},
};
