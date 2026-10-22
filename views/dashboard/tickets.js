export async function init(ctx) {
  const { guildId, api, esc, toast } = ctx;
  const panelsEl = document.getElementById('ticket-panels');
  const setupBtn = document.getElementById('ticket-setup-btn');
  const STYLE_NAMES = { 1: 'Primary', 2: 'Secondary', 3: 'Success', 4: 'Danger' };
  let channels = [];
  let roles = [];

  function channelLabel(channelId) {
    const channel = channels.find(item => item.id === channelId);
    return channel ? `#${channel.name}` : `#${channelId}`;
  }

  function roleLabel(roleId) {
    const role = roles.find(item => item.id === roleId);
    return role ? `@${role.name}` : `@${roleId}`;
  }

  async function load() {
    const [cfgRes, targetsRes] = await Promise.all([
      api(`/api/data/guild-config-bulk?guildId=${guildId}`),
      api(`/api/data/guild-targets?guildId=${guildId}`),
    ]);
    if (!cfgRes.ok) {
      panelsEl.innerHTML = '<div class="msg msg-error" style="margin-top:var(--sp-3)">Failed to load ticket config.</div>';
      return;
    }

    const cfg = cfgRes.config || {};
    const panels = cfg.ticketPanels || [];
    const targets = targetsRes.ok ? targetsRes : {};
    channels = targets.channels || [];
    roles = targets.roles || [];

    if (!panels.length) {
      panelsEl.innerHTML = `<div class="card"><div class="empty-state compact">
        <div class="empty-title">No ticket panels yet</div>
        <div class="empty-desc">Click Set Up Tickets to create the category, support role, panel channel, and panel message automatically.</div>
      </div></div>`;
      return;
    }

    panelsEl.innerHTML = panels.map(panel => {
      const supportRoles = [...new Set((panel.options || []).flatMap(opt => opt.supportRoles || []))];
      return `
        <div class="feature-card">
          <div class="feature-header">
            <span class="feature-title">${esc(panel.name || 'Unnamed Panel')}</span>
          </div>
          <div class="feature-body">
            <div class="config-grid">
              <div class="config-item" tabindex="0" data-tooltip="Channel where this panel's ticket button message is posted.">
                <label>Channel</label>
                <span>${panel.channelId ? esc(channelLabel(panel.channelId)) : 'Not posted'}</span>
              </div>
              <div class="config-item" tabindex="0" data-tooltip="Category where tickets opened from this panel are created.">
                <label>Category</label>
                <span>${panel.categoryId ? esc(channelLabel(panel.categoryId).replace(/^#/, '')) : 'Not set'}</span>
              </div>
              <div class="config-item" tabindex="0" data-tooltip="Stored ticket-open mode for this panel.">
                <label>Mode</label>
                <span>${esc(panel.mode || 'channel')}</span>
              </div>
              <div class="config-item" tabindex="0" data-tooltip="Maximum open tickets per user recorded for this panel.">
                <label>Max Open</label>
                <span>${esc(String(panel.maxOpen ?? 1))}</span>
              </div>
              <div class="config-item" tabindex="0" data-tooltip="Roles that can view and respond to tickets opened from this panel.">
                <label>Support Roles</label>
                <span>${supportRoles.length ? supportRoles.map(id => esc(roleLabel(id))).join(', ') : 'Not set'}</span>
              </div>
            </div>
            ${panel.options && panel.options.length ? `
              <div class="section-title" style="margin-top:var(--sp-4);font-size:var(--text-sm)">Options</div>
              <div class="pill-list" style="margin-top:var(--sp-2)">
                ${panel.options.map(opt => `
                  <span class="pill">${esc(opt.emoji || '')} ${esc(opt.label || opt.name || '?')} <span style="color:var(--text-2)">(${esc(STYLE_NAMES[opt.style] || 'Primary')})</span></span>
                `).join('')}
              </div>
            ` : ''}
            <div class="form-hint" style="margin-top:var(--sp-4)">Use <code>/tickets option</code> to add categories or <code>/tickets config</code> to change the panel settings.</div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (setupBtn) {
    setupBtn.onclick = async () => {
      setupBtn.disabled = true;
      setupBtn.textContent = 'Setting up...';
      try {
        const result = await api('/api/data/guild-tickets-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId }),
        });
        if (!result.ok) {
          toast(result.error || 'Ticket setup failed.', 'error');
          return;
        }
        toast('Ticket panel is ready.');
        await load();
      } catch (err) {
        toast('Ticket setup failed.', 'error');
      } finally {
        setupBtn.disabled = false;
        setupBtn.textContent = 'Set Up Tickets';
      }
    };
  }

  await load();
}
