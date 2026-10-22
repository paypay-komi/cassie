export async function init(ctx) {
  const { guildId, api, esc, showMsg, toast, confirmAsync } = ctx;

  const ovTableWrap = document.getElementById('ov-table-wrap');
  const ovSearch = document.getElementById('ov-search');

  let targetData = { channels: [], roles: [], members: [] };
  let _ovDisabledSet = new Set();
  let _ovCmdNames = {};
  let _ovCmdParent = {};
  let _ovChildrenMap = {};
  let _memberSearchTimeout = null;

  function _fullCmdName(id) {
    const parts = [];
    let cur = id;
    while (cur && _ovCmdNames[cur]) {
      parts.unshift(_ovCmdNames[cur]);
      cur = _ovCmdParent[cur];
    }
    return parts.join(' ');
  }

  function getTargetName(type, id) {
    const arr = type === 'channel' ? targetData.channels
      : type === 'role' ? targetData.roles
      : targetData.members;
    const found = arr.find(t => t.id === id);
    if (!found) return null;
    if (type === 'user') {
      return found.displayName && found.displayName !== found.username
        ? `${found.username} (${found.displayName})`
        : found.username;
    }
    return found.name;
  }

  // Fetch overrides, commands, and target data in parallel
  const [ovData, cmdData, tgtData] = await Promise.all([
    api(`/api/data/guild-overrides-list?guildId=${guildId}`),
    api(`/api/data/guild-commands?guildId=${guildId}`),
    api(`/api/data/guild-targets?guildId=${guildId}`),
  ]);

  if (!ovData.ok) { showMsg('Failed to load overrides.'); return; }

  // Cache target data for autocomplete
  if (tgtData.ok) targetData = tgtData;

  // Build command lookups
  _ovCmdNames = {};
  _ovCmdParent = {};
  _ovDisabledSet = new Set();
  _ovChildrenMap = {};
  if (cmdData.ok) {
    for (const cmd of cmdData.commands) {
      _ovCmdNames[cmd.id] = cmd.name;
      if (cmd.disabled) _ovDisabledSet.add(cmd.id);
      if (cmd.parentId) {
        _ovCmdParent[cmd.id] = cmd.parentId;
        if (!_ovChildrenMap[cmd.parentId]) _ovChildrenMap[cmd.parentId] = [];
        _ovChildrenMap[cmd.parentId].push(cmd.id);
      }
    }
  }

  // Build command options with hierarchy for custom select
  if (cmdData.ok) {
    const sorted = [...cmdData.commands].sort((a, b) =>
      _fullCmdName(a.id).localeCompare(_fullCmdName(b.id)),
    );
    const listEl = document.getElementById('ov-cmd-list');
    listEl.innerHTML = '<div class="custom-select-item" data-value="">Select command...</div>';
    for (const cmd of sorted) {
      listEl.innerHTML += `<div class="custom-select-item" data-value="${cmd.id}">${esc(_fullCmdName(cmd.id))}</div>`;
    }
  }

  // Custom select: Target Type
  const typeBtn = document.getElementById('ov-type-btn');
  const typeList = document.getElementById('ov-type-list');
  const typeHidden = document.getElementById('ov-type');
  typeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    typeList.style.display = typeList.style.display === 'block' ? 'none' : 'block';
    typeBtn.classList.toggle('open');
  });
  typeList.querySelectorAll('.custom-select-item').forEach(item => {
    item.addEventListener('click', () => {
      const val = item.dataset.value;
      typeHidden.value = val;
      typeBtn.dataset.value = val;
      typeBtn.querySelector('.custom-select-text').textContent = item.textContent;
      typeList.style.display = 'none';
      typeBtn.classList.remove('open');
      window._onOvTypeChange();
    });
  });

  // Custom select: Command
  const cmdBtn = document.getElementById('ov-cmd-btn');
  const cmdList = document.getElementById('ov-cmd-list');
  const cmdHidden = document.getElementById('ov-cmd');
  cmdBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cmdList.style.display = cmdList.style.display === 'block' ? 'none' : 'block';
    cmdBtn.classList.toggle('open');
  });
  cmdList.addEventListener('click', (e) => {
    const item = e.target.closest('.custom-select-item');
    if (!item) return;
    const val = item.dataset.value;
    cmdHidden.value = val;
    cmdBtn.dataset.value = val;
    cmdBtn.querySelector('.custom-select-text').textContent = item.textContent;
    cmdList.style.display = 'none';
    cmdBtn.classList.remove('open');
    window._onOvCmdChange();
  });

  // Close custom selects on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrap')) {
      document.querySelectorAll('.custom-select-list').forEach(l => l.style.display = 'none');
      document.querySelectorAll('.custom-select').forEach(b => b.classList.remove('open'));
    }
  });

  // Command change handler
  window._onOvCmdChange = function() {
    const badge = document.getElementById('ov-cmd-badge');
    const cmdId = document.getElementById('ov-cmd').value;
    if (!cmdId) {
      badge.innerHTML = '';
      document.getElementById('ov-include-subs-hint').style.display = 'none';
      return;
    }
    const disabled = _ovDisabledSet.has(cmdId);
    badge.innerHTML = `<span class="badge ${disabled ? 'badge-red' : 'badge-green'}">${disabled ? 'Disabled' : 'Enabled'}</span>`;
    const hasChildren = _ovChildrenMap[cmdId] && _ovChildrenMap[cmdId].length > 0;
    document.getElementById('ov-include-subs-hint').style.display = hasChildren ? '' : 'none';
  };

  // Type change handler
  window._onOvTypeChange = function() {
    if (_memberSearchTimeout) { clearTimeout(_memberSearchTimeout); _memberSearchTimeout = null; }
    document.getElementById('ov-target-input').value = '';
    document.getElementById('ov-target').value = '';
    document.getElementById('ov-target-list').style.display = 'none';
  };

  // Target input handler
  window._onOvTargetInput = function() {
    const type = document.getElementById('ov-type').value;
    const q = document.getElementById('ov-target-input').value.toLowerCase().trim();
    const list = document.getElementById('ov-target-list');

    document.getElementById('ov-target').value = '';

    if (_memberSearchTimeout) { clearTimeout(_memberSearchTimeout); _memberSearchTimeout = null; }

    // User search uses the server-side API
    if (type === 'user') {
      if (q.length < 2) { list.style.display = 'none'; return; }
      list.innerHTML = '<div class="ac-item" style="color:var(--text-2);cursor:default">Searching...</div>';
      list.style.display = 'block';
      _memberSearchTimeout = setTimeout(async () => {
        const data = await api(`/api/data/guild-member-search?guildId=${guildId}&q=${encodeURIComponent(q)}`);
        if (!data.ok || !data.members || data.members.length === 0) {
          list.innerHTML = '<div class="ac-item" style="color:var(--text-2);cursor:default">No users found</div>';
          list.style.display = q.length >= 2 ? 'block' : 'none';
          return;
        }
        let html = '';
        for (const m of data.members.slice(0, 50)) {
          const label = m.displayName && m.displayName !== m.username
            ? `${m.username} (${m.displayName})`
            : m.username;
          html += `<div class="ac-item" data-id="${esc(m.id)}" data-label="${esc(label)}">
            ${esc(label)}
            <span class="ac-id">${esc(m.id)}</span>
          </div>`;
        }
        list.innerHTML = html;
        list.style.display = 'block';
      }, 300);
      return;
    }

    // Channels and roles — filter from cached data
    const items = type === 'channel' ? (targetData.channels || []) : (targetData.roles || []);
    if (!q || items.length === 0) { list.style.display = 'none'; return; }

    const filtered = items
      .map(item => {
        const label = item.name;
        const idx = label.toLowerCase().indexOf(q);
        const idIdx = item.id.startsWith(q) ? 0 : -1;
        return { item, label, score: idIdx === 0 ? 0 : (idx >= 0 ? idx : 999) };
      })
      .filter(x => x.score < 999)
      .sort((a, b) => a.score - b.score);

    if (filtered.length === 0) { list.style.display = 'none'; return; }

    let html = '';
    for (const { item, label } of filtered.slice(0, 50)) {
      const color = type === 'role' && item.color && item.color !== '#000000'
        ? `<span class="role-color" style="color:${item.color}">&#9679;</span>`
        : '';
      html += `<div class="ac-item" data-id="${esc(item.id)}" data-label="${esc(label)}">
        ${color}${esc(label)}
        <span class="ac-id">${esc(item.id)}</span>
      </div>`;
    }
    list.innerHTML = html;
    list.style.display = 'block';
  };

  // Target selection - event delegation
  document.addEventListener('click', function(e) {
    const item = e.target.closest('.ac-item');
    if (item && item.dataset.id) {
      document.getElementById('ov-target-input').value = item.dataset.label || item.textContent.trim();
      document.getElementById('ov-target').value = item.dataset.id;
      document.getElementById('ov-target-list').style.display = 'none';
    }
    const list = document.getElementById('ov-target-list');
    if (list && !e.target.closest('.autocomplete-wrap')) {
      list.style.display = 'none';
    }
  });

  // Collect descendants
  function _collectDescendants(cmdId, map) {
    const ids = [];
    const children = map[cmdId] || [];
    for (const childId of children) {
      ids.push(childId, ..._collectDescendants(childId, map));
    }
    return ids;
  }

  // Add override
  window._addOverride = async function() {
    const type = document.getElementById('ov-type').value;
    const targetId = document.getElementById('ov-target').value;
    const commandId = document.getElementById('ov-cmd').value;
    const allowed = document.getElementById('ov-allowed').checked;
    if (!targetId || !commandId) { toast('Select a target and command.', 'error'); return; }

    const ids = [commandId];
    const includeSubs = document.getElementById('ov-include-subs');
    if (includeSubs.checked && document.getElementById('ov-include-subs-hint').style.display !== 'none') {
      ids.push(..._collectDescendants(commandId, _ovChildrenMap));
    }

    const btn = document.querySelector('.add-override-form .btn');
    const origText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    const results = await Promise.all(ids.map(id =>
      api('/api/data/guild-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, type, targetId, commandId: id, allowed }),
      })
    ));

    btn.textContent = origText;
    btn.disabled = false;

    if (results.every(r => r.ok)) {
      toast('Override added', 'success');
      loadOverrides();
    } else {
      toast('Failed to add some overrides.', 'error');
    }
  };

  // Render existing overrides table
  function loadOverrides() {
    api(`/api/data/guild-overrides-list?guildId=${guildId}`).then(ovData => {
      if (!ovData.ok) return;
      renderTable(ovData);
    });
  }

  function renderTable(ovData) {
    const sections = [
      { label: 'Channel', key: 'channels', idKey: 'channelId', type: 'channel' },
      { label: 'Role', key: 'roles', idKey: 'roleId', type: 'role' },
      { label: 'User', key: 'users', idKey: 'userId', type: 'user' },
    ];

    const allOverrides = [];
    for (const sec of sections) {
      for (const ov of ovData[sec.key] || []) {
        allOverrides.push({ type: sec.type, label: sec.label, targetId: ov[sec.idKey], commandId: ov.commandId, allowed: ov.allowed });
      }
    }

    if (allOverrides.length === 0) {
      ovTableWrap.innerHTML = '<div class="card"><div class="empty-state compact"><div class="empty-title">No overrides configured</div><div class="empty-desc">Add your first override using the form above.</div></div></div>';
      return;
    }

    // Group by (type, target)
    const groups = {};
    for (const ov of allOverrides) {
      const key = `${ov.type}:${ov.targetId}`;
      if (!groups[key]) groups[key] = { type: ov.type, label: ov.label, targetId: ov.targetId, overrides: [] };
      groups[key].overrides.push(ov);
    }

    let html = '<div class="table-wrap"><table class="override-table"><thead><tr><th>Type</th><th>Target</th><th>Command</th><th>Access</th><th style="width:40px"></th></tr></thead><tbody>';
    let groupIdx = 0;

    for (const key in groups) {
      const group = groups[key];
      const tgtName = getTargetName(group.type, group.targetId);
      const tgtHtml = tgtName
        ? `<div class="ov-target-name">${esc(tgtName)}</div><div class="ov-target-id">${esc(group.targetId)}</div>`
        : `<span class="ov-target-id">${esc(group.targetId)}</span>`;

      const cmdIds = new Set(group.overrides.map(o => o.commandId));
      const roots = group.overrides.filter(o => {
        const parentId = _ovCmdParent[o.commandId];
        return !parentId || !cmdIds.has(parentId);
      });
      roots.sort((a, b) => _fullCmdName(a.commandId).localeCompare(_fullCmdName(b.commandId)));

      function flattenChildren(parentOv, depth, ancestorPrefix) {
        const rows = [];
        const children = group.overrides
          .filter(o => _ovCmdParent[o.commandId] === parentOv.commandId)
          .sort((a, b) => _fullCmdName(a.commandId).localeCompare(_fullCmdName(b.commandId)));
        for (let i = 0; i < children.length; i++) {
          const isLast = i === children.length - 1;
          const connector = isLast ? '└ ' : '├ ';
          const prefix = ancestorPrefix + connector;
          rows.push({ ov: children[i], depth: depth + 1, prefix });
          const childPrefix = ancestorPrefix + (isLast ? '   ' : '│  ');
          rows.push(...flattenChildren(children[i], depth + 1, childPrefix));
        }
        return rows;
      }

      const treeRows = [];
      for (const root of roots) {
        treeRows.push({ ov: root, depth: 0, prefix: '' });
        treeRows.push(...flattenChildren(root, 0, ''));
      }

      const bgColor = groupIdx % 2 === 0 ? '' : 'style="background:rgba(255,255,255,0.02)"';
      groupIdx++;

      for (const { ov, depth, prefix } of treeRows) {
        const name = _fullCmdName(ov.commandId) || ov.commandId.slice(0, 8) + '...';
        const indent = depth > 0 ? `<span class="tree-prefix">${esc(prefix)}</span>` : '';
        const badgeClass = ov.allowed ? 'badge-green' : 'badge-red';
        const accessText = ov.allowed ? 'Allow' : 'Deny';
        html += `<tr data-type="${ov.type}" data-target="${ov.targetId}" data-command="${ov.commandId}" ${bgColor}>
          <td><span class="type-badge">${group.label}</span></td>
          <td>${tgtHtml}</td>
          <td style="font-size:var(--text-sm)">${indent}${esc(name)}</td>
          <td><span class="badge ${badgeClass}">${accessText}</span></td>
          <td><button class="btn btn-sm btn-ghost del-btn" aria-label="Delete override" data-tooltip="Delete this override. Alt+click to skip confirmation." onclick="window._deleteOverride(event,'${ov.type}','${ov.targetId}','${ov.commandId}')">&#10005;</button></td>
        </tr>`;
      }
    }
    html += '</tbody></table></div>';
    ovTableWrap.innerHTML = html;
  }

  // Delete override
  window._deleteOverride = async function(ev, type, targetId, commandId) {
    const skipConfirm = ev.altKey;
    const childIds = _collectDescendants(commandId, _ovChildrenMap);
    const childRows = [];
    if (childIds.length > 0) {
      const table = ovTableWrap.querySelector('table');
      if (table) {
        for (const row of table.querySelectorAll('tbody tr')) {
          if (childIds.includes(row.dataset.command) && row.dataset.type === type && row.dataset.target === targetId) {
            childRows.push(row);
          }
        }
      }
    }

    const cmdLabel = _fullCmdName(commandId) || commandId.slice(0, 8);

    if (!skipConfirm) {
      if (!(await confirmAsync('Delete Override', `Remove override for <code style="background:var(--bg-0);padding:2px 6px;border-radius:var(--r-sm);font-size:var(--text-xs)">${esc(cmdLabel)}</code>?`, 'Alt+click to skip confirmations'))) return;
    }

    let deleteChildren = false;
    if (!skipConfirm && childRows.length > 0) {
      deleteChildren = await confirmAsync(
        'Subcommand Overrides',
        `Also delete <strong>${childRows.length}</strong> subcommand override${childRows.length > 1 ? 's' : ''} for this target?`,
        'Click No to keep subcommand overrides',
      );
    } else if (skipConfirm && childRows.length > 0) {
      deleteChildren = true;
    }

    const results = await Promise.all([
      api('/api/data/guild-overrides-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, type, targetId, commandId }),
      }),
      ...(deleteChildren ? childRows.map(row =>
        api('/api/data/guild-overrides-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, type, targetId, commandId: row.dataset.command }),
        })
      ) : []),
    ]);
    if (!results[0].ok) return;

    if (deleteChildren) childRows.forEach(r => r.remove());
    const mainRow = ev?.target?.closest?.('tr');
    if (mainRow) mainRow.remove();

    const tbody = ovTableWrap.querySelector('table tbody');
    if (tbody && !tbody.querySelector('tr')) {
      loadOverrides();
    }
  };

  // Search filter
  ovSearch.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    ovTableWrap.querySelectorAll('.override-table tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // Initial render
  renderTable(ovData);
}