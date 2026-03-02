
	module.exports = {
		name: "dependabot_alert",
		async execute(payload, client) {
			console.log("Received dependabot_alert event:", payload);
		},
	};
			