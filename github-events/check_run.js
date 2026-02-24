module.exports = {
	name: 'check_run',
	async execute(payload, client) {
		console.log('Received check_run event:', payload);
	},
};
