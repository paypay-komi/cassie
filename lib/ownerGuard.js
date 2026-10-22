function requireOwner(req) {
	const ownerId = process.env.OWNER_ID;
	const user = req.session?.user;

	if (!user?.id) {
		return { ok: false, status: 401, error: "unauthorized" };
	}
	if (!ownerId || String(user.id) !== String(ownerId)) {
		return { ok: false, status: 403, error: "forbidden" };
	}
	return { ok: true };
}

module.exports = { requireOwner };
