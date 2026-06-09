const { EventEmitter } = require("events");

class PrismaSessionStore extends EventEmitter {
	constructor(prisma, options = {}) {
		super();

		this.prisma = prisma;
		this.ttl = options.ttl || 1000 * 60 * 60 * 24 * 7;
	}

	async get(sid, callback) {
		try {
			const session = await this.prisma.session.findUnique({
				where: { sid },
			});

			if (!session) return callback(null, null);

			if (new Date(session.expiresAt) < new Date()) {
				await this.destroy(sid);
				return callback(null, null);
			}

			return callback(null, JSON.parse(session.data));
		} catch (err) {
			return callback(err);
		}
	}

	async set(sid, session, callback) {
		try {
			const expiresAt =
				session?.cookie?.expires || new Date(Date.now() + this.ttl);

			await this.prisma.session.upsert({
				where: { sid },
				update: {
					data: JSON.stringify(session),
					expiresAt,
				},
				create: {
					sid,
					data: JSON.stringify(session),
					expiresAt,
				},
			});

			callback(null);
		} catch (err) {
			callback(err);
		}
	}

	async destroy(sid, callback) {
		try {
			await this.prisma.session.delete({
				where: { sid },
			});

			callback && callback(null);
		} catch (err) {
			callback && callback(err);
		}
	}

	async touch(sid, session, callback) {
		try {
			await this.prisma.session.update({
				where: { sid },
				data: {
					expiresAt:
						session?.cookie?.expires ||
						new Date(Date.now() + this.ttl),
				},
			});

			callback && callback(null);
		} catch (err) {
			callback && callback(err);
		}
	}
}

module.exports = PrismaSessionStore;
