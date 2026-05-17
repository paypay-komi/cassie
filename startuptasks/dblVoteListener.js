const express = require("express");
require("dotenv/config");

module.exports = {
	name: "dblVoteListener",
	prerequisites: ["startDbl"],
	reloadAble: true,

	server: null,
	app: null,

	voteHandler: null,

	execute(client) {
		if (this.server) {
			this.cleanUp();
		}

		const app = express();
		this.app = app;

		app.use(express.json());

		app.post("/dbl", client.dbl.webhook(process.env.DBL_WEBHOOK_SECRET));
		app.get("/", (req, res) => {
			res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cassie's Backend</title>
      </head>
      <body>
        <h1>Welcome to Cassie's backend voting system</h1>
        <p>Why are you here again... I've secured the POST so good luck doing anything with this.</p>
      </body>
    </html>
  `);
		});
		this.voteHandler = (vote) => {
			console.log(`${vote.username}#${vote.discriminator} voted!`);
		};

		client.dbl.removeListener("vote", this.voteHandler);

		this.server = app.listen(3001, () => {
			console.log("DBL webhook listening on 3001");
		});
	},

	cleanUp() {
		if (this.server) {
			this.server.close(() => {
				console.log("DBL webhook stopped");
			});
		}

		if (this.voteHandler) {
			require("client").dbl?.removeListener("vote", this.voteHandler);
		}

		this.server = null;
		this.app = null;
		this.voteHandler = null;
	},
};
