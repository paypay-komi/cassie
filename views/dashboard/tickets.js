export async function init(ctx) {
  const { guildId, api, esc } = ctx;

  const panelsEl = document.getElementById('ticket-panels');

  const cfgRes = await api(`/api/data/guild-config-bulk?guildId=${guildId}`);

  if (!cfgRes.ok) {
    panelsEl.innerHTML = '<div class="msg msg-error" style="margin-top:var(--sp-3)">Failed to load ticket config.</div>';
    return;
  }

  const cfg = cfgRes.config || {};
  const panels = cfg.ticketPanels || [];

  if (!panels.length) {
    panelsEl.innerHTML = `<div class="card"><div class="empty-state compact">
      <div class="empty-title">No ticket panels yet</div>
      <div class="empty-desc">Use the ticket setup command in Discord to create your first panel.</div>
    </div></div>`;
    return;
  }

  const STYLE_NAMES = { 1: 'Primary', 2: 'Secondary', 3: 'Success', 4: 'Danger' };

  panelsEl.innerHTML = panels.map(panel => `
    <div class="feature-card">
      <div class="feature-header">
        <span class="feature-title">${esc(panel.name || 'Unnamed Panel')}</span>
      </div>
      <div class="feature-body">
        <div class="config-grid">
          <div class="config-item" tabindex="0" data-tooltip="Channel where this panel's ticket button message is posted.">
            <label>Channel</label>
            <span>${panel.channelId ? esc(panel.channelId) : 'Not posted'}</span>
          </div>
          <div class="config-item" tabindex="0" data-tooltip="Stored ticket-open mode for this panel: thread or channel.">
            <label>Mode</label>
            <span>${esc(panel.mode || 'thread')}</span>
          </div>
          <div class="config-item" tabindex="0" data-tooltip="Maximum open tickets per user recorded for this panel.">
            <label>Max Open</label>
            <span>${esc(String(panel.maxOpen ?? 1))}</span>
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
        <div class="form-hint" style="margin-top:var(--sp-4)">Use the ticket setup command in Discord to modify panels.</div>
      </div>
    </div>
  `).join('');
}
