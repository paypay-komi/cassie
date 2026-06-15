const path = require("path");

function buildLoginPage(client) {
	const avatarUrl = client?.user
		? `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png?size=256`
		: "";
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nekomi Dashboard</title>
<meta property="og:title" content="Nekomi Dashboard">
<meta property="og:description" content="Manage your server's command permissions, view overrides, and configure settings.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://nekomi.tailef6033.ts.net/dashboard">
<meta property="og:site_name" content="Nekomi">
<meta name="theme-color" content="#5865F2">
${avatarUrl ? `<meta property="og:image" content="${avatarUrl}">` : ""}
<meta name="description" content="Manage your server's command permissions, view overrides, and configure settings.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0f0f13; color: #b5bac1; font-family: -apple-system, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { text-align: center; padding: 40px; }
  h1 { font-size: 28px; color: #fff; margin-bottom: 8px; }
  p { margin-bottom: 24px; font-size: 15px; }
  .btn { display: inline-block; background: #5865F2; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; }
  .btn:hover { background: #4752c4; }
</style>
</head>
<body>
<div class="card">
  <h1>Nekomi Dashboard</h1>
  <p>Manage command permissions and server settings.</p>
  <a class="btn" href="/login">Login with Discord</a>
</div>
</body>
</html>`;
}

module.exports = {
	path: "/dashboard",
	method: "get",

	handler: (req, res) => {
		const session = req.session;
		const client = req.app?.locals?.client;

		if (!session?.user) {
			res.send(buildLoginPage(client));
			return;
		}

		res.sendFile(path.join(process.cwd(), "views", "dashboard.html"));
	},
};
