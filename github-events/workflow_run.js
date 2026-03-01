module.exports = {
	name: "workflow_run",
	async execute(payload, client) {
		console.log("Received workflow_run event:", payload);
	},
};
