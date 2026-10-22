export async function init(ctx) {
  const { guildId, api, esc, toast, showMsg, showSaved, confirmAsync, inputAsync, emojiPickerAsync, channelPickerWithReloadAsync } = ctx;

  let starboards = [];
  let channels = [];
  let roles = [];

  const DEFAULT_EMOJIS = ['⭐', '✨', '🌟', '⚡', '💫', '🎉', '🔥', '💯', '👍', '❤️', '😂', '😭', '🤔', '😎', '👀'];

  function normalizeEmoji(input) {
    if (!input) return null;
    const custom = input.match(/^<?(a?):(\w+):(\d+)>?$/);
    if (custom) return `${custom[2]}:${custom[3]}`;
    return input;
  }

  function hexToInt(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return Number.isFinite(n) ? n : null;
  }

  function intToHex(n) {
    return '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
  }

  function channelOptions(selected) {
    let h = '<option value="">Select channel...</option>';
    for (const ch of channels) {
      h += `<option value="${esc(ch.id)}" ${ch.id === selected ? 'selected' : ''}>#${esc(ch.name)}</option>`;
    }
    return h;
  }

  function roleOptions(selected) {
    let h = '<option value="">Select role...</option>';
    for (const r of roles) {
      h += `<option value="${esc(r.id)}" ${r.id === selected ? 'selected' : ''}>@${esc(r.name)}</option>`;
    }
    return h;
  }

  function targetLabel(type, id) {
    if (type === 'channel') {
      const ch = channels.find(c => c.id === id);
      return '#' + (ch ? ch.name : id);
    }
    if (type === 'role') {
      const r = roles.find(x => x.id === id);
      return '@' + (r ? r.name : id);
    }
    return id;
  }

  async function loadAll() {
    const [cfgRes, tgtRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) return false;
    starboards = (cfgRes.config || {}).starboards || [];
    const targets = tgtRes.ok ? tgtRes : {};
    channels = (targets.channels || []).filter(c => c.type === 'text' || c.type === 0 || c.type === 5);
    roles = targets.roles || [];
    return true;
  }

  if (!(await loadAll())) {
    document.getElementById('starboard-list').innerHTML = '<div class="msg msg-error" style="margin-top:var(--sp-3)">Failed to load starboard config.</div>';
    return;
  }

  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.disabled = String(!on);
    el.classList.toggle('on', on);
  }

  async function saveStarboard(sb, opts) {
    const body = {
      guildId,
      emoji: opts && opts.oldEmoji ? opts.oldEmoji : sb.emoji,
      config: {
        channelId: sb.channelId,
        threshold: sb.threshold,
        selfStar: sb.selfStar,
        showAttachments: sb.showAttachments,
        showTimestamp: sb.showTimestamp,
        jumpUrl: sb.jumpUrl,
        color: sb.color,
      },
    };
    if (opts && opts.renameTo) {
      Object.assign(body, { action: 'rename', newEmoji: opts.renameTo });
    }
    const r = await api('/api/data/guild-starboard-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      if (r.starboard) Object.assign(sb, r.starboard);
      showSaved();
      return true;
    }
    toast(r.error || 'Failed to save.', 'error');
    return false;
  }

  window._addStarboard = async function () {
    let customEmojis = [];
    try {
      const guild = await api(`/api/data/guild-targets?guildId=${encodeURIComponent(guildId)}`);
      if (guild.ok && guild.emojis) {
        customEmojis = guild.emojis.map(e => ({ id: e.id, name: e.name, animated: e.animated }));
      }
    } catch {}
    const emojiRaw = await emojiPickerAsync('Add Starboard', 'Select the emoji users react with:', DEFAULT_EMOJIS, customEmojis);
    if (!emojiRaw) return;
    const emoji = normalizeEmoji(emojiRaw);
    const channelId = await channelPickerWithReloadAsync('Add Starboard', 'Select the channel where starred messages are posted:', guildId);
    if (!channelId) return;

    const r = await api('/api/data/guild-starboard-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, emoji, config: { channelId, threshold: 1 } }),
    });
    if (r.ok) {
      toast('Starboard added.', 'success');
      await refresh();
    } else {
      toast(r.error || 'Failed to add starboard.', 'error');
    }
  };

  function renderStarboards() {
    const listEl = document.getElementById('starboard-list');
    if (!listEl) return;
    if (!starboards.length) {
      listEl.innerHTML = `<div class="empty-state compact">
        <div class="empty-title">No starboards yet</div>
        <div class="empty-desc">Add a starboard above, choose the reaction emoji, and pick where highlighted messages are posted.</div>
      </div>`;
      return;
    }
    listEl.innerHTML = starboards.map((sb, i) => `
      <div class="card" style="margin-bottom:var(--sp-4)">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-3);border-bottom:1px solid var(--border)">
          <span class="feature-title" style="font-size:var(--text-lg)">${esc(sb.emoji)}</span>
          <button class="btn btn-sm btn-danger" data-sb-delete="${i}" data-tooltip="Delete this starboard; existing entries stop updating.">Delete</button>
        </div>
        <div class="card-body" style="padding:var(--sp-4)">
          <div class="form-row" style="gap:var(--sp-3);flex-wrap:wrap;margin-bottom:var(--sp-3)">
            <div class="form-group" style="flex:1;min-width:200px">
              <label class="form-label">Channel</label>
              <select class="input" data-sb-field="channelId" data-sb-idx="${i}" data-tooltip="Channel where starred messages are posted.">
                ${channelOptions(sb.channelId)}
              </select>
            </div>
            <div class="form-group" style="flex:0 0 130px">
              <label class="form-label">Emoji</label>
              <input type="text" class="input" value="${esc(sb.emoji)}" style="width:100%" data-sb-field="emoji" data-sb-idx="${i}" data-tooltip="Reaction used to star a message; changing it renames this board.">
            </div>
            <div class="form-group" style="flex:0 0 110px">
              <label class="form-label">Threshold</label>
              <input type="number" class="input" value="${sb.threshold ?? 1}" min="1" style="width:100%" data-sb-field="threshold" data-sb-idx="${i}" data-tooltip="Reactions required before a message is posted to the starboard.">
            </div>
          </div>
          <div class="form-row" style="gap:var(--sp-4);flex-wrap:wrap;align-items:center">
            <div class="form-label" style="display:flex;align-items:center;gap:var(--sp-2)">
              <div class="toggle" data-sb-bool="selfStar" data-sb-idx="${i}" data-disabled="${!sb.selfStar}" data-tooltip="Allow members to star their own messages."></div>
              Self Star
            </div>
            <div class="form-label" style="display:flex;align-items:center;gap:var(--sp-2)">
              <div class="toggle" data-sb-bool="showAttachments" data-sb-idx="${i}" data-disabled="${sb.showAttachments === false}" data-tooltip="Include images and file attachments in the starboard embed."></div>
              Show Attachments
            </div>
            <div class="form-label" style="display:flex;align-items:center;gap:var(--sp-2)">
              <div class="toggle" data-sb-bool="showTimestamp" data-sb-idx="${i}" data-disabled="${sb.showTimestamp === false}" data-tooltip="Show when the original message was sent."></div>
              Show Timestamp
            </div>
            <div class="form-label" style="display:flex;align-items:center;gap:var(--sp-2)">
              <div class="toggle" data-sb-bool="jumpUrl" data-sb-idx="${i}" data-disabled="${sb.jumpUrl === false}" data-tooltip="Include a link back to the original message."></div>
              Jump URL
            </div>
            <div style="display:flex;align-items:center;gap:var(--sp-2)">
              <span class="form-label">Color</span>
              <input type="color" value="${sb.color != null ? intToHex(sb.color) : '#ffac33'}" style="width:56px;height:30px;border:none;background:none;padding:0" data-sb-field="color" data-sb-idx="${i}" data-tooltip="Accent color for this starboard's embeds.">
            </div>
          </div>
          <div class="section-title" style="font-size:var(--text-sm);margin-top:var(--sp-4);margin-bottom:var(--sp-2)">Ignored Channels, Roles, and Members</div>
          <div class="pill-list" data-sb-ignores="${i}">
            ${(sb.ignored || []).map(ig => `<span class="pill">${esc(targetLabel(ig.targetType, ig.targetId))} <button class="pill-remove" data-sb-rm-ignore="${i}|${esc(ig.targetId)}|${esc(ig.targetType)}" aria-label="Remove ignore" data-tooltip="Remove this starboard ignore.">×</button></span>`).join('') || '<span style="color:var(--text-2);font-size:var(--text-sm)">No ignores</span>'}
          </div>
          <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-2);flex-wrap:wrap">
            <select class="input" data-sb-ig-type="${i}" style="width:120px" data-tooltip="Choose which kind of target to exclude from this starboard.">
              <option value="channel">Channel</option>
              <option value="role">Role</option>
              <option value="member">Member (user ID)</option>
            </select>
            <select class="input" data-sb-ig-target="${i}" style="width:220px" data-tooltip="Target excluded from this starboard.">${roleOptions(null)}</select>
            <button class="btn btn-sm btn-secondary" data-sb-ig-add="${i}" data-tooltip="Add this target to the ignore list.">Add Ignore</button>
          </div>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-sb-delete]').forEach(btn => {
      btn.onclick = async function () {
        const i = Number(this.dataset.sbDelete);
        const sb = starboards[i];
        if (!(await confirmAsync('Delete Starboard', `Delete the <strong>${esc(sb.emoji)}</strong> starboard? Entries will no longer be updated.`))) return;
        const r = await api('/api/data/guild-starboard-update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, emoji: sb.emoji, action: 'delete' }),
        });
        if (r.ok) { toast('Starboard deleted.', 'success'); await refresh(); } else toast(r.error || 'Failed.', 'error');
      };
    });

    listEl.querySelectorAll('[data-sb-field]').forEach(inp => {
      inp.onchange = async function () {
        const i = Number(this.dataset.sbIdx);
        const field = this.dataset.sbField;
        const sb = starboards[i];
        if (field === 'emoji') {
          const newEmoji = normalizeEmoji(this.value.trim());
          if (!newEmoji || newEmoji === sb.emoji) return;
          const ok = await saveStarboard(sb, { oldEmoji: sb.emoji, renameTo: newEmoji });
          if (ok) sb.emoji = newEmoji;
        } else if (field === 'threshold') {
          sb.threshold = Number(this.value) || 1;
          await saveStarboard(sb);
        } else if (field === 'color') {
          sb.color = hexToInt(this.value);
          await saveStarboard(sb);
        } else {
          sb[field] = this.value;
          await saveStarboard(sb);
        }
      };
    });

    listEl.querySelectorAll('[data-sb-bool]').forEach(t => {
      const i = Number(t.dataset.sbIdx);
      const key = t.dataset.sbBool;
      const sb = starboards[i];
      const enabled = key === 'selfStar' ? !!sb.selfStar : sb[key] !== false;
      t.dataset.disabled = String(!enabled);
      t.classList.toggle('on', enabled);
      t.onclick = async function () {
        const current = key === 'selfStar' ? !!sb.selfStar : sb[key] !== false;
        sb[key] = !current;
        this.dataset.disabled = String(!sb[key]);
        this.classList.toggle('on', sb[key]);
        await saveStarboard(sb);
      };
    });

    listEl.querySelectorAll('[data-sb-ig-type]').forEach(sel => {
      sel.onchange = function () {
        const i = this.dataset.sbIgType;
        const targetSel = listEl.querySelector(`[data-sb-ig-target="${i}"]`);
        if (this.value === 'channel') {
          targetSel.innerHTML = channelOptions(null);
          targetSel.style.display = '';
        } else if (this.value === 'role') {
          targetSel.innerHTML = roleOptions(null);
          targetSel.style.display = '';
        } else {
          targetSel.style.display = 'none';
        }
      };
    });

    listEl.querySelectorAll('[data-sb-ig-add]').forEach(btn => {
      btn.onclick = async function () {
        const i = Number(this.dataset.sbIgAdd);
        const sb = starboards[i];
        const typeSel = listEl.querySelector(`[data-sb-ig-type="${i}"]`);
        const type = typeSel.value;
        let targetId = null;
        if (type === 'channel' || type === 'role') {
          targetId = listEl.querySelector(`[data-sb-ig-target="${i}"]`).value;
        } else {
          targetId = (await inputAsync('Add Ignore', 'Member ID', 'Paste a user ID')) || null;
        }
        if (!targetId) { toast('Select or enter a target.', 'error'); return; }
        const r = await api('/api/data/guild-starboard-ignore', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, emoji: sb.emoji, action: 'add', targetId, targetType: type }),
        });
        if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
      };
    });

    listEl.querySelectorAll('[data-sb-rm-ignore]').forEach(btn => {
      btn.onclick = async function () {
        const [i, targetId, targetType] = this.dataset.sbRmIgnore.split('|');
        const sb = starboards[Number(i)];
        const r = await api('/api/data/guild-starboard-ignore', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, emoji: sb.emoji, action: 'remove', targetId, targetType }),
        });
        if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
      };
    });
  }

  async function refresh() {
    if (!(await loadAll())) return;
    renderStarboards();
  }

  renderStarboards();
}
