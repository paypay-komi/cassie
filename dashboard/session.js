const session = require("express-session");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const prisma = require("../prisma/client");

module.exports = session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,

	store: new PrismaSessionStore(prisma, {
		checkPeriod: 2 * 60 * 1000, // cleanup expired sessions every 2 min
		dbRecordIdIsSessionId: false,
	}),

	cookie: {
		secure: true, // true in production (HTTPS)
		sameSite: "lax",
		maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
	},
});
