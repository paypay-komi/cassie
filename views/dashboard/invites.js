export async function init(ctx) {
  const { guildId, api, esc, toast, showMsg, showSaved } = ctx;

  let inviteConfig = {};
  let channels = [];

  async function loadAll() {
    const [cfgRes, tgtRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) return false;
    inviteConfig = (cfgRes.config || {}).inviteConfig || {};
    const targets = tgtRes.ok ? tgtRes : {};
    channels = (targets.channels || []).filter(c => c.type === 'text' || c.type === 0 || c.type === 5);
    return true;
  }

  if (!(await loadAll())) {
    document.getElementById('invite-config').innerHTML = '<div class="msg msg-error">Failed to load invite config.</div>';
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

  async function saveConfig(patch) {
    const r = await api('/api/data/guild-invite-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: patch }),
    });
    if (r.ok) {
      Object.assign(inviteConfig, patch);
      if (r.config) Object.assign(inviteConfig, r.config);
      showSaved();
      return true;
    }
    toast(r.error || 'Failed to save.', 'error');
    return false;
  }

  async function toggleTracking() {
    const current = inviteConfig.trackingEnabled !== false;
    await saveConfig({ trackingEnabled: !current });
    setToggle('toggle-invites', inviteConfig.trackingEnabled !== false);
    setToggle('invite-tracking', inviteConfig.trackingEnabled !== false);
  }

  window._toggleInvite = async function (key, el) {
    if (key !== 'enabled') return;
    await toggleTracking();
  };

  setToggle('toggle-invites', inviteConfig.trackingEnabled !== false);

  const configEl = document.getElementById('invite-config');
  configEl.innerHTML = `
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Welcome Channel</div>
        <div class="toggle-desc">Channel to send join announcements</div>
      </div>
      <select class="input" id="invite-channel" style="width:260px" data-tooltip="Channel where join announcements are posted.">${channelOptions(inviteConfig.channelId)}</select>
    </div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Deduct on Leave</div>
        <div class="toggle-desc">Remove invite credit when a member leaves</div>
      </div>
      <div class="toggle" id="invite-deduct" data-disabled="${!inviteConfig.deductOnLeave}" data-tooltip="Remove one invite credit from the inviter when the joined member leaves."></div>
    </div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Fake Account Threshold (days)</div>
        <div class="toggle-desc">Accounts newer than this are flagged as fake (0 = off)</div>
      </div>
      <input type="number" class="input" id="invite-fake-days" value="${inviteConfig.fakeAccountDays ?? 0}" min="0" max="365" style="width:100px" data-tooltip="Accounts younger than this many days are flagged as fake; 0 disables the check.">
    </div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Tracking Enabled</div>
        <div class="toggle-desc">Track invites for this server</div>
      </div>
      <div class="toggle" id="invite-tracking" data-disabled="${inviteConfig.trackingEnabled === false}" data-tooltip="Record joins and attribute them to invite links."></div>
    </div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Welcome Message</div>
        <div class="toggle-desc">Message sent when a member joins (use {user}, {inviter}, {invites}, {code})</div>
      </div>
      <textarea class="input" id="invite-message" rows="3" style="width:100%;max-width:500px;resize:vertical" data-tooltip="Available tokens: {user}, {user.tag}, {inviter}, {invites}, {guild}, {code}.">${esc(inviteConfig.message || '')}</textarea>
    </div>`;

  configEl.querySelector('#invite-channel').onchange = function () { saveConfig({ channelId: this.value || null }); };
  configEl.querySelector('#invite-deduct').onclick = async function () {
    await saveConfig({ deductOnLeave: !inviteConfig.deductOnLeave });
    setToggle('invite-deduct', !!inviteConfig.deductOnLeave);
  };
  configEl.querySelector('#invite-fake-days').onchange = function () { saveConfig({ fakeAccountDays: Number(this.value) || 0 }); };
  configEl.querySelector('#invite-tracking').onclick = toggleTracking;
  configEl.querySelector('#invite-message').onchange = function () { saveConfig({ message: this.value }); };
  setToggle('invite-deduct', !!inviteConfig.deductOnLeave);
  setToggle('invite-tracking', inviteConfig.trackingEnabled !== false);
}
