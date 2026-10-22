export async function init(ctx) {
  const { guildId, api, esc, toast, showMsg, showSaved, confirmAsync } = ctx;

  let vmConfig = {};
  let hubs = [];
  let voiceChannels = [];
  let categories = [];
  let roles = [];

  function categoryOptions(selected) {
    let h = '<option value="">None</option>';
    for (const cat of categories) {
      h += `<option value="${esc(cat.id)}" ${cat.id === selected ? 'selected' : ''}>${esc(cat.name)}</option>`;
    }
    return h;
  }

  function voiceChannelOptions(selected) {
    let h = '<option value="">Select voice channel...</option>';
    for (const ch of voiceChannels) {
      h += `<option value="${esc(ch.id)}" ${ch.id === selected ? 'selected' : ''}>${esc(ch.name)}</option>`;
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

  function hubChannelLabel(channelId) {
    const ch = voiceChannels.find(c => c.id === channelId);
    return ch ? ch.name : channelId;
  }

  async function loadAll() {
    const [cfgRes, tgtRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) return false;
    const cfg = cfgRes.config || {};
    vmConfig = cfg.voiceMasterConfig || {};
    hubs = cfg.voiceMasterHubs || [];
    const targets = tgtRes.ok ? tgtRes : {};
    const allChannels = targets.channels || [];
    voiceChannels = allChannels.filter(c => c.type === 'voice' || c.type === 2);
    categories = allChannels.filter(c => c.type === 'category' || c.type === 4);
    roles = targets.roles || [];
    return true;
  }

  if (!(await loadAll())) {
    document.getElementById('vm-config').innerHTML = '<div class="msg msg-error">Failed to load voicemaster config.</div>';
    return;
  }

  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.disabled = String(!on);
    el.classList.toggle('on', on);
  }

  async function saveConfig(patch) {
    const r = await api('/api/data/guild-voicemaster-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: patch }),
    });
    if (r.ok) {
      Object.assign(vmConfig, patch);
      if (r.config) Object.assign(vmConfig, r.config);
      showSaved();
      return true;
    }
    toast(r.error || 'Failed to save.', 'error');
    return false;
  }

  window._toggleVM = async function (key, el) {
    if (key !== 'enabled') return;
    const current = vmConfig.enabled !== false;
    await saveConfig({ enabled: !current });
    setToggle(el.id, vmConfig.enabled !== false);
  };

  setToggle('toggle-vm', vmConfig.enabled !== false);

  function renderConfig() {
    const el = document.getElementById('vm-config');
    if (!el) return;
    el.innerHTML = `
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Category</div>
          <div class="toggle-desc">Category where temporary channels are created</div>
        </div>
        <select class="input" id="vm-category" style="width:260px" data-tooltip="Category where temporary voice channels are created.">${categoryOptions(vmConfig.categoryId)}</select>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Default Bitrate</div>
          <div class="toggle-desc">Bitrate for new voice channels (kbps)</div>
        </div>
        <input type="number" class="input" id="vm-bitrate" value="${vmConfig.defaultBitrate ?? 64}" min="8" max="384" style="width:100px" data-tooltip="Default bitrate in kbps; the available maximum depends on the server's boost tier.">
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Default Name</div>
          <div class="toggle-desc">Name template for new channels (use {user} for username)</div>
        </div>
        <input type="text" class="input" id="vm-name" value="${esc(vmConfig.defaultName || "{user}'s channel")}" style="width:260px" data-tooltip="Supports {user} for the member's username.">
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Default Role</div>
          <div class="toggle-desc">Role given access to new channels by default</div>
        </div>
        <select class="input" id="vm-role" style="width:260px" data-tooltip="Role granted access to every temporary voice channel.">${roleOptions(vmConfig.defaultRoleId)}</select>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Interface Enabled</div>
          <div class="toggle-desc">Show the control panel in the channel</div>
        </div>
        <div class="toggle" id="vm-interface" data-disabled="${vmConfig.interfaceEnabled === false}" data-tooltip="Post the control panel inside each temporary channel."></div>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Temporary</div>
          <div class="toggle-desc">Delete the channel when it becomes empty</div>
        </div>
        <div class="toggle" id="vm-temp" data-disabled="${vmConfig.temporary === false}" data-tooltip="Delete the temporary channel when the last member leaves."></div>
      </div>`;

    el.querySelector('#vm-category').onchange = function () { saveConfig({ categoryId: this.value || null }); };
    el.querySelector('#vm-bitrate').onchange = function () { saveConfig({ defaultBitrate: Number(this.value) || 64 }); };
    el.querySelector('#vm-name').onchange = function () {
      if (!this.value.trim()) return;
      saveConfig({ defaultName: this.value.trim() });
    };
    el.querySelector('#vm-role').onchange = function () { saveConfig({ defaultRoleId: this.value || null }); };
    el.querySelector('#vm-interface').onclick = async function () {
      await saveConfig({ interfaceEnabled: vmConfig.interfaceEnabled === false });
      setToggle('vm-interface', vmConfig.interfaceEnabled !== false);
    };
    el.querySelector('#vm-temp').onclick = async function () {
      await saveConfig({ temporary: vmConfig.temporary === false });
      setToggle('vm-temp', vmConfig.temporary !== false);
    };
    setToggle('vm-interface', vmConfig.interfaceEnabled !== false);
    setToggle('vm-temp', vmConfig.temporary !== false);
  }

  async function hubAction(payload) {
    const r = await api('/api/data/guild-voicemaster-hubs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, ...payload }),
    });
    if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
  }

  function renderHubs() {
    const el = document.getElementById('vm-hubs');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <select class="input" id="vm-hub-channel" style="width:220px" data-tooltip="Voice channel members join to create their own temporary channel.">${voiceChannelOptions(null)}</select>
        <input class="input" id="vm-hub-name" placeholder="Hub name (e.g. Join to Create)" style="width:240px" data-tooltip="Display name used for this hub in the dashboard and control panel.">
        <button class="btn btn-secondary btn-sm" id="vm-hub-add" data-tooltip="Create a join-to-create hub for this voice channel.">Add Hub</button>
      </div>
      ${!hubs.length ? '<div class="inline-empty">No hubs configured. Users who join a hub channel get their own temporary channel.</div>' : ''}
      ${hubs.map(hub => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
            <strong>${esc(hub.name)}</strong>
            <span style="color:var(--text-2);font-size:var(--text-sm)">${esc(hubChannelLabel(hub.channelId))}</span>
            <button class="btn btn-sm btn-ghost del-btn" data-hub-remove="${esc(hub.channelId)}" style="margin-left:auto" data-tooltip="Remove this hub; joining it will no longer create channels.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#vm-hub-add').onclick = () => {
      const channelId = el.querySelector('#vm-hub-channel').value;
      const name = el.querySelector('#vm-hub-name').value.trim();
      if (!channelId) { toast('Select a voice channel.', 'error'); return; }
      if (!name) { toast('Enter a hub name.', 'error'); return; }
      hubAction({ action: 'add', channelId, name });
    };
    el.querySelectorAll('[data-hub-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Hub', 'Remove this hub? Users will no longer be able to create channels by joining it.'))) return;
        hubAction({ action: 'remove', channelId: this.dataset.hubRemove });
      };
    });
  }

  async function refresh() {
    if (!(await loadAll())) return;
    renderConfig();
    renderHubs();
  }

  renderConfig();
  renderHubs();
}
