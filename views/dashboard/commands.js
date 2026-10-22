export async function init(ctx) {
  const { guildId, api, esc, showMsg, toast } = ctx;

  const data = await api(`/api/data/guild-commands?guildId=${guildId}`);
  if (!data.ok) { showMsg('Failed to load commands.'); return; }

  const cmdList = document.getElementById('cmd-list');

  // Build parent → children map
  const childrenByParent = {};
  const cmdById = {};
  for (const cmd of data.commands) {
    const pid = cmd.parentId || '__root__';
    if (!childrenByParent[pid]) childrenByParent[pid] = [];
    childrenByParent[pid].push(cmd);
    cmdById[cmd.id] = cmd;
  }

  // Sort children alphabetically
  for (const key in childrenByParent) {
    childrenByParent[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Render a command node and all its descendants recursively
  function renderNode(cmd, depth) {
    const hasChildren = childrenByParent[cmd.id] && childrenByParent[cmd.id].length > 0;
    const isDisabled = cmd.disabled;
    const indent = depth * 20;

    let html = `
      <div class="command-row${hasChildren ? ' has-children' : ''} ${isDisabled ? ' disabled' : ''}" data-id="${cmd.id}" data-name="${esc(cmd.name).toLowerCase()}" style="--depth:${indent}px">
        ${hasChildren ? `<button class="cmd-expand" aria-label="Toggle ${esc(cmd.name)} subcommands" data-tooltip="Show or hide this command's subcommands." data-expanded="true"></button>` : '<span class="cmd-tree-connector"></span>'}
        <span class="cmd-name${hasChildren ? ' is-parent' : ' is-child'}">${esc(cmd.name)}</span>
        <div class="toggle${isDisabled ? '' : ' on'}" data-id="${cmd.id}" data-disabled="${isDisabled}" onclick="window.toggleCmd(this, '${guildId}')" data-tooltip="Enable or disable ${esc(cmd.name)} for everyone in this server."></div>
      </div>`;

    if (hasChildren) {
      html += `<div class="cmd-children" style="display:block">`;
      for (const child of childrenByParent[cmd.id]) {
        html += renderNode(child, depth + 1);
      }
      html += '</div>';
    }
    return html;
  }

  let listHtml = '';
  const roots = childrenByParent['__root__'] || [];
  for (const root of roots) {
    listHtml += renderNode(root, 0);
  }

  if (!listHtml) {
    listHtml = '<div class="empty-state"><div class="empty-title">No commands found</div><div class="empty-desc">No commands match this filter. Try a different search or category.</div></div>';
  }

  cmdList.innerHTML = listHtml;

  // Expand/collapse handlers - use event delegation on the list
  cmdList.addEventListener('click', (e) => {
    const btn = e.target.closest('.cmd-expand');
    if (!btn) return;
    const row = btn.closest('.command-row');
    const children = row?.nextElementSibling;
    if (!children || !children.classList.contains('cmd-children')) return;
    const expanded = btn.dataset.expanded === 'true';
    btn.dataset.expanded = String(!expanded);
    children.style.display = expanded ? 'none' : 'block';
  });

  // Toggle handler
  window.toggleCmd = async function(el, gId) {
    const cmdId = el.dataset.id;
    const newDisabled = el.dataset.disabled !== 'true';

    // Optimistic toggle
    el.dataset.disabled = String(newDisabled);
    el.classList.toggle('on', !newDisabled);

    const res = await api('/api/data/guild-command-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId: gId, commandId: cmdId, disabled: newDisabled }),
    });

    // Always refetch to sync with server state
    const cmdData = await api(`/api/data/guild-commands?guildId=${gId}`);
    if (cmdData.ok) {
      const disabledMap = {};
      for (const cmd of cmdData.commands) {
        disabledMap[cmd.id] = cmd.disabled;
      }
      document.querySelectorAll('.toggle').forEach(t => {
        const id = t.dataset.id;
        if (disabledMap[id] !== undefined) {
          const isDisabled = disabledMap[id];
          t.dataset.disabled = String(isDisabled);
          t.classList.toggle('on', !isDisabled);
        }
      });
    } else if (!res.ok) {
      // Revert on failure
      el.dataset.disabled = String(!newDisabled);
      el.classList.toggle('on', newDisabled);
      toast('Failed to update command.', 'error');
    }
  };

  // Search filter
  const searchInput = document.getElementById('cmd-search');
  searchInput.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    const rows = cmdList.querySelectorAll('.command-row');

    if (!q) {
      rows.forEach(r => { r.style.display = ''; r.classList.remove('search-match'); });
      cmdList.querySelectorAll('.cmd-children').forEach(c => c.style.display = 'block');
      return;
    }

    let anyVisible = false;
    rows.forEach(row => {
      const matches = row.dataset.name.includes(q);
      if (matches) {
        row.style.display = '';
        row.classList.add('search-match');
        anyVisible = true;
        // Ensure parent chain is visible
        let parent = row.parentElement;
        while (parent && parent !== cmdList) {
          if (parent.classList.contains('cmd-children')) {
            parent.style.display = 'block';
            const parentRow = parent.previousElementSibling;
            if (parentRow) parentRow.classList.add('search-match');
          }
          parent = parent.parentElement;
        }
      } else {
        row.style.display = 'none';
      }
    });

    // Hide children containers with no visible children
    cmdList.querySelectorAll('.cmd-children').forEach(children => {
      const visibleChildren = [...children.querySelectorAll('.command-row')].some(r => r.style.display !== 'none');
      if (!visibleChildren) children.style.display = 'none';
    });
  });

  // Expand/Collapse all buttons
  document.getElementById('cmd-expand-all').addEventListener('click', () => {
    cmdList.querySelectorAll('.cmd-expand').forEach(btn => {
      btn.dataset.expanded = 'true';
    });
    cmdList.querySelectorAll('.cmd-children').forEach(c => c.style.display = 'block');
  });
  document.getElementById('cmd-collapse-all').addEventListener('click', () => {
    cmdList.querySelectorAll('.cmd-expand').forEach(btn => {
      btn.dataset.expanded = 'false';
    });
    cmdList.querySelectorAll('.cmd-children').forEach(c => c.style.display = 'none');
  });
}