export async function init(ctx) {
  const { guildId, api, esc, toast, showMsg, showSaved, confirmAsync } = ctx;

  const INVOKE_COMMANDS = ['warn', 'kick', 'ban', 'hardban', 'softban', 'timeout', 'jail', 'imute', 'rmute'];
  const WARN_ACTIONS = ['timeout', 'kick', 'jail', 'hardban', 'softban', 'ban'];

  let jail = { enabled: false };
  let imute = { enabled: false };
  let rmute = { enabled: false };
  let warnPunish = [];
  let invokes = [];
  let channels = [];
  let roles = [];

  async function loadAll() {
    const [cfgRes, tgtRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) return false;
    const cfg = cfgRes.config || {};
    jail = cfg.jailConfig || { enabled: false };
    imute = cfg.imuteConfig || { enabled: false };
    rmute = cfg.rmuteConfig || { enabled: false };
    warnPunish = cfg.warnPunishments || [];
    invokes = cfg.invokeConfigs || [];
    const targets = tgtRes.ok ? tgtRes : {};
    channels = (targets.channels || []).filter(c => c.type === 'text' || c.type === 0 || c.type === 5);
    roles = targets.roles || [];
    return true;
  }

  if (!(await loadAll())) {
    showMsg('Failed to load moderation config.');
    return;
  }

  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.disabled = String(!on);
    el.classList.toggle('on', on);
  }

  function channelOptions(selected) {
    let h = '<option value="">None</option>';
    for (const ch of channels) {
      h += `<option value="${esc(ch.id)}" ${ch.id === selected ? 'selected' : ''}>#${esc(ch.name)}</option>`;
    }
    return h;
  }

  function roleOptions(selected) {
    let h = '<option value="">None</option>';
    for (const r of roles) {
      h += `<option value="${esc(r.id)}" ${r.id === selected ? 'selected' : ''}>@${esc(r.name)}</option>`;
    }
    return h;
  }

  function roleLabel(id) {
    const r = roles.find(x => x.id === id);
    return r ? '@' + r.name : id;
  }

  window._toggleMod = async function (type, el) {
    const target = type === 'jail' ? jail : type === 'imute' ? imute : type === 'rmute' ? rmute : null;
    if (!target) return;
    const newVal = !target.enabled;
    if (type === 'jail') {
      await saveJail({ enabled: newVal });
    } else {
      await saveMute(type, { enabled: newVal });
    }
    setToggle(el.id, type === 'jail' ? jail.enabled : type === 'imute' ? imute.enabled : rmute.enabled);
  };

  async function saveJail(patch) {
    const r = await api('/api/data/guild-jail-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: patch }),
    });
    if (r.ok) {
      Object.assign(jail, patch);
      if (r.config) Object.assign(jail, r.config);
      showSaved();
      return true;
    }
    toast(r.error || 'Failed to save.', 'error');
    return false;
  }

  async function saveMute(muteType, patch) {
    const r = await api('/api/data/guild-muted-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, muteType, config: patch }),
    });
    if (r.ok) {
      const target = muteType === 'imute' ? imute : rmute;
      Object.assign(target, patch);
      if (r.config) Object.assign(target, r.config);
      showSaved();
      return true;
    }
    toast(r.error || 'Failed to save.', 'error');
    return false;
  }

  // === JAIL CONFIG ===
  setToggle('toggle-jail', jail.enabled);

  function renderJailConfig() {
    const el = document.getElementById('jail-config');
    if (!el) return;
    el.innerHTML = `
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Jail Channel</div>
          <div class="toggle-desc">Channel where jailed users are moved (voice) or kept</div>
        </div>
        <select class="input" id="jail-channel" style="width:260px" data-tooltip="Channel used to hold jailed members.">${channelOptions(jail.channelId)}</select>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Jail Role</div>
          <div class="toggle-desc">Role given to jailed users</div>
        </div>
        <select class="input" id="jail-role" style="width:260px" data-tooltip="Role applied to jailed members.">${roleOptions(jail.roleId)}</select>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Log Channel</div>
          <div class="toggle-desc">Channel for jail logs</div>
        </div>
        <select class="input" id="jail-log" style="width:260px" data-tooltip="Channel where jail actions are logged.">${channelOptions(jail.logChannelId)}</select>
      </div>`;
    el.querySelector('#jail-channel').onchange = function () { saveJail({ channelId: this.value || null }); };
    el.querySelector('#jail-role').onchange = function () { saveJail({ roleId: this.value || null }); };
    el.querySelector('#jail-log').onchange = function () { saveJail({ logChannelId: this.value || null }); };
  }

  // === IMUTE / RMUTE CONFIG ===
  setToggle('toggle-imute', imute.enabled);
  setToggle('toggle-rmute', rmute.enabled);

  function renderMuteConfig(id, hostId, muteType, cfg) {
    const el = document.getElementById(hostId);
    if (!el) return;
    el.innerHTML = `
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">${muteType === 'imute' ? 'Image' : 'Reaction'} Mute Role</div>
          <div class="toggle-desc">Role applied to ${muteType === 'imute' ? 'image' : 'reaction'} muted users</div>
        </div>
        <select class="input" id="${id}-role" style="width:260px" data-tooltip="Role applied to ${muteType === 'imute' ? 'image' : 'reaction'} muted members.">${roleOptions(cfg.roleId)}</select>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Log Channel</div>
          <div class="toggle-desc">Channel for ${muteType === 'imute' ? 'image' : 'reaction'} mute logs</div>
        </div>
        <select class="input" id="${id}-log" style="width:260px" data-tooltip="Channel where ${muteType === 'imute' ? 'image' : 'reaction'} mute actions are logged.">${channelOptions(cfg.logChannelId)}</select>
      </div>`;
    el.querySelector(`#${id}-role`).onchange = function () { saveMute(muteType, { roleId: this.value || null }); };
    el.querySelector(`#${id}-log`).onchange = function () { saveMute(muteType, { logChannelId: this.value || null }); };
  }

  // === WARN PUNISHMENTS ===
  async function warnAction(payload) {
    const r = await api('/api/data/guild-warn-punishments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, ...payload }),
    });
    if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
  }

  function renderWarnPunishments() {
    const el = document.getElementById('warn-punishments');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <input type="number" class="input" id="wp-threshold" placeholder="Warn count" min="1" style="width:110px" data-tooltip="Number of warnings that triggers this punishment.">
        <select class="input" id="wp-action" style="width:120px" data-tooltip="Action applied when the warning threshold is reached.">
          ${WARN_ACTIONS.map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>
        <input type="number" class="input" id="wp-duration" placeholder="Duration (s)" min="0" style="width:120px" data-tooltip="Timeout duration in seconds; only used for timeout actions.">
        <button class="btn btn-secondary btn-sm" id="wp-add" data-tooltip="Add this warning escalation.">Add Punishment</button>
      </div>
      ${!warnPunish.length ? '<div class="inline-empty">No warn punishments configured. Add thresholds to escalate action automatically.</div>' : ''}
      ${warnPunish.slice().sort((a, b) => a.threshold - b.threshold).map(wp => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
            <strong style="min-width:110px">${wp.threshold} warn${wp.threshold === 1 ? '' : 's'}</strong>
            <span class="badge badge-red">${esc(wp.action)}</span>
            ${wp.duration ? `<span style="color:var(--text-2)">${wp.duration}s</span>` : ''}
            <button class="btn btn-sm btn-ghost del-btn" data-wp-remove="${wp.threshold}" style="margin-left:auto" data-tooltip="Remove this warning escalation.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#wp-add').onclick = () => {
      const threshold = parseInt(el.querySelector('#wp-threshold').value, 10);
      const punishAction = el.querySelector('#wp-action').value;
      const durRaw = el.querySelector('#wp-duration').value;
      if (!threshold || threshold < 1) { toast('Enter a warn count.', 'error'); return; }
      warnAction({ action: 'add', threshold, punishAction, duration: durRaw === '' ? null : Number(durRaw) });
    };
    el.querySelectorAll('[data-wp-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Punishment', `Remove the punishment at <strong>${this.dataset.wpRemove}</strong> warns?`))) return;
        warnAction({ action: 'remove', threshold: Number(this.dataset.wpRemove) });
      };
    });
  }

  // === INVOKE MESSAGES ===
  async function invokeAction(payload) {
    const r = await api('/api/data/guild-invoke-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, ...payload }),
    });
    if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
  }

  let editingInvoke = null;

  function renderInvokes() {
    const el = document.getElementById('invoke-templates');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-bottom:var(--sp-2)">
        <div style="display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap">
          <select class="input" id="iv-command" style="width:130px" data-tooltip="Moderation command this message is for.">
            ${INVOKE_COMMANDS.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <select class="input" id="iv-type" style="width:130px" data-tooltip="Send the message by DM or in the current channel.">
            <option value="dm">DM</option>
            <option value="message">Channel message</option>
          </select>
          <button class="btn btn-primary btn-sm" id="iv-save" data-tooltip="Save this invoke message for the selected command and destination.">${editingInvoke ? 'Update' : 'Add'} Invoke Message</button>
          ${editingInvoke ? '<button class="btn btn-ghost btn-sm" id="iv-cancel" data-tooltip="Discard changes and clear the invoke message editor.">Cancel edit</button>' : ''}
        </div>
        <textarea class="input" id="iv-content" rows="3" placeholder="Message content. Tokens: {user} {user.tag} {moderator} {guild} {reason} {duration} {case} {channel}" data-tooltip="Tokens in braces are replaced with details of the moderation action."></textarea>
      </div>
      ${!invokes.length ? '<div class="inline-empty">No invoke messages configured. These are sent when a moderation action is taken.</div>' : ''}
      ${invokes.map(iv => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:flex-start;flex-wrap:wrap">
            <strong style="min-width:80px">${esc(iv.command)}</strong>
            <span class="badge badge-blue">${iv.type === 'dm' ? 'DM' : 'message'}</span>
            <div style="flex:1;min-width:200px;color:var(--text-1);font-size:var(--text-sm);word-break:break-word">${esc(iv.content)}</div>
            <button class="btn btn-sm btn-ghost" data-iv-edit="${esc(iv.command)}|${esc(iv.type)}" data-tooltip="Load this message into the editor.">Edit</button>
            <button class="btn btn-sm btn-ghost del-btn" data-iv-remove="${esc(iv.command)}" data-iv-type="${esc(iv.type)}" data-tooltip="Delete this invoke message.">Remove</button>
          </div>
        </div>`).join('')}`;

    const cmdSel = el.querySelector('#iv-command');
    const typeSel = el.querySelector('#iv-type');
    const content = el.querySelector('#iv-content');
    if (editingInvoke) {
      cmdSel.value = editingInvoke.command;
      typeSel.value = editingInvoke.type;
      content.value = editingInvoke.content;
    }
    el.querySelector('#iv-save').onclick = () => {
      const command = cmdSel.value;
      const type = typeSel.value;
      const text = content.value.trim();
      if (!text) { toast('Enter message content.', 'error'); return; }
      editingInvoke = null;
      invokeAction({ command, type, content: text });
    };
    const cancelBtn = el.querySelector('#iv-cancel');
    if (cancelBtn) cancelBtn.onclick = () => { editingInvoke = null; renderInvokes(); };
    el.querySelectorAll('[data-iv-edit]').forEach(btn => {
      btn.onclick = function () {
        const [command, type] = this.dataset.ivEdit.split('|');
        const iv = invokes.find(x => x.command === command && x.type === type);
        editingInvoke = iv ? { command, type, content: iv.content } : null;
        renderInvokes();
      };
    });
    el.querySelectorAll('[data-iv-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Invoke Message', `Remove the <strong>${esc(this.dataset.ivRemove)}</strong> (${esc(this.dataset.ivType)}) invoke message?`))) return;
        invokeAction({ action: 'delete', command: this.dataset.ivRemove, type: this.dataset.ivType });
      };
    });
  }

  async function refresh() {
    if (!(await loadAll())) return;
    renderWarnPunishments();
    renderInvokes();
  }

  renderJailConfig();
  renderMuteConfig('imu', 'imute-config', 'imute', imute);
  renderMuteConfig('rmu', 'rmute-config', 'rmute', rmute);
  renderWarnPunishments();
  renderInvokes();
}
