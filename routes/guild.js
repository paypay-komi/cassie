const path = require("path");
const { requireGuildAccess } = require("../lib/guildGuard");

function errorPage(status, title, message) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${status} — ${title}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #0f0f13;
    color: #e8e9ee;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 440px;
    padding: 32px;
    background: #17171f;
    border: 1px solid #2a2a35;
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  }
  .brand { font-size: 13px; font-weight: 700; color: #aab0ff; letter-spacing: 0.04em; text-transform: uppercase; }
  .code { margin-top: 20px; font-size: 12px; font-weight: 600; color: #7d818f; letter-spacing: 0.08em; }
  h1 { margin: 6px 0 10px; font-size: 22px; line-height: 1.3; }
  p { margin: 0; color: #9a9daa; font-size: 14px; line-height: 1.6; }
  p a { color: #aab0ff; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 16px;
    border: 1px solid #343442;
    border-radius: 8px;
    background: #1d1d27;
    color: #e8e9ee;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }
  .btn:hover { background: #262633; }
  .btn.primary { background: #6d7cff; border-color: #6d7cff; color: #fff; }
  .btn.primary:hover { background: #7f8cff; }
  .btn:focus-visible, a:focus-visible { outline: 2px solid #aab0ff; outline-offset: 2px; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">Cassie</div>
    <div class="code">ERROR ${status}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="actions">
      <a class="btn primary" href="/dashboard">Back to dashboard</a>
      <a class="btn" href="">Try again</a>
    </div>
  </main>
</body>
</html>`;
}

module.exports = {
	path: "/guild/:guildId",
	method: "get",

	handler: async (req, res) => {
		const session = req.session;

		if (!session?.user) {
			res.setHeader("Content-Type", "text/html");
			return res
				.status(401)
				.send(errorPage(401, "Session expired", "Please log in again to continue."));
		}

		const guard = await requireGuildAccess(session, req.params.guildId, req.app?.locals?.client);
		if (!guard.ok) {
			const errors = {
				401: ["Session expired", "Please log in again to continue."],
				403: ["Access denied", "You need the <strong>Manage Server</strong> permission to access this page."],
				404: ["Server not found", "That server doesn't exist or Cassie isn't in it."],
				502: ["Discord didn't respond", "Discord is taking too long to answer right now. Please try again in a moment."],
			};
			const [title, message] = errors[guard.status] || ["Something went wrong", "An unexpected error occurred."];
			res.setHeader("Content-Type", "text/html");
			return res.status(guard.status).send(errorPage(guard.status, title, message));
		}

		res.sendFile(path.join(process.cwd(), "views", "guild.html"));
	},
};
