const ACTIONS = [
  "ambush","backflip","backrub","bake","balance","beckon","beg","bite","bless",
  "blowkiss","blush","bonk","boop","bow","brush","burn","burp","calm","carry",
  "cartwheel","celebrate","cheer","choke","coffee","cook","cower","crab",
  "crashout","creep","crush","cry","cuddle","curtsy","dab","dance","destroy",
  "dip","dodge","drown","dry","eat","excited","explode","facepalm","faint",
  "feed","fistbump","flex","flip","footrub","freeze","gasp","glare","glomp",
  "grin","handhold","handshake","happy","headpat","headrub","hide","highfive",
  "hop","hug","juggle","jump","kick","kill","kiss","kisscheek","kneel","laugh",
  "levitate","lick","lift","mad","magic","massage","moonwalk","nom","nudge",
  "nuzzle","pat","peek","pet","piggyback","pinch","point","poke","pounce",
  "propose","punch","rage","relaxed","run","salute","scream","shiver","shoo",
  "shoot","shrug","shuffle","shush","skip","slam","slap","sleep","slide",
  "smash","smile","smirk","snap","sneak","snuggle","sob","somersault","spank",
  "spin","squish","stab","stare","sweat","swoon","tackle","tap","tea","tease",
  "tickle","tpose","trash","twirl","walk","wash","wave","wink","wreck","yawn",
  "yeet"
];

