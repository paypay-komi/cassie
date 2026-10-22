export async function init(ctx) {
  const { guildId, api, esc, toast, showMsg, showSaved, confirmAsync, inputAsync } = ctx;

  const AN_TYPES = [
    ['ban', 'Mass Ban'], ['kick', 'Mass Kick'], ['channel', 'Channel Delete/Edit'],
    ['role', 'Role Delete/Edit'], ['emoji', 'Emoji Delete'], ['sticker', 'Sticker Delete'],
    ['webhook', 'Webhook Create'], ['integration', 'Integration Remove'], ['invite', 'Invite Create'],
    ['botadd', 'Bot Add'], ['guildupdate', 'Guild Settings Change'], ['soundboard', 'Soundboard Delete'],
    ['vanity', 'Vanity URL Change'],
  ];
  const AN_PUNISHMENTS = ['ban', 'kick', 'strip', 'timeout'];
  const AR_TYPES = [
    ['age', 'Account Age Check'], ['avatar', 'Default Avatar Check'],
    ['massjoin', 'Mass Join Detection'], ['massmention', 'Mass Mention'],
    ['unverifiedbots', 'Unverified Bots'], ['username', 'Username Patterns'],
  ];

  let an = {};
  let ar = {};
  let anModules = [];
  let arModules = [];
  let channels = [];

  async function loadAll() {
    const [cfgRes, tgtRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) return false;
    const cfg = cfgRes.config || {};
    an = cfg.antinukeConfig || {};
    ar = cfg.antiraidConfig || {};
    anModules = an.modules || [];
    arModules = ar.modules || [];
    channels = ((tgtRes.ok ? tgtRes : {}).channels || []).filter(c => c.type === 'text' || c.type === 0 || c.type === 5);
    return true;
  }

  if (!(await loadAll())) {
    showMsg('Failed to load security config.');
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

  window._toggleSecurity = async function (type, el) {
    if (type === 'antinuke') {
      const r = await api('/api/data/guild-antinuke-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, config: { enabled: !an.enabled } }),
      });
      if (r.ok) { an.enabled = !an.enabled; showSaved(); } else toast(r.error || 'Failed to save.', 'error');
      setToggle('toggle-antinuke', an.enabled);
    } else if (type === 'antiraid') {
      const r = await api('/api/data/guild-antiraid-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, config: { enabled: !ar.enabled } }),
      });
      if (r.ok) { ar.enabled = !ar.enabled; showSaved(); } else toast(r.error || 'Failed to save.', 'error');
      setToggle('toggle-antiraid', ar.enabled);
    }
  };

  // === ANTINUKE MODULES ===
  function anModuleRow(type) {
    return anModules.find(m => m.type === type) || null;
  }

  async function saveAnModule(type, patch) {
    const r = await api('/api/data/guild-antinuke-module', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, type, ...patch }),
    });
    if (!r.ok) { toast(r.error || 'Failed to save.', 'error'); return false; }
    if (r.module) {
      const i = anModules.findIndex(m => m.type === type);
      if (i >= 0) anModules[i] = r.module; else anModules.push(r.module);
    }
    showSaved();
    return true;
  }

  function renderAnModules() {
    const el = document.getElementById('antinuke-modules');
    if (!el) return;
    el.innerHTML = AN_TYPES.map(([type, label]) => {
      const mod = anModuleRow(type);
      const enabled = !!(mod && mod.enabled);
      const punishment = mod?.punishment || 'ban';
      return `
      <div class="item">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3)">
          <strong>${label}</strong>
          <div class="toggle${enabled ? ' on' : ''}" data-an-toggle="${type}" data-disabled="${!enabled}" data-tooltip="Enable or disable ${esc(label)} detection."></div>
        </div>
        <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;color:var(--text-2);font-size:var(--text-sm);margin-top:var(--sp-2)">
          <label>Punishment</label>
          <select class="input" data-an-punish="${type}" style="width:110px" data-tooltip="Action taken when this module triggers.">
            ${AN_PUNISHMENTS.map(p => `<option value="${p}" ${p === punishment ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <input type="number" class="input" data-an-duration="${type}" value="${mod?.punishmentDuration ?? ''}" placeholder="timeout seconds" min="0" style="width:130px;display:${punishment === 'timeout' ? '' : 'none'}" data-tooltip="Timeout length in seconds; only used when punishment is timeout.">
          <label>Log</label>
          <select class="input" data-an-log="${type}" style="width:180px" data-tooltip="Channel where this module's triggers are logged.">${channelOptions(mod?.logChannelId)}</select>
          <label>Threshold</label>
          <input type="number" class="input" data-an-threshold="${type}" value="${mod?.threshold ?? ''}" placeholder="none" min="1" style="width:80px" data-tooltip="Number of events within the window that triggers punishment; blank uses the module default.">
          <label>Window (s)</label>
          <input type="number" class="input" data-an-window="${type}" value="${mod?.window ?? ''}" placeholder="60" min="1" style="width:80px" data-tooltip="Time window in seconds for counting events.">
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('[data-an-toggle]').forEach(t => {
      t.onclick = async function () {
        const type = this.dataset.anToggle;
        const mod = anModuleRow(type);
        await saveAnModule(type, { enabled: !(mod && mod.enabled) });
        renderAnModules();
      };
    });
    el.querySelectorAll('[data-an-punish]').forEach(sel => {
      sel.onchange = async function () {
        await saveAnModule(this.dataset.anPunish, { punishment: this.value });
        renderAnModules();
      };
    });
    el.querySelectorAll('[data-an-duration]').forEach(inp => {
      inp.onchange = function () {
        if (this.value === '') return;
        saveAnModule(this.dataset.anDuration, { punishmentDuration: Number(this.value) });
      };
    });
    el.querySelectorAll('[data-an-log]').forEach(sel => {
      sel.onchange = function () { saveAnModule(this.dataset.anLog, { logChannelId: this.value || null }); };
    });
    el.querySelectorAll('[data-an-threshold]').forEach(inp => {
      inp.onchange = function () {
        if (this.value === '') return;
        saveAnModule(this.dataset.anThreshold, { threshold: Number(this.value) });
      };
    });
    el.querySelectorAll('[data-an-window]').forEach(inp => {
      inp.onchange = function () {
        if (this.value === '') return;
        saveAnModule(this.dataset.anWindow, { window: Number(this.value) });
      };
    });
  }

  // === ANTINUKE ADMINS / WHITELIST ===
  function renderAnLists() {
    const el = document.getElementById('antinuke-lists');
    if (!el) return;
    const admins = an.admins || [];
    const whitelisted = an.whitelisted || [];
    el.innerHTML = `
      <div style="margin-bottom:var(--sp-4)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);margin-bottom:var(--sp-2)">
          <strong style="font-size:var(--text-sm)">Admins (can use antinuke commands, bypasses checks)</strong>
          <button class="btn btn-secondary btn-sm" id="an-add-admin" data-tooltip="Admins can use antinuke commands and bypass checks.">+ Add Admin</button>
        </div>
        <div class="pill-list">${admins.map(id => `<span class="pill">${esc(id)} <button class="pill-remove" data-an-rm-admin="${esc(id)}" aria-label="Remove admin" data-tooltip="Remove this antinuke admin.">×</button></span>`).join('') || '<span style="color:var(--text-2);font-size:var(--text-sm)">No admins</span>'}</div>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);margin-bottom:var(--sp-2)">
          <strong style="font-size:var(--text-sm)">Whitelisted (bypasses antinuke checks)</strong>
          <button class="btn btn-secondary btn-sm" id="an-add-wl" data-tooltip="Whitelisted users bypass antinuke checks.">+ Add Whitelisted</button>
        </div>
        <div class="pill-list">${whitelisted.map(id => `<span class="pill">${esc(id)} <button class="pill-remove" data-an-rm-wl="${esc(id)}" aria-label="Remove whitelisted user" data-tooltip="Remove this antinuke whitelist entry.">×</button></span>`).join('') || '<span style="color:var(--text-2);font-size:var(--text-sm)">No whitelisted users</span>'}</div>
      </div>`;

    el.querySelector('#an-add-admin').onclick = async () => {
      const id = await inputAsync('Add Antinuke Admin', 'User ID', 'Paste a user ID');
      if (!id) return;
      const adminsNew = [...(an.admins || [])];
      if (!adminsNew.includes(id)) adminsNew.push(id);
      const r = await api('/api/data/guild-antinuke-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, admins: adminsNew }),
      });
      if (r.ok) { an.admins = adminsNew; showSaved(); renderAnLists(); } else toast(r.error || 'Failed.', 'error');
    };
    el.querySelector('#an-add-wl').onclick = async () => {
      const id = await inputAsync('Add Whitelisted User', 'User ID', 'Paste a user ID');
      if (!id) return;
      const wlNew = [...(an.whitelisted || [])];
      if (!wlNew.includes(id)) wlNew.push(id);
      const r = await api('/api/data/guild-antinuke-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, whitelisted: wlNew }),
      });
      if (r.ok) { an.whitelisted = wlNew; showSaved(); renderAnLists(); } else toast(r.error || 'Failed.', 'error');
    };
    el.querySelectorAll('[data-an-rm-admin]').forEach(btn => {
      btn.onclick = async function () {
        const adminsNew = (an.admins || []).filter(id => id !== this.dataset.anRmAdmin);
        const r = await api('/api/data/guild-antinuke-update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, admins: adminsNew }),
        });
        if (r.ok) { an.admins = adminsNew; showSaved(); renderAnLists(); } else toast(r.error || 'Failed.', 'error');
      };
    });
    el.querySelectorAll('[data-an-rm-wl]').forEach(btn => {
      btn.onclick = async function () {
        const wlNew = (an.whitelisted || []).filter(id => id !== this.dataset.anRmWl);
        const r = await api('/api/data/guild-antinuke-update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, whitelisted: wlNew }),
        });
        if (r.ok) { an.whitelisted = wlNew; showSaved(); renderAnLists(); } else toast(r.error || 'Failed.', 'error');
      };
    });
  }

  // === ANTIRAID MODULES ===
  function arModuleRow(type) {
    return arModules.find(m => m.type === type) || null;
  }

  async function saveArModule(type, patch) {
    const r = await api('/api/data/guild-antiraid-module', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, type, ...patch }),
    });
    if (!r.ok) { toast(r.error || 'Failed to save.', 'error'); return false; }
    if (r.module) {
      const i = arModules.findIndex(m => m.type === type);
      if (i >= 0) arModules[i] = r.module; else arModules.push(r.module);
    }
    showSaved();
    return true;
  }

  function renderArModules() {
    const el = document.getElementById('antiraid-modules');
    if (!el) return;
    el.innerHTML = AR_TYPES.map(([type, label]) => {
      const mod = arModuleRow(type);
      const enabled = !!(mod && mod.enabled);
      let extra = '';
      if (type === 'age') {
        extra = `<label>Min account age (days)</label><input type="number" class="input" data-ar-age="${type}" value="${mod?.maxAgeDays ?? 7}" min="1" style="width:80px" data-tooltip="Reject accounts younger than this many days.">`;
      } else if (type === 'username') {
        extra = `<input class="input" data-ar-patterns="${type}" value="${esc((mod?.usernamePatterns || []).join(', '))}" placeholder="comma separated patterns" style="flex:1;min-width:200px" data-tooltip="Comma-separated patterns matched against usernames.">`;
      } else if (type === 'massjoin' || type === 'massmention') {
        extra = `<label>Threshold</label><input type="number" class="input" data-ar-threshold="${type}" value="${mod?.threshold ?? ''}" placeholder="none" min="1" style="width:80px" data-tooltip="Number of events within the window that triggers the module.">
                 <label>Window (s)</label><input type="number" class="input" data-ar-window="${type}" value="${mod?.window ?? ''}" placeholder="30" min="1" style="width:80px" data-tooltip="Time window in seconds for counting events.">`;
      }
      const actionSel = (type !== 'massjoin' && type !== 'massmention')
        ? `<label>Action</label><select class="input" data-ar-action="${type}" style="width:100px" data-tooltip="Action applied to accounts caught by this module.">
             <option value="kick" ${(mod?.action || 'kick') === 'kick' ? 'selected' : ''}>kick</option>
             <option value="ban" ${mod?.action === 'ban' ? 'selected' : ''}>ban</option>
           </select>`
        : '';
      return `
      <div class="item">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3)">
          <strong>${label}</strong>
          <div class="toggle${enabled ? ' on' : ''}" data-ar-toggle="${type}" data-disabled="${!enabled}" data-tooltip="Enable or disable ${esc(label)} protection."></div>
        </div>
        <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;color:var(--text-2);font-size:var(--text-sm);margin-top:var(--sp-2)">
          ${actionSel}${extra}
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('[data-ar-toggle]').forEach(t => {
      t.onclick = async function () {
        const type = this.dataset.arToggle;
        const mod = arModuleRow(type);
        await saveArModule(type, { enabled: !(mod && mod.enabled) });
        renderArModules();
      };
    });
    el.querySelectorAll('[data-ar-action]').forEach(sel => {
      sel.onchange = function () { saveArModule(this.dataset.arAction, { action: this.value }); };
    });
    el.querySelectorAll('[data-ar-age]').forEach(inp => {
      inp.onchange = function () {
        if (this.value === '') return;
        saveArModule(this.dataset.arAge, { maxAgeDays: Number(this.value) });
      };
    });
    el.querySelectorAll('[data-ar-threshold]').forEach(inp => {
      inp.onchange = function () {
        if (this.value === '') return;
        saveArModule(this.dataset.arThreshold, { threshold: Number(this.value) });
      };
    });
    el.querySelectorAll('[data-ar-window]').forEach(inp => {
      inp.onchange = function () {
        if (this.value === '') return;
        saveArModule(this.dataset.arWindow, { window: Number(this.value) });
      };
    });
    el.querySelectorAll('[data-ar-patterns]').forEach(inp => {
      inp.onchange = function () {
        saveArModule(this.dataset.arPatterns, {
          usernamePatterns: this.value.split(',').map(s => s.trim()).filter(Boolean),
        });
      };
    });
  }

  // === ANTIRAID WHITELIST + LOCKDOWN ===
  function renderArWhitelist() {
    const el = document.getElementById('antiraid-whitelist');
    if (!el) return;
    const whitelisted = ar.whitelisted || [];
    el.innerHTML = `
      ${ar.lockdown ? `<div class="msg msg-error" style="margin-bottom:var(--sp-3);display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3)">
        <span>Lockdown is currently ACTIVE (server was locked during a raid).</span>
        <button class="btn btn-secondary btn-sm" id="ar-unlock" data-tooltip="Lift the raid lockdown and restore normal join behavior.">Disable Lockdown</button>
      </div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);margin-bottom:var(--sp-2)">
        <strong style="font-size:var(--text-sm)">Whitelisted (bypasses antiraid checks)</strong>
        <button class="btn btn-secondary btn-sm" id="ar-add-wl" data-tooltip="Whitelisted users bypass antiraid checks.">+ Add Whitelisted</button>
      </div>
      <div class="pill-list">${whitelisted.map(id => `<span class="pill">${esc(id)} <button class="pill-remove" data-ar-rm-wl="${esc(id)}" aria-label="Remove whitelisted user" data-tooltip="Remove this antiraid whitelist entry.">×</button></span>`).join('') || '<span style="color:var(--text-2);font-size:var(--text-sm)">No whitelisted users</span>'}</div>`;

    const unlockBtn = el.querySelector('#ar-unlock');
    if (unlockBtn) {
      unlockBtn.onclick = async () => {
        const r = await api('/api/data/guild-antiraid-update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, config: { lockdown: false } }),
        });
        if (r.ok) { ar.lockdown = false; showSaved(); renderArWhitelist(); } else toast(r.error || 'Failed.', 'error');
      };
    }
    el.querySelector('#ar-add-wl').onclick = async () => {
      const id = await inputAsync('Add Whitelisted User', 'User ID', 'Paste a user ID');
      if (!id) return;
      const wlNew = [...(ar.whitelisted || [])];
      if (!wlNew.includes(id)) wlNew.push(id);
      const r = await api('/api/data/guild-antiraid-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, whitelisted: wlNew }),
      });
      if (r.ok) { ar.whitelisted = wlNew; showSaved(); renderArWhitelist(); } else toast(r.error || 'Failed.', 'error');
    };
    el.querySelectorAll('[data-ar-rm-wl]').forEach(btn => {
      btn.onclick = async function () {
        const wlNew = (ar.whitelisted || []).filter(id => id !== this.dataset.arRmWl);
        const r = await api('/api/data/guild-antiraid-update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, whitelisted: wlNew }),
        });
        if (r.ok) { ar.whitelisted = wlNew; showSaved(); renderArWhitelist(); } else toast(r.error || 'Failed.', 'error');
      };
    });
  }

  setToggle('toggle-antinuke', !!an.enabled);
  setToggle('toggle-antiraid', !!ar.enabled);
  renderAnModules();
  renderAnLists();
  renderArModules();
  renderArWhitelist();
}
