export async function init(ctx) {
  const { guildId, api, esc, toast, showMsg, showSaved, confirmAsync } = ctx;

  const FILTER_TYPES = ['keyword', 'caps', 'emoji', 'images', 'invites', 'links', 'malicious', 'massmention', 'musicfiles', 'nicknames', 'nsfw', 'repetition', 'spam', 'spoilers', 'walloftext'];
  const PUNISHMENTS = ['delete', 'warn', 'timeout', 'kick', 'ban'];
  const STRIKE_ACTIONS = ['warn', 'timeout', 'kick', 'ban', 'strip'];

  let am = { enabled: false };
  let filters = [];
  let regexes = [];
  let exemptions = [];
  let strikes = [];
  let channels = [];
  let roles = [];

  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.disabled = String(!on);
    el.classList.toggle('on', on);
  }

  function options(list, selected) {
    return list.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }

  function channelOptions(selected) {
    let h = '<option value="">None</option>';
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

  async function loadAll() {
    const [cfgRes, tgtRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) return false;
    const cfg = cfgRes.config || {};
    am = cfg.automodConfig || null;
    if (!am) {
      const ensured = await api('/api/data/guild-automod-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, config: {} }),
      });
      if (!ensured.ok) return false;
      am = ensured.config || { enabled: false };
    }
    filters = am.filters || [];
    regexes = am.regexes || [];
    exemptions = am.exemptions || [];
    strikes = am.strikeConfig || [];
    const targets = tgtRes.ok ? tgtRes : {};
    channels = (targets.channels || []).filter(c => c.type === 'text' || c.type === 0 || c.type === 5);
    roles = targets.roles || [];
    return true;
  }

  if (!(await loadAll())) {
    showMsg('Failed to load automod config.');
    return;
  }

  async function saveConfig(patch) {
    const r = await api('/api/data/guild-automod-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: patch }),
    });
    if (r.ok) {
      Object.assign(am, patch);
      if (r.config) Object.assign(am, r.config);
      showSaved();
      return true;
    }
    toast(r.error || 'Failed to save.', 'error');
    return false;
  }

  window._toggleAutomod = async (key, el) => {
    if (key !== 'enabled') return;
    await saveConfig({ enabled: !am.enabled });
    setToggle('toggle-automod', am.enabled);
  };

  // === CONFIG SECTION ===
  function renderConfig() {
    const el = document.getElementById('automod-config');
    if (!el) return;
    el.innerHTML = `
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Log Channel</div>
          <div class="toggle-desc">Channel for automod logs</div>
        </div>
        <select class="input" id="am-log" style="width:260px" data-tooltip="Channel where automod actions are logged.">
          ${channelOptions(am.logChannelId)}
        </select>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Default Punishment</div>
          <div class="toggle-desc">Action taken when a filter is triggered</div>
        </div>
        <div style="display:flex;gap:var(--sp-2);align-items:center">
          <select class="input" id="am-punishment" style="width:130px" data-tooltip="Default action for filters that do not set their own punishment.">
            ${options(PUNISHMENTS, am.punishment || 'delete')}
          </select>
          <input type="number" class="input" id="am-punish-duration" min="0" max="2419200" step="60"
            value="${am.punishmentDuration || 0}" style="width:100px;display:${am.punishment === 'timeout' ? '' : 'none'}"
            placeholder="seconds" data-tooltip="Timeout length in seconds; 0 uses the default of 1 hour.">
        </div>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Strike System</div>
          <div class="toggle-desc">Track strikes and escalate punishments</div>
        </div>
        <div class="toggle" id="am-strikes-enabled" data-disabled="true" data-tooltip="Track strikes for automod violations and apply the escalation thresholds below."></div>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Max Strikes</div>
          <div class="toggle-desc">Strikes before the user is removed from the server</div>
        </div>
        <input type="number" class="input" id="am-max-strikes" min="1" max="50" value="${am.maxStrikes || 5}" style="width:80px" data-tooltip="Number of active strikes that triggers removal from the server.">
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Strike Decay (hours)</div>
          <div class="toggle-desc">Time without strikes before they decay (default 168 = 1 week)</div>
        </div>
        <input type="number" class="input" id="am-decay" min="0" max="8760" value="${am.strikeDecayHours || 168}" style="width:90px" data-tooltip="Hours without a new strike before an active strike expires.">
      </div>`;
    setToggle('am-strikes-enabled', am.strikesEnabled);

    el.querySelector('#am-log').onchange = function () { saveConfig({ logChannelId: this.value || null }); };
    el.querySelector('#am-punishment').onchange = async function () {
      const isTimeout = this.value === 'timeout';
      el.querySelector('#am-punish-duration').style.display = isTimeout ? '' : 'none';
      await saveConfig({ punishment: this.value });
    };
    el.querySelector('#am-punish-duration').onchange = function () { saveConfig({ punishmentDuration: Number(this.value) || 0 }); };
    el.querySelector('#am-strikes-enabled').onclick = async function () {
      await saveConfig({ strikesEnabled: !am.strikesEnabled });
      setToggle('am-strikes-enabled', am.strikesEnabled);
    };
    el.querySelector('#am-max-strikes').onchange = function () { saveConfig({ maxStrikes: Number(this.value) || 5 }); };
    el.querySelector('#am-decay').onchange = function () { saveConfig({ strikeDecayHours: Number(this.value) || 168 }); };
  }

  // === FILTERS ===
  async function filterAction(payload) {
    const r = await api('/api/data/guild-automod-filters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, ...payload }),
    });
    if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
  }

  function renderFilters() {
    const el = document.getElementById('automod-filters');
    if (!el) return;
    const usedTypes = new Set(filters.map(f => f.type));
    const available = FILTER_TYPES.filter(t => !usedTypes.has(t));
    let html = '';
    if (available.length) {
      html += `<div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3)">
        <select class="input" id="amf-new" style="width:180px" data-tooltip="Choose a message filter to add.">
          ${available.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
        </select>
        <button class="btn btn-secondary btn-sm" id="amf-add" data-tooltip="Add the selected message filter.">Add Filter</button>
      </div>`;
    }
    if (!filters.length) {
      html += '<div class="inline-empty">No filters configured. Add one above to start filtering messages.</div>';
    }
    for (const f of filters) {
      const isKeyword = f.type === 'keyword';
      html += `
      <div class="item">
        <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;align-items:center">
          <strong style="min-width:100px">${esc(f.type)}</strong>
          <div class="toggle${f.enabled ? ' on' : ''}" data-filter-toggle="${esc(f.type)}" data-disabled="${!f.enabled}" data-tooltip="Enable or disable the ${esc(f.type)} filter."></div>
          <span class="badge badge-${f.enabled ? 'green' : 'red'}">${f.enabled ? 'Enabled' : 'Disabled'}</span>
          <label style="color:var(--text-2);font-size:var(--text-sm)">Threshold</label>
          <input type="number" class="input" data-filter-threshold="${esc(f.type)}" value="${f.threshold ?? ''}" min="0" style="width:80px" data-tooltip="Value that triggers this filter; the exact meaning depends on the filter type.">
          <label style="color:var(--text-2);font-size:var(--text-sm)">Punishment</label>
          <select class="input" data-filter-punish="${esc(f.type)}" style="width:120px" data-tooltip="Override the default punishment for this filter.">
            <option value="">Default</option>
            ${options(PUNISHMENTS, f.punishment)}
          </select>
          <button class="btn btn-sm btn-ghost del-btn" data-filter-remove="${esc(f.type)}" data-tooltip="Remove this filter and its settings.">Remove</button>
        </div>
        ${isKeyword ? `<div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-2)">
          <div style="flex:1;min-width:220px">
            <label style="color:var(--text-2);font-size:var(--text-xs)">Blacklisted words (comma separated)</label>
            <input class="input" style="width:100%" data-filter-black="${esc(f.type)}" value="${esc((f.blacklisted || []).join(', '))}" data-tooltip="Comma-separated words that trigger the keyword filter.">
          </div>
          <div style="flex:1;min-width:220px">
            <label style="color:var(--text-2);font-size:var(--text-xs)">Whitelisted words (comma separated)</label>
            <input class="input" style="width:100%" data-filter-white="${esc(f.type)}" value="${esc((f.whitelisted || []).join(', '))}" data-tooltip="Comma-separated exceptions that do not trigger the keyword filter.">
          </div>
        </div>` : ''}
      </div>`;
    }
    el.innerHTML = html;

    const addBtn = el.querySelector('#amf-add');
    if (addBtn) {
      addBtn.onclick = () => filterAction({ action: 'add', type: el.querySelector('#amf-new').value, enabled: true });
    }
    el.querySelectorAll('[data-filter-toggle]').forEach(t => {
      t.onclick = async function () {
        const type = this.dataset.filterToggle;
        const f = filters.find(x => x.type === type);
        await filterAction({ action: 'toggle', type, enabled: !f.enabled });
      };
    });
    el.querySelectorAll('[data-filter-threshold]').forEach(inp => {
      inp.onchange = function () {
        if (this.value === '') return;
        filterAction({ action: 'add', type: this.dataset.filterThreshold, threshold: Number(this.value) });
      };
    });
    el.querySelectorAll('[data-filter-punish]').forEach(sel => {
      sel.onchange = function () {
        filterAction({ action: 'add', type: this.dataset.filterPunish, punishment: this.value || null });
      };
    });
    el.querySelectorAll('[data-filter-black]').forEach(inp => {
      inp.onchange = function () {
        filterAction({ action: 'add', type: this.dataset.filterBlack, blacklisted: this.value.split(',').map(s => s.trim()).filter(Boolean) });
      };
    });
    el.querySelectorAll('[data-filter-white]').forEach(inp => {
      inp.onchange = function () {
        filterAction({ action: 'add', type: this.dataset.filterWhite, whitelisted: this.value.split(',').map(s => s.trim()).filter(Boolean) });
      };
    });
    el.querySelectorAll('[data-filter-remove]').forEach(btn => {
      btn.onclick = async function () {
        const type = this.dataset.filterRemove;
        if (!(await confirmAsync('Remove Filter', `Remove the <strong>${esc(type)}</strong> filter?`))) return;
        filterAction({ action: 'remove', type });
      };
    });
  }

  // === REGEX ===
  async function regexAction(payload) {
    const r = await api('/api/data/guild-automod-regex', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, ...payload }),
    });
    if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
  }

  function renderRegex() {
    const el = document.getElementById('automod-regex');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <input class="input" id="amrx-name" placeholder="Rule name" style="width:150px" data-tooltip="A label to identify this regex rule.">
        <input class="input" id="amrx-pattern" placeholder="Regex pattern" style="flex:1;min-width:200px" data-tooltip="JavaScript-style regular expression tested against message content.">
        <button class="btn btn-secondary btn-sm" id="amrx-add" data-tooltip="Add this custom pattern to automod.">Add Regex</button>
      </div>
      ${!regexes.length ? '<div class="inline-empty">No custom regex rules. Add a pattern above to match messages that filters cannot catch.</div>' : ''}
      ${regexes.map(r => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;align-items:center">
            <strong style="min-width:100px">${esc(r.name)}</strong>
            <code style="flex:1;min-width:200px">${esc(r.pattern)}</code>
            <span class="badge badge-${r.enabled ? 'green' : 'red'}">${r.enabled ? 'Enabled' : 'Disabled'}</span>
            <button class="btn btn-sm btn-ghost" data-rx-toggle="${esc(r.name)}" data-rx-enabled="${r.enabled ? 1 : 0}" data-tooltip="Enable or disable this regex rule.">${r.enabled ? 'Disable' : 'Enable'}</button>
            <button class="btn btn-sm btn-ghost del-btn" data-rx-remove="${esc(r.name)}" data-tooltip="Remove this regex rule.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#amrx-add').onclick = () => {
      const name = el.querySelector('#amrx-name').value.trim();
      const pattern = el.querySelector('#amrx-pattern').value.trim();
      if (!name || !pattern) { toast('Name and pattern are required.', 'error'); return; }
      try { new RegExp(pattern); } catch { toast('Invalid regex pattern.', 'error'); return; }
      regexAction({ action: 'add', name, pattern });
    };
    el.querySelectorAll('[data-rx-toggle]').forEach(btn => {
      btn.onclick = function () {
        regexAction({ action: 'toggle', name: this.dataset.rxToggle, enabled: this.dataset.rxEnabled !== '1' });
      };
    });
    el.querySelectorAll('[data-rx-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Regex', `Remove regex rule <strong>${esc(this.dataset.rxRemove)}</strong>?`))) return;
        regexAction({ action: 'remove', name: this.dataset.rxRemove });
      };
    });
  }

  // === EXEMPTIONS ===
  async function exemptionAction(payload) {
    const r = await api('/api/data/guild-automod-exemption', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, ...payload }),
    });
    if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
  }

  function targetLabel(e) {
    if (e.targetType === 'channel') {
      const ch = channels.find(c => c.id === e.targetId);
      return '#' + (ch ? ch.name : e.targetId);
    }
    const r = roles.find(x => x.id === e.targetId);
    return '@' + (r ? r.name : e.targetId);
  }

  function renderExemptions() {
    const el = document.getElementById('automod-exemptions');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <select class="input" id="amex-type" style="width:110px" data-tooltip="Choose whether this exemption applies to a role or a channel.">
          <option value="role">Role</option>
          <option value="channel">Channel</option>
        </select>
        <select class="input" id="amex-role" style="width:220px" data-tooltip="Role that bypasses all automod filters.">${roleOptions()}</select>
        <select class="input" id="amex-channel" style="width:220px;display:none" data-tooltip="Channel where automod filters are skipped.">${channelOptions()}</select>
        <button class="btn btn-secondary btn-sm" id="amex-add" data-tooltip="Roles and channels added here bypass automod filters.">Add Exemption</button>
      </div>
      ${!exemptions.length ? '<div class="inline-empty">No exemptions. Roles or channels added here bypass automod filters.</div>' : ''}
      ${exemptions.map(e => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
            <strong>${esc(targetLabel(e))}</strong>
            <span class="badge badge-blue">${esc(e.targetType)}</span>
            <button class="btn btn-sm btn-ghost del-btn" data-ex-remove="${esc(e.targetId)}" data-ex-type="${esc(e.targetType)}" style="margin-left:auto" data-tooltip="Remove this automod exemption.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#amex-type').onchange = function () {
      const isChannel = this.value === 'channel';
      el.querySelector('#amex-role').style.display = isChannel ? 'none' : '';
      el.querySelector('#amex-channel').style.display = isChannel ? '' : 'none';
    };
    el.querySelector('#amex-add').onclick = () => {
      const type = el.querySelector('#amex-type').value;
      const targetId = type === 'channel' ? el.querySelector('#amex-channel').value : el.querySelector('#amex-role').value;
      if (!targetId) { toast('Select a target first.', 'error'); return; }
      exemptionAction({ action: 'add', targetId, targetType: type });
    };
    el.querySelectorAll('[data-ex-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Exemption', 'Remove this exemption?'))) return;
        exemptionAction({ action: 'remove', targetId: this.dataset.exRemove, targetType: this.dataset.exType });
      };
    });
  }

  // === STRIKES ===
  async function strikeAction(payload) {
    const r = await api('/api/data/guild-automod-strikes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, ...payload }),
    });
    if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
  }

  function renderStrikes() {
    const el = document.getElementById('automod-strikes');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <input type="number" class="input" id="ams-strikes" placeholder="Strikes" min="1" max="50" style="width:90px" data-tooltip="Strike count that triggers this escalation.">
        <select class="input" id="ams-action" style="width:110px" data-tooltip="Action applied when this strike count is reached.">${options(STRIKE_ACTIONS)}</select>
        <input type="number" class="input" id="ams-duration" placeholder="Duration (s)" min="0" style="width:120px" data-tooltip="Timeout duration in seconds; only used for timeout actions.">
        <button class="btn btn-secondary btn-sm" id="ams-add" data-tooltip="Add this strike threshold.">Add Escalation</button>
      </div>
      ${!strikes.length ? '<div class="inline-empty">No strike escalation configured. Add thresholds to escalate punishments automatically.</div>' : ''}
      ${strikes.slice().sort((a, b) => a.strikes - b.strikes).map(s => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
            <strong>${s.strikes} strike${s.strikes === 1 ? '' : 's'}</strong>
            <span class="badge badge-red">${esc(s.action)}</span>
            ${s.duration ? `<span style="color:var(--text-2)">${s.duration}s</span>` : ''}
            <button class="btn btn-sm btn-ghost del-btn" data-st-remove="${s.strikes}" style="margin-left:auto" data-tooltip="Remove this strike escalation.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#ams-add').onclick = () => {
      const count = parseInt(el.querySelector('#ams-strikes').value, 10);
      const action = el.querySelector('#ams-action').value;
      const durRaw = el.querySelector('#ams-duration').value;
      if (!count || count < 1) { toast('Enter a strike count.', 'error'); return; }
      strikeAction({ action: 'add', strikes: count, strikeAction: action, duration: durRaw === '' ? null : Number(durRaw) });
    };
    el.querySelectorAll('[data-st-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Escalation', `Remove the escalation at <strong>${this.dataset.stRemove}</strong> strikes?`))) return;
        strikeAction({ action: 'remove', strikes: Number(this.dataset.stRemove) });
      };
    });
  }

  async function refresh() {
    if (!(await loadAll())) return;
    renderAll();
  }

  function renderAll() {
    setToggle('toggle-automod', am.enabled);
    renderConfig();
    renderFilters();
    renderRegex();
    renderExemptions();
    renderStrikes();
  }

  renderAll();
}
