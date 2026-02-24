module.exports = {
	name: 'pull_request',
	async execute(payload, client) {
		console.log('Received pull_request event:', payload);
	},
};
