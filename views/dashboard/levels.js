export async function init(ctx) {
  const { guildId, api, esc, toast, showMsg, showSaved, confirmAsync } = ctx;

  let levelConfig = {};
  let roleRewards = [];
  let multipliers = [];
  let ignores = [];
  let milestones = [];
  let channels = [];
  let roles = [];

  function roleOptions(selected, placeholder) {
    let h = `<option value="">${esc(placeholder || 'None')}</option>`;
    for (const r of roles) {
      h += `<option value="${esc(r.id)}" ${r.id === selected ? 'selected' : ''}>@${esc(r.name)}</option>`;
    }
    return h;
  }

  function channelOptions(selected, placeholder) {
    let h = `<option value="">${esc(placeholder || 'None')}</option>`;
    for (const ch of channels) {
      h += `<option value="${esc(ch.id)}" ${ch.id === selected ? 'selected' : ''}>#${esc(ch.name)}</option>`;
    }
    return h;
  }

  function targetLabel(type, id) {
    if (type === 'channel') {
      const ch = channels.find(c => c.id === id);
      return '#' + (ch ? ch.name : id);
    }
    const r = roles.find(x => x.id === id);
    return '@' + (r ? r.name : id);
  }

  async function loadAll() {
    const [cfgRes, tgtRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) return false;
    const cfg = cfgRes.config || {};
    levelConfig = cfg.levelConfig || {};
    roleRewards = cfg.levelRoleRewards || [];
    multipliers = cfg.levelMultipliers || [];
    ignores = cfg.levelIgnores || [];
    milestones = cfg.levelMilestones || [];
    const targets = tgtRes.ok ? tgtRes : {};
    channels = (targets.channels || []).filter(c => c.type === 'text' || c.type === 0 || c.type === 5);
    roles = targets.roles || [];
    return true;
  }

  if (!(await loadAll())) {
    showMsg('Failed to load level config.');
    return;
  }

  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.disabled = String(!on);
    el.classList.toggle('on', on);
  }

  async function saveLevelConfig(patch) {
    const r = await api('/api/data/guild-levels-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: patch }),
    });
    if (r.ok) {
      Object.assign(levelConfig, patch);
      showSaved();
      return true;
    }
    toast(r.error || 'Failed to save.', 'error');
    return false;
  }

  window._toggleLevel = async function (key, el) {
    const current = key === 'dmLevelUp' ? !!levelConfig[key] : levelConfig[key] !== false;
    await saveLevelConfig({ [key]: !current });
    setToggle(el.id, !current);
  };

  window._saveLevelConfig = async function (key, val) {
    await saveLevelConfig({ [key]: Number(val) });
  };

  // === INITIAL TOGGLES ===
  setToggle('toggle-levels', levelConfig.enabled !== false);
  setToggle('toggle-text-enabled', levelConfig.textEnabled !== false);
  setToggle('toggle-voice-enabled', levelConfig.voiceEnabled !== false);
  setToggle('toggle-dm-levelup', !!levelConfig.dmLevelUp);
  setToggle('toggle-stack-roles', levelConfig.stackRoles !== false);
  document.getElementById('level-text-mult').value = levelConfig.textMultiplier ?? 1;
  document.getElementById('level-voice-mult').value = levelConfig.voiceMultiplier ?? 1;

  // === GENERIC ACTION HELPER ===
  async function levelAction(endpoint, payload) {
    const r = await api('/api/data/' + endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, ...payload }),
    });
    if (r.ok) { showSaved(); await refresh(); } else toast(r.error || 'Failed.', 'error');
  }

  // === ROLE REWARDS ===
  function renderRoleRewards() {
    const el = document.getElementById('level-role-rewards');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <input type="number" class="input" id="rr-level" placeholder="Level" min="1" style="width:90px" data-tooltip="Level that grants the selected role.">
        <select class="input" id="rr-role" style="width:220px" data-tooltip="Role granted when this level is reached.">${roleOptions(null, 'Select role...')}</select>
        <button class="btn btn-secondary btn-sm" id="rr-add" data-tooltip="Add this level-to-role reward.">Add Reward</button>
      </div>
      ${!roleRewards.length ? '<div class="inline-empty">No role rewards configured. Members earn these roles automatically at the levels below.</div>' : ''}
      ${roleRewards.slice().sort((a, b) => a.level - b.level).map(rr => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
            <strong style="min-width:80px">Level ${rr.level}</strong>
            <span>${esc(targetLabel('role', rr.roleId))}</span>
            <button class="btn btn-sm btn-ghost del-btn" data-rr-remove="${rr.level}" style="margin-left:auto" data-tooltip="Remove this role reward.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#rr-add').onclick = () => {
      const level = parseInt(el.querySelector('#rr-level').value, 10);
      const roleId = el.querySelector('#rr-role').value;
      if (!level || level < 1) { toast('Enter a level.', 'error'); return; }
      if (!roleId) { toast('Select a role.', 'error'); return; }
      levelAction('guild-levels-role-rewards', { action: 'add', level, roleId });
    };
    el.querySelectorAll('[data-rr-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Reward', `Remove the level <strong>${this.dataset.rrRemove}</strong> role reward?`))) return;
        levelAction('guild-levels-role-rewards', { action: 'remove', level: Number(this.dataset.rrRemove) });
      };
    });
  }

  // === MULTIPLIERS ===
  function renderMultipliers() {
    const el = document.getElementById('level-multipliers');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <select class="input" id="lm-type" style="width:110px" data-tooltip="Choose whether this XP multiplier applies to a role or a channel.">
          <option value="role">Role</option>
          <option value="channel">Channel</option>
        </select>
        <select class="input" id="lm-role" style="width:200px" data-tooltip="Role whose members receive this XP multiplier.">${roleOptions(null, 'Select role...')}</select>
        <select class="input" id="lm-channel" style="width:200px;display:none" data-tooltip="Channel where this XP multiplier applies.">${channelOptions(null, 'Select channel...')}</select>
        <input type="number" class="input" id="lm-mult" placeholder="Multiplier" min="0" step="0.1" style="width:110px" data-tooltip="Factor applied to XP; 2 grants double XP.">
        <button class="btn btn-secondary btn-sm" id="lm-add" data-tooltip="Add this XP multiplier.">Add Multiplier</button>
      </div>
      ${!multipliers.length ? '<div class="inline-empty">No XP multipliers configured. Add roles or channels to boost XP gain.</div>' : ''}
      ${multipliers.map(m => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
            <strong>${esc(targetLabel(m.targetType, m.targetId))}</strong>
            <span class="badge badge-blue">${m.multiplier}x XP</span>
            <button class="btn btn-sm btn-ghost del-btn" data-lm-remove="${esc(m.targetId)}" data-lm-type="${esc(m.targetType)}" style="margin-left:auto" data-tooltip="Remove this XP multiplier.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#lm-type').onchange = function () {
      const isChannel = this.value === 'channel';
      el.querySelector('#lm-role').style.display = isChannel ? 'none' : '';
      el.querySelector('#lm-channel').style.display = isChannel ? '' : 'none';
    };
    el.querySelector('#lm-add').onclick = () => {
      const type = el.querySelector('#lm-type').value;
      const targetId = type === 'channel' ? el.querySelector('#lm-channel').value : el.querySelector('#lm-role').value;
      const multiplier = parseFloat(el.querySelector('#lm-mult').value);
      if (!targetId) { toast('Select a target.', 'error'); return; }
      if (!Number.isFinite(multiplier) || multiplier <= 0) { toast('Enter a valid multiplier.', 'error'); return; }
      levelAction('guild-levels-multiplier', { action: 'add', targetId, targetType: type, multiplier });
    };
    el.querySelectorAll('[data-lm-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Multiplier', `Remove the XP multiplier for <strong>${esc(targetLabel(this.dataset.lmType, this.dataset.lmRemove))}</strong>?`))) return;
        levelAction('guild-levels-multiplier', { action: 'remove', targetId: this.dataset.lmRemove, targetType: this.dataset.lmType });
      };
    });
  }

  // === IGNORES ===
  function renderIgnores() {
    const el = document.getElementById('level-ignores');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <select class="input" id="li-type" style="width:110px" data-tooltip="Choose whether to ignore a channel or a role.">
          <option value="channel">Channel</option>
          <option value="role">Role</option>
        </select>
        <select class="input" id="li-channel" style="width:220px" data-tooltip="Channel that should not earn XP.">${channelOptions(null, 'Select channel...')}</select>
        <select class="input" id="li-role" style="width:220px;display:none" data-tooltip="Role whose members should not earn XP.">${roleOptions(null, 'Select role...')}</select>
        <button class="btn btn-secondary btn-sm" id="li-add" data-tooltip="Exclude this target from earning XP.">Add Ignore</button>
      </div>
      ${!ignores.length ? '<div class="inline-empty">No ignored channels or roles. Ignored targets do not earn XP.</div>' : ''}
      ${ignores.map(ig => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
            <strong>${esc(targetLabel(ig.targetType, ig.targetId))}</strong>
            <button class="btn btn-sm btn-ghost del-btn" data-li-remove="${esc(ig.targetId)}" data-li-type="${esc(ig.targetType)}" style="margin-left:auto" data-tooltip="Stop ignoring this target.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#li-type').onchange = function () {
      const isRole = this.value === 'role';
      el.querySelector('#li-role').style.display = isRole ? '' : 'none';
      el.querySelector('#li-channel').style.display = isRole ? 'none' : '';
    };
    el.querySelector('#li-add').onclick = () => {
      const type = el.querySelector('#li-type').value;
      const targetId = type === 'role' ? el.querySelector('#li-role').value : el.querySelector('#li-channel').value;
      if (!targetId) { toast('Select a target.', 'error'); return; }
      levelAction('guild-levels-ignore', { action: 'add', targetId, targetType: type });
    };
    el.querySelectorAll('[data-li-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Ignore', `Stop ignoring <strong>${esc(targetLabel(this.dataset.liType, this.dataset.liRemove))}</strong>?`))) return;
        levelAction('guild-levels-ignore', { action: 'remove', targetId: this.dataset.liRemove, targetType: this.dataset.liType });
      };
    });
  }

  // === MILESTONES ===
  function renderMilestones() {
    const el = document.getElementById('level-milestones');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap">
        <input type="number" class="input" id="ms-level" placeholder="Level" min="1" style="width:90px" data-tooltip="Level that triggers this one-time milestone.">
        <input type="number" class="input" id="ms-coins" placeholder="Coins" min="0" style="width:90px" data-tooltip="Coins granted once when the milestone level is reached.">
        <select class="input" id="ms-role" style="width:220px" data-tooltip="Optional role granted once when the milestone is reached.">${roleOptions(null, 'Role (optional)')}</select>
        <button class="btn btn-secondary btn-sm" id="ms-add" data-tooltip="Add this one-time milestone reward.">Add Milestone</button>
      </div>
      ${!milestones.length ? '<div class="inline-empty">No milestones configured. Milestones grant bonus coins or roles at set levels.</div>' : ''}
      ${milestones.slice().sort((a, b) => a.level - b.level).map(m => `
        <div class="item">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
            <strong style="min-width:80px">Level ${m.level}</strong>
            ${m.coins ? `<span class="badge badge-yellow">${m.coins} coins</span>` : ''}
            ${m.roleId ? `<span>${esc(targetLabel('role', m.roleId))}</span>` : ''}
            <button class="btn btn-sm btn-ghost del-btn" data-ms-remove="${m.level}" style="margin-left:auto" data-tooltip="Remove this milestone.">Remove</button>
          </div>
        </div>`).join('')}`;

    el.querySelector('#ms-add').onclick = () => {
      const level = parseInt(el.querySelector('#ms-level').value, 10);
      if (!level || level < 1) { toast('Enter a level.', 'error'); return; }
      const coins = parseInt(el.querySelector('#ms-coins').value, 10) || 0;
      const roleId = el.querySelector('#ms-role').value || null;
      levelAction('guild-levels-milestones', { action: 'add', level, coins, roleId });
    };
    el.querySelectorAll('[data-ms-remove]').forEach(btn => {
      btn.onclick = async function () {
        if (!(await confirmAsync('Remove Milestone', `Remove the milestone at level <strong>${this.dataset.msRemove}</strong>?`))) return;
        levelAction('guild-levels-milestones', { action: 'remove', level: Number(this.dataset.msRemove) });
      };
    });
  }

  async function refresh() {
    if (!(await loadAll())) return;
    renderRoleRewards();
    renderMultipliers();
    renderIgnores();
    renderMilestones();
  }

  renderRoleRewards();
  renderMultipliers();
  renderIgnores();
  renderMilestones();
}
