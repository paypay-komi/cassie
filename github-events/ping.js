module.exports = {
	name: "ping",
	async execute(payload, client) {
		console.log("Received ping event:", payload);
	},
};
