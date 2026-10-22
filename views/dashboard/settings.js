export async function init(ctx) {
  const { guildId, api, esc, showMsg, toast } = ctx;

  const [statsData, echoData, announceData] = await Promise.all([
    api(`/api/data/guild-stats?guildId=${guildId}`),
    api(`/api/data/guild-echo-chamber?guildId=${guildId}`),
    api(`/api/data/guild-announcement?guildId=${guildId}`),
  ]);
  if (!statsData.ok) { showMsg('Failed to load settings.'); return; }

  const prefix = statsData.stats?.prefix || 'c.';
  const el = document.getElementById('settings-content');

  let echoHtml = '';
  if (echoData.ok && echoData.channels.length > 0) {
    echoHtml = echoData.channels.map(ch => {
      const d1 = (ch.deleteDelayMin / 1000).toFixed(0);
      const d2 = ch.deleteDelayMax >= 86400000 ? '24h' : (ch.deleteDelayMax / 1000).toFixed(0) + 's';
      const e1 = ch.echoDelayMin === 0 ? '0s' : (ch.echoDelayMin / 1000).toFixed(0) + 's';
      const e2 = ch.echoDelayMax >= 86400000 ? '24h' : (ch.echoDelayMax / 1000).toFixed(0) + 's';
      return `<div class="item">
        <div class="item-row" style="justify-content:space-between">
          <strong>#${esc(ch.channelId.slice(0, 8))}…</strong>
          <span class="badge badge-blue" tabindex="0" data-tooltip="Messages waiting to be randomly reposted.">${ch.pendingCount} pending</span>
        </div>
        <div style="display:flex;gap:var(--sp-4);flex-wrap:wrap;margin-top:4px;font-size:var(--text-xs);color:var(--text-2)">
          <span tabindex="0" data-tooltip="Chance each new message is randomly selected for reposting.">Echo chance <strong style="color:var(--text-1)">${ch.echoChance}%</strong></span>
          <span tabindex="0" data-tooltip="Time range before the original message is deleted.">Delete delay <strong style="color:var(--text-1)">${d1}s – ${d2}</strong></span>
          <span tabindex="0" data-tooltip="Time range before the copied message is reposted.">Echo delay <strong style="color:var(--text-1)">${e1} – ${e2}</strong></span>
        </div>
      </div>`;
    }).join('');
  } else {
    echoHtml = `<div class="empty-state compact">
      <div class="empty-title">No echo chambers</div>
      <div class="empty-desc">Use <code>${esc(prefix)}echochamber create</code> in a channel to set one up.</div>
    </div>`;
  }

  let announceHtml = '';
  if (announceData.ok) {
    if (announceData.subscribed) {
      announceHtml = `<div class="item-row" style="justify-content:space-between">
          <div>
            <div class="item-title">Subscribed</div>
            <div class="form-hint" style="margin-top:2px">Channel: <code>${esc(announceData.channelId)}</code></div>
          </div>
          <span class="badge badge-green" tabindex="0" data-tooltip="This server is subscribed to bot announcements.">Active</span>
        </div>`;
    } else if (announceData.optedOut) {
      announceHtml = `<div class="item-row" style="justify-content:space-between">
          <div class="item-title">Opted out</div>
          <span class="badge badge-yellow" tabindex="0" data-tooltip="This server has opted out of bot announcements.">Off</span>
        </div>`;
    } else {
      announceHtml = `<div class="empty-state compact">
        <div class="empty-title">Not set up</div>
        <div class="empty-desc">Run <code>${esc(prefix)}announce subscribe</code> in your announcement channel.</div>
      </div>`;
    }
    if (announceData.lastNagged) {
      const d = new Date(announceData.lastNagged);
      announceHtml += `<div class="form-hint" style="margin-top:var(--sp-3)">Last reminded ${d.toLocaleDateString()}</div>`;
    }
  } else {
    announceHtml = `<div class="inline-empty">Could not load announcement status.</div>`;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">General</div></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label" for="settings-prefix">Command Prefix</label>
          <div class="form-row" style="max-width:420px">
            <div class="form-group" style="flex:0 1 140px">
              <input type="text" class="input" id="settings-prefix" value="${esc(prefix)}" maxlength="10" data-tooltip="Prefix used for text commands in this server.">
            </div>
            <button class="btn btn-primary" id="settings-prefix-save" data-tooltip="Save the command prefix.">Save</button>
            <span class="save-indicator" id="settings-prefix-status">Saved</span>
          </div>
          <div class="form-hint">The prefix used to invoke Cassie commands in this server (default: <code>c.</code>).</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><div class="section-title">Echo Chambers</div></div>
      <div class="card"><div class="card-body">${echoHtml}</div></div>
    </div>

    <div class="section">
      <div class="section-header"><div class="section-title">Announcements</div></div>
      <div class="card"><div class="card-body">${announceHtml}</div></div>
    </div>`;

  let statusTimer = null;
  el.querySelector('#settings-prefix-save').addEventListener('click', async () => {
    const input = el.querySelector('#settings-prefix');
    const status = el.querySelector('#settings-prefix-status');
    const p = input.value.trim();
    if (!p) { toast('Enter a prefix.', 'error'); return; }
    const res = await api('/api/data/guild-settings-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, prefix: p }),
    });
    if (!res.ok) { toast(res.error || 'Failed to save prefix.', 'error'); return; }
    status.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => status.classList.remove('show'), 1500);
  });

  el.querySelector('#settings-prefix').addEventListener('keydown', e => {
    if (e.key === 'Enter') el.querySelector('#settings-prefix-save').click();
  });
}
