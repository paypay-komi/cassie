const path = require("path");

function buildLoginPage(client) {
	const avatarUrl = client?.user
		? `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png?size=512`
		: "https://cdn.discordapp.com/avatars/1461183051949412384/28589706755d6dda2b6f2b6e1b79fb31.png?size=512";
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nekomi Dashboard</title>
<meta property="og:title" content="Nekomi Dashboard">
<meta property="og:description" content="Manage your Cassie bot settings — server configuration, command overrides, tags, and more.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://nekomi.tailef6033.ts.net/dashboard">
<meta property="og:image" content="${avatarUrl}">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="theme-color" content="#5865F2">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/png" href="https://cdn.discordapp.com/avatars/1461183051949412384/28589706755d6dda2b6f2b6e1b79fb31.png?size=64">
<meta name="description" content="Manage your Cassie bot settings — server configuration, command overrides, tags, and more.">
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
