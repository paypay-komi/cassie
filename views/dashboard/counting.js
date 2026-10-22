export async function init(ctx) {
  const { guildId, api, esc, showMsg, toast, confirmAsync } = ctx;

  const data = await api(`/api/data/guild-counting?guildId=${guildId}`);
  if (!data.ok) { showMsg('Failed to load counting config.'); return; }

  const config = data.config;
  const leaderboard = data.leaderboard || [];

  // Channel dropdown
  const channelsRes = await api(`/api/data/guild-targets?guildId=${guildId}`);
  const channels = (channelsRes.ok ? channelsRes.channels || [] : []).filter(c => c.type === 'text' || c.type === 0);
  const channelSelect = document.getElementById('counting-channel');
  channelSelect.innerHTML = '<option value="">Select a channel...</option>' +
    channels.map(c => `<option value="${esc(c.id)}"${config?.channelId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

  // Load config into UI
  if (config) {
    setToggle('counting-enabled', config.enabled);
    setToggle('counting-reset', config.resetOnFail);
    setToggle('counting-delete', config.deleteWrong);
    setToggle('counting-decimals', config.allowDecimals);
    setToggle('counting-math', config.allowMath);
    setToggle('counting-text', config.allowText);
    setToggle('counting-reactwrong', config.reactOnWrong);
    setToggle('counting-reactcorrect', config.reactOnCorrect);
    setToggle('counting-showfail', config.showOnFail);

    document.getElementById('counting-cooldown').value = config.cooldownMs || 0;
    document.getElementById('counting-failmsg-delete').value = config.failMsgDeleteSeconds || 0;

    document.getElementById('stat-current').textContent = config.currentCount;
    document.getElementById('stat-high').textContent = config.highScore;
    // Will be updated after user fetch
  } else {
    document.getElementById('stat-current').textContent = '0';
    document.getElementById('stat-high').textContent = '0';
    document.getElementById('stat-last').textContent = '—';
  }

  // Leaderboard
  const lbBody = document.getElementById('counting-leaderboard');
  if (leaderboard.length === 0) {
    lbBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-2);padding:var(--sp-6)">No scores yet</td></tr>';
  } else {
    // Fetch user info for display names
    const userIds = [...new Set([...leaderboard.map(s => s.userId), config.lastCounterId].filter(Boolean))];
    const userInfoRes = await api('/api/data/guild-users-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, userIds })
    });
    const userMap = userInfoRes.ok ? userInfoRes.users : {};
    
    // Update Last Counter stat
    if (config.lastCounterId) {
      const u = userMap[config.lastCounterId];
      const displayName = u?.member?.nickname || u?.globalName || u?.username;
      document.getElementById('stat-last').textContent = displayName ? `${displayName}` : `<@${config.lastCounterId}>`;
    }
    
    lbBody.innerHTML = leaderboard.map((s, i) => {
      const u = userMap[s.userId];
      const displayName = u?.member?.nickname || u?.globalName || u?.username || `<@${s.userId}>`;
      return `<tr><td>${i + 1}</td><td><a href="#" class="user-link" data-user-id="${s.userId}">${esc(displayName)}</a></td><td>${s.score}</td><td>${s.correct}</td><td>${s.wrong}</td></tr>`;
    }).join('');
    
    // Add click handlers for user links
    lbBody.querySelectorAll('.user-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        showProfileModal(link.dataset.userId, guildId);
      });
    });
  }

  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.disabled = String(!on);
    el.classList.toggle('on', on);
  }

  window._toggleSetting = async function(key, el) {
    const newVal = el.dataset.disabled === 'true';
    el.dataset.disabled = String(!newVal);
    el.classList.toggle('on', newVal);

    const res = await api('/api/data/guild-counting-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: { [key]: newVal } }),
    });
    if (!res.ok) {
      el.dataset.disabled = String(!newVal);
      el.classList.toggle('on', !!newVal);
      toast('Failed to update setting.', 'error');
    }
  };

  window._saveChannel = async function() {
    const channelId = document.getElementById('counting-channel').value || null;
    const res = await api('/api/data/guild-counting-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: { channelId } }),
    });
    if (!res.ok) {
      toast('Failed to set channel.', 'error');
      const sel = document.getElementById('counting-channel');
      sel.value = config?.channelId || '';
    } else if (res.config) {
      config.channelId = res.config.channelId;
    }
  };

  window._saveCooldown = async function() {
    const cooldown = parseInt(document.getElementById('counting-cooldown').value) || 0;
    const res = await api('/api/data/guild-counting-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: { cooldownMs: cooldown } }),
    });
    if (!res.ok) toast('Failed to save cooldown.', 'error');
  };

  window._saveFailMsgDelete = async function() {
    const secs = parseInt(document.getElementById('counting-failmsg-delete').value) || 0;
    const res = await api('/api/data/guild-counting-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, config: { failMsgDeleteSeconds: secs } }),
    });
    if (!res.ok) toast('Failed to save setting.', 'error');
  };

  window._resetCount = async function() {
    if (!(await confirmAsync('Reset Count', 'Reset the current count to 0? This cannot be undone.'))) return;
    const res = await api('/api/data/guild-counting-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId }),
    });
    if (res.ok) {
      document.getElementById('stat-current').textContent = '0';
      document.getElementById('stat-last').textContent = '—';
      toast('Count reset to 0', 'success');
    } else {
      toast('Failed to reset count.', 'error');
    }
  };
}
