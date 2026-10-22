export async function init(ctx) {
  const { guildId, api, esc, toast, showMsg, showSaved } = ctx;

  let boostConfig = {};
  let channels = [];
  let roles = [];

  async function loadAll() {
    const [cfgRes, tgtRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) return false;
    boostConfig = (cfgRes.config || {}).boostConfig || {};
    const targets = tgtRes.ok ? tgtRes : {};
    channels = (targets.channels || []).filter(c => c.type === 'text' || c.type === 0 || c.type === 5);
    roles = targets.roles || [];
    return true;
  }

  if (!(await loadAll())) {
    document.getElementById('boost-config').innerHTML = '<div class="msg msg-error">Failed to load boost config.</div>';
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

  async function saveConfig(patch) {
    const r = await api('/api/data/guild-boost-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: patch }),
    });
    if (r.ok) {
      Object.assign(boostConfig, patch);
      if (r.config) Object.assign(boostConfig, r.config);
      showSaved();
      return true;
    }
    toast(r.error || 'Failed to save.', 'error');
    return false;
  }

  async function toggleEnabled() {
    const current = boostConfig.enabled !== false;
    await saveConfig({ enabled: !current });
    setToggle('toggle-boosts', boostConfig.enabled !== false);
    setToggle('boost-enabled', boostConfig.enabled !== false);
  }

  window._toggleBoost = async function (key, el) {
    if (key !== 'enabled') return;
    await toggleEnabled();
  };

  setToggle('toggle-boosts', boostConfig.enabled !== false);

  const configEl = document.getElementById('boost-config');
  configEl.innerHTML = `
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Boost Channel</div>
        <div class="toggle-desc">Channel to send boost thank-you messages</div>
      </div>
      <select class="input" id="boost-channel" style="width:260px" data-tooltip="Channel where boost thank-you messages are posted.">${channelOptions(boostConfig.channelId)}</select>
    </div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Booster Role</div>
        <div class="toggle-desc">Role given to boosters (optional)</div>
      </div>
      <select class="input" id="boost-role" style="width:260px" data-tooltip="Automatically applied while a member is boosting and removed when they stop.">${roleOptions(boostConfig.roleId)}</select>
    </div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Boost Notifications</div>
        <div class="toggle-desc">Send messages when members boost the server</div>
      </div>
      <div class="toggle" id="boost-enabled" data-disabled="${boostConfig.enabled === false}" data-tooltip="Send boost thank-you messages and apply the booster role."></div>
    </div>`;

  configEl.querySelector('#boost-channel').onchange = function () { saveConfig({ channelId: this.value || null }); };
  configEl.querySelector('#boost-role').onchange = function () { saveConfig({ roleId: this.value || null }); };
  configEl.querySelector('#boost-enabled').onclick = toggleEnabled;
  setToggle('boost-enabled', boostConfig.enabled !== false);
}