module.exports = {
  path: "/gif-tagger",
  method: "get",
  handler: async (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GIF Tagger</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#1a1a2e;color:#e0e0e0;min-height:100vh}
.container{max-width:900px;margin:0 auto;padding:20px}
h1{text-align:center;margin-bottom:8px;font-size:24px}
.progress{text-align:center;color:#888;margin-bottom:20px;font-size:14px}
.main-area{background:#16213e;border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px}
.media-container{width:100%;max-height:400px;display:flex;justify-content:center;background:#0f3460;border-radius:8px;overflow:hidden}
.media-container img,.media-container video{max-width:100%;max-height:400px;object-fit:contain}
.filename{color:#aaa;font-size:13px;font-family:monospace;word-break:break-all}
.action-search{width:100%;padding:10px 14px;border-radius:8px;border:1px solid #333;background:#0f3460;color:#e0e0e0;font-size:15px;outline:none}
.action-search:focus{border-color:#e94560}
.custom-tags-row{width:100%}
.actions-grid{display:flex;flex-wrap:wrap;gap:6px;width:100%;max-height:240px;overflow-y:auto;padding:4px}
.actions-grid::-webkit-scrollbar{width:6px}
.actions-grid::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
.action-btn{padding:5px 12px;border-radius:14px;border:1px solid #333;background:#0f3460;color:#ccc;cursor:pointer;font-size:13px;transition:all .15s;user-select:none}
.action-btn:hover{border-color:#e94560}
.action-btn.selected{background:#e94560;color:#fff;border-color:#e94560}
.btn-row{display:flex;gap:10px;width:100%;justify-content:center}
.btn{padding:10px 28px;border-radius:8px;border:none;cursor:pointer;font-size:15px;font-weight:600;transition:opacity .15s}
.btn:hover{opacity:.85}
.btn-save{background:#e94560;color:#fff}
.btn-skip{background:#333;color:#aaa}
.btn-delete{background:#6b2020;color:#fff}
.status{text-align:center;font-size:13px;min-height:20px;margin-top:8px}
.status.error{color:#e94560}
.status.success{color:#4ecca3}
.done{text-align:center;padding:60px 20px}
.done h2{font-size:28px;margin-bottom:12px}
.done p{color:#888;font-size:16px}
</style>
</head>
<body>
<div class="container" id="app">
<h1>GIF Tagger</h1>
<div class="progress" id="progress"></div>
<div id="content"></div>
</div>
<script>
const ACTIONS = ${JSON.stringify(ACTIONS)};
const VIDEO_EXTS = new Set(["mp4","webm","mov","avi","mkv","flv","wmv","m4v"]);

let cur = null;
let sel = new Set();
let done = 0;
let remain = 0;

async function stats() {
  const r = await fetch("/gif-tagger/api/stats");
  const d = await r.json();
  if (d.ok) {
    done = d.done;
    remain = d.remaining;
    document.getElementById("progress").textContent = d.done + " / " + (d.done + d.remaining) + " categorized";
  }
}

async function next() {
  const status = document.getElementById("status");
  if (status) { status.className = "status"; status.textContent = "Loading..."; }
  sel = new Set();
  var ct = document.getElementById("customTags");
  if (ct) ct.value = "";
  var sr = document.getElementById("search");
  if (sr) sr.value = "";
  try {
    const r = await fetch("/gif-tagger/api/next");
    const d = await r.json();
    if (!d.ok) {
      document.getElementById("content").innerHTML = '<div class="done"><h2>All done!</h2><p>Every GIF has been categorized.</p></div>';
      if (status) status.textContent = "";
      return;
    }
    cur = d.file;
    document.getElementById("progress").textContent = done + " / " + (done + remain) + " categorized";
    renderGif(d.file, d.ext);
    renderActions();
    if (status) status.textContent = "";
  } catch (e) {
    const s = document.getElementById("status");
    if (s) { s.className = "status error"; s.textContent = "Error loading next GIF"; }
  }
}

function renderGif(file, ext) {
  const url = "/reactiongifs/" + encodeURIComponent(file) + "." + encodeURIComponent(ext);
  const isVideo = VIDEO_EXTS.has(ext);
  const media = isVideo
    ? '<video src="' + url + '" controls autoplay loop></video>'
    : '<img src="' + url + '" alt="preview">';

  document.getElementById("content").innerHTML =
    '<div class="main-area">' +
      '<div class="media-container">' + media + '</div>' +
      '<div class="filename">' + file + "." + ext + '</div>' +
      '<input class="action-search" id="search" placeholder="Search actions..." oninput="filterActions()">' +
      '<div class="custom-tags-row"><input class="action-search" id="customTags" placeholder="Custom tags (comma-separated, e.g. newaction,othertag)"></div>' +
      '<div class="actions-grid" id="actionsGrid" onclick="gridClick(event)"></div>' +
      '<div class="btn-row">' +
        '<button class="btn btn-save" onclick="saveGif()">Save</button>' +
        '<button class="btn btn-skip" onclick="next()">Skip</button>' +
        '<button class="btn btn-delete" onclick="deleteGif()">Delete</button>' +
      '</div>' +
      '<div class="status" id="status"></div>' +
    '</div>';
}

function renderActions(filter) {
  const grid = document.getElementById("actionsGrid");
  if (!grid) return;
  const list = filter
    ? ACTIONS.filter(function(a) { return a.toLowerCase().includes(filter.toLowerCase()); })
    : ACTIONS;
  grid.innerHTML = list.map(function(a) {
    const cls = sel.has(a) ? "action-btn selected" : "action-btn";
    return '<div class="' + cls + '" data-action="' + a + '">' + a + '</div>';
  }).join("");
}

function filterActions() {
  renderActions(document.getElementById("search").value);
}

function gridClick(e) {
  var el = e.target;
  if (!el.classList.contains("action-btn")) return;
  var a = el.getAttribute("data-action");
  if (!a) return;
  if (sel.has(a)) {
    sel.delete(a);
    el.classList.remove("selected");
  } else {
    sel.add(a);
    el.classList.add("selected");
  }
}

async function saveGif() {
  if (!cur) return;
  const s = document.getElementById("status");
  var tagsInput = document.getElementById("customTags");
  var custom = tagsInput ? tagsInput.value.split(",").map(function(t) { return t.trim().toLowerCase(); }).filter(function(t) { return t.length > 0; }) : [];
  var all = Array.from(sel).concat(custom);
  all = all.filter(function(v, i, a) { return a.indexOf(v) === i; });
  if (all.length === 0) {
    s.className = "status error";
    s.textContent = "Select or type at least one action";
    return;
  }
  s.className = "status";
  s.textContent = "Saving...";
  try {
    const r = await fetch("/gif-tagger/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: cur, actions: all })
    });
    const d = await r.json();
    if (d.ok) {
      s.className = "status success";
      s.textContent = "Saved!";
      done++;
      remain--;
      setTimeout(next, 300);
    } else {
      s.className = "status error";
      s.textContent = d.error || "Save failed";
    }
  } catch (e) {
    const s2 = document.getElementById("status");
    if (s2) { s2.className = "status error"; s2.textContent = "Network error"; }
  }
}

async function deleteGif() {
  if (!cur) return;
  if (!confirm("Delete " + cur + " permanently?")) return;
  const s = document.getElementById("status");
  s.className = "status";
  s.textContent = "Deleting...";
  try {
    const r = await fetch("/gif-tagger/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: cur })
    });
    const d = await r.json();
    if (d.ok) {
      s.className = "status success";
      s.textContent = "Deleted!";
      remain--;
      setTimeout(next, 300);
    } else {
      s.className = "status error";
      s.textContent = d.error || "Delete failed";
    }
  } catch (e) {
    const s2 = document.getElementById("status");
    if (s2) { s2.className = "status error"; s2.textContent = "Network error"; }
  }
}

stats();
next();
</script>
</body>
</html>`);
  },
};
