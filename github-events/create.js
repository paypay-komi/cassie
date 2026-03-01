module.exports = {
	name: "create",
	async execute(payload, client) {
		console.log("Received create event:", payload);
	},
};
