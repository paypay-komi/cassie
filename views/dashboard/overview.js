const CHECKLIST_ITEMS = [
  { id: 'prefix', label: 'Set your server prefix', desc: 'Change from the default c. to something unique', check: s => s.prefix !== 'c.', action: 'Change prefix in the Overview section above' },
  { id: 'commands', label: 'Review command permissions', desc: 'Disable commands your server doesn\'t need', check: s => s.disabledCmdCount > 0, action: 'Go to Commands tab' },
  { id: 'overrides', label: 'Set up command overrides', desc: 'Allow or deny commands per channel, role, or user', check: s => s.overrideCount > 0, action: 'Go to Overrides tab' },
  { id: 'tags', label: 'Create your first tag', desc: 'Custom text responses your server can use', check: s => s.tagCount > 0, action: 'Go to Tags tab' },
  { id: 'echo', label: 'Set up an echo chamber', desc: 'Randomly repost messages for funny moments', check: s => s.echoChamberCount > 0, action: 'Go to Echo Chambers tab' },
];

function getChecklistState() {
  try {
    return JSON.parse(localStorage.getItem(`checklist_${guildId}`) || '{}');
  } catch { return {}; }
}

function saveChecklistState(state) {
  localStorage.setItem(`checklist_${guildId}`, JSON.stringify(state));
}

export async function init(ctx) {
  const { guildId: gId, api, esc, showMsg, toast, confirmAsync } = ctx;

  const data = await api(`/api/data/guild-stats?guildId=${gId}`);
  if (!data.ok) { showMsg('Failed to load stats.'); return; }
  const s = data.stats;

  // Guild name in header
  document.getElementById('overview-guild-name').textContent = s.guildName || 'Server Overview';
  document.getElementById('overview-guild-desc').textContent = `${s.memberCount.toLocaleString()} members · ${s.channelCount.toLocaleString()} channels · ${s.roleCount.toLocaleString()} roles`;
  if (s.guildIcon) {
    const icon = document.getElementById('overview-guild-icon');
    icon.src = s.guildIcon;
    icon.style.display = '';
  }

  // Stats
  const stats = [
    { label: 'Members', value: s.memberCount.toLocaleString(), tip: 'Total members in this server, including bots.' },
    { label: 'Channels', value: s.channelCount.toLocaleString(), tip: 'Channels Cassie can currently see in this server.' },
    { label: 'Commands Used', value: (s.totalCommands || 0).toLocaleString(), tip: 'Total command uses Cassie has recorded for this server.' },
    { label: 'Disabled', value: (s.disabledCmdCount || 0).toLocaleString(), tip: 'Commands disabled server-wide in the Commands tab.' },
    { label: 'Overrides', value: (s.overrideCount || 0).toLocaleString(), tip: 'Channel, role, and user command exceptions.' },
    { label: 'Tags', value: (s.tagCount || 0).toLocaleString(), tip: 'Reusable text responses saved for this server.' },
    { label: 'Echo Chambers', value: (s.echoChamberCount || 0).toLocaleString(), tip: 'Channels configured to randomly echo messages.' },
  ];
  document.getElementById('statGrid').innerHTML = stats.map(st =>
    `<div class="stat-card" tabindex="0" data-tooltip="${st.tip}"><div class="stat-value">${st.value}</div><div class="stat-label">${st.label}</div></div>`
  ).join('');

  // Checklist
  const state = getChecklistState();
  renderChecklist(s, state);

  // Prefix save
  document.getElementById('prefix-input').value = s.prefix || 'c.';
  window._savePrefix = async function() {
    const prefix = document.getElementById('prefix-input').value.trim();
    if (!prefix) return;
    const res = await api('/api/data/guild-settings-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId: gId, prefix }),
    });
    if (res.ok) {
      toast('Prefix saved!', 'success');
    } else {
      toast(res.error || 'Failed to save prefix.', 'error');
    }
  };
}

function renderChecklist(stats, state) {
  const el = document.getElementById('checklist');
  if (!el) return;

  let html = '';
  for (const item of CHECKLIST_ITEMS) {
    const isDone = state[item.id] === 'done';
    const isSkipped = state[item.id] === 'skipped';
    const autoDone = !isDone && !isSkipped && item.check(stats);
    const shownDone = isDone || autoDone;

    html += `<div class="checklist-item${shownDone || isSkipped ? ' done' : ''}" data-id="${item.id}">
      <button type="button" class="checklist-check" onclick="window._toggleCheck('${item.id}')" aria-label="${esc(item.label)}" aria-pressed="${shownDone ? 'true' : 'false'}" data-tooltip="Mark this setup step done or not done.">${shownDone ? '&#10003;' : ''}</button>
      <div class="checklist-body">
        <div class="checklist-text">${esc(item.label)}</div>
        <div class="checklist-meta">${isSkipped ? 'Skipped' : shownDone ? 'Done' : esc(item.desc)}</div>
      </div>
      <div class="checklist-actions">
        ${!shownDone && !isSkipped ? `<button class="btn btn-sm btn-secondary" onclick="window._doCheckAction('${item.id}')" data-tooltip="Open the tab where you can complete this step.">Do it</button>` : ''}
        ${!isSkipped && !shownDone ? `<button class="btn btn-sm btn-ghost" onclick="window._skipCheck('${item.id}')" data-tooltip="Hide this step from the checklist until you undo it.">Skip</button>` : ''}
        ${(isDone || isSkipped) && !autoDone ? `<button class="btn btn-sm btn-ghost" onclick="window._undoCheck('${item.id}')" data-tooltip="Restore this checklist step.">Undo</button>` : ''}
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

window._toggleCheck = function(id) {
  const state = getChecklistState();
  if (state[id] === 'done') {
    delete state[id];
  } else {
    state[id] = 'done';
  }
  saveChecklistState(state);
  refreshChecklist();
};

window._skipCheck = function(id) {
  const state = getChecklistState();
  state[id] = 'skipped';
  saveChecklistState(state);
  refreshChecklist();
};

window._undoCheck = function(id) {
  const state = getChecklistState();
  delete state[id];
  saveChecklistState(state);
  refreshChecklist();
};

window._skipAll = function() {
  const state = getChecklistState();
  for (const item of CHECKLIST_ITEMS) {
    if (!state[item.id]) state[item.id] = 'skipped';
  }
  saveChecklistState(state);
  refreshChecklist();
};

window._doCheckAction = function(id) {
  const tabMap = {
    prefix: 'overview',
    commands: 'commands',
    overrides: 'overrides',
    tags: 'tags',
    echo: 'echochambers',
  };
  const tab = tabMap[id];
  if (tab && typeof switchTab === 'function') switchTab(tab);
};

function refreshChecklist() {
  const state = getChecklistState();
  // Re-fetch stats to check auto-done items
  api(`/api/data/guild-stats?guildId=${guildId}`).then(data => {
    if (data.ok) renderChecklist(data.stats, state);
  });
}
