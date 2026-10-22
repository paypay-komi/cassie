export async function init(ctx) {
  const { guildId, api, esc, toast, confirmAsync } = ctx;

  const [echoRes, tgtRes] = await Promise.all([
    api(`/api/data/guild-echo-chamber?guildId=${guildId}`),
    api(`/api/data/guild-targets?guildId=${guildId}`),
  ]);

  const el = document.getElementById('echo-content');
  if (!el) return;

  const channels = tgtRes.ok ? (tgtRes.channels || []) : [];
  const existing = (echoRes.ok ? echoRes.channels : []) || [];
  const existingIds = new Set(existing.map(c => c.channelId));

  const emptyIcon = `<div class="empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg></div>`;

  let html = `<div class="echo-create">
    <div class="echo-create-row">
      <select id="echo-channel-pick" aria-label="Channel for new echo chamber" data-tooltip="Text channel to convert into an echo chamber.">
        <option value="">Select a text channel...</option>
        ${channels.filter(ch => !existingIds.has(ch.id)).map(ch => `<option value="${esc(ch.id)}">${esc(ch.name)}</option>`).join('')}
      </select>
      <button class="btn btn-primary" id="echo-create-btn" data-tooltip="Create an echo chamber for the selected channel.">Create</button>
    </div>
  </div>`;

  if (existing.length === 0 && channels.length === 0) {
    html += `<div class="empty-state">${emptyIcon}<div class="empty-title">No text channels available</div><div class="empty-desc">Make sure the bot has access to this server.</div></div>`;
  } else if (existing.length === 0) {
    html += `<div class="empty-state">${emptyIcon}<div class="empty-title">No echo chambers yet</div><div class="empty-desc">Pick a channel above to create one. Messages in echo chambers are randomly deleted and reposted via webhook.</div></div>`;
  } else {
    for (const ch of existing) {
      const chName = channels.find(c => c.id === ch.channelId)?.name || ch.channelId;
      html += `
        <div class="echo-card" data-channel="${esc(ch.channelId)}">
          <div class="echo-header">
            <span class="echo-channel-id">#${esc(chName)}</span>
            <div style="display:flex;align-items:center;gap:var(--sp-3)">
              <span class="echo-pending" tabindex="0" data-tooltip="Messages waiting to be randomly reposted.">${ch.pendingCount} pending</span>
              <button class="btn btn-sm btn-danger" data-echo-remove="${esc(ch.channelId)}" data-echo-name="${esc(chName)}" data-tooltip="Remove this chamber, delete its webhook, and clear all pending messages.">Remove</button>
            </div>
          </div>
          <div class="echo-settings">
            <div class="echo-row">
              <label>Echo Chance</label>
              <div class="echo-input-group">
                <input type="number" class="echo-input" data-field="echoChance" value="${ch.echoChance}" min="0" max="100" aria-label="Echo chance percent" data-tooltip="Percent chance a new message is randomly selected for reposting.">
                <span class="echo-unit">%</span>
              </div>
            </div>
            <div class="echo-row">
              <label>Delete Delay (min)</label>
              <div class="echo-input-group">
                <input type="number" class="echo-input" data-field="deleteDelayMin" value="${ch.deleteDelayMin}" min="0" step="1000" aria-label="Minimum delete delay in milliseconds" data-tooltip="Minimum delay before the original message is deleted.">
                <span class="echo-unit">ms</span>
              </div>
            </div>
            <div class="echo-row">
              <label>Delete Delay (max)</label>
              <div class="echo-input-group">
                <input type="number" class="echo-input" data-field="deleteDelayMax" value="${ch.deleteDelayMax}" min="0" step="1000" aria-label="Maximum delete delay in milliseconds" data-tooltip="Maximum delay before the original message is deleted.">
                <span class="echo-unit">ms</span>
              </div>
            </div>
            <div class="echo-row">
              <label>Echo Delay (min)</label>
              <div class="echo-input-group">
                <input type="number" class="echo-input" data-field="echoDelayMin" value="${ch.echoDelayMin}" min="0" step="1000" aria-label="Minimum echo delay in milliseconds" data-tooltip="Minimum delay after deletion before the message is reposted.">
                <span class="echo-unit">ms</span>
              </div>
            </div>
            <div class="echo-row">
              <label>Echo Delay (max)</label>
              <div class="echo-input-group">
                <input type="number" class="echo-input" data-field="echoDelayMax" value="${ch.echoDelayMax}" min="0" step="1000" aria-label="Maximum echo delay in milliseconds" data-tooltip="Maximum delay after deletion before the message is reposted.">
                <span class="echo-unit">ms</span>
              </div>
            </div>
          </div>
          <div class="echo-footer">
            <button class="btn btn-sm btn-primary" data-echo-save="${esc(ch.channelId)}" data-tooltip="Save this chamber's settings.">Save</button>
            <span class="save-indicator" id="echo-saved-${esc(ch.channelId)}">Saved</span>
          </div>
        </div>`;
    }
  }

  el.innerHTML = html;

  async function reload() {
    const mod = await import('/dashboard/echochambers.js');
    if (mod.init) await mod.init(ctx);
  }

  const createBtn = el.querySelector('#echo-create-btn');
  createBtn.addEventListener('click', async () => {
    const channelId = el.querySelector('#echo-channel-pick').value;
    if (!channelId) { toast('Select a channel first.', 'error'); return; }

    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    const res = await api('/api/data/guild-echo-chamber-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, channelId }),
    });

    if (res.ok) {
      toast('Echo chamber created.', 'success');
      await reload();
    } else {
      toast(res.error || 'Failed to create echo chamber.', 'error');
      createBtn.disabled = false;
      createBtn.textContent = 'Create';
    }
  });

  el.querySelectorAll('[data-echo-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const channelId = btn.dataset.echoRemove;
      const channelName = btn.dataset.echoName;
      if (!(await confirmAsync('Remove Echo Chamber', `Remove echo chamber from <strong>#${esc(channelName)}</strong>?<br><br>This will delete the webhook and all pending messages.`))) return;

      const res = await api('/api/data/guild-echo-chamber-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, channelId }),
      });

      if (res.ok) {
        toast('Echo chamber removed.', 'success');
        await reload();
      } else {
        toast(res.error || 'Failed to remove echo chamber.', 'error');
      }
    });
  });

  el.querySelectorAll('[data-echo-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const channelId = btn.dataset.echoSave;
      const card = el.querySelector(`.echo-card[data-channel="${channelId}"]`);
      const settings = {};
      card.querySelectorAll('.echo-input').forEach(input => {
        settings[input.dataset.field] = Number(input.value);
      });

      const res = await api('/api/data/guild-echo-chamber-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, channelId, settings }),
      });

      if (res.ok) {
        const indicator = document.getElementById(`echo-saved-${channelId}`);
        if (indicator) {
          indicator.classList.add('show');
          setTimeout(() => indicator.classList.remove('show'), 2000);
        }
      } else {
        toast(res.error || 'Failed to save settings.', 'error');
      }
    });
  });
}
