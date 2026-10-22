export async function init(ctx) {
  const { guildId, api, esc, showMsg, toast, confirmAsync } = ctx;
  const tagList = document.getElementById('tag-list');

  async function loadTags() {
    const data = await api(`/api/data/guild-tags?guildId=${guildId}`);
    if (!data.ok) { showMsg('Failed to load tags.'); return; }

    if (data.tags.length === 0) {
      tagList.innerHTML = '<div class="empty-state"><div class="empty-title">No tags yet</div><div class="empty-desc">Create your first tag using the form above.</div></div>';
      return;
    }

    let html = '';
    for (const tag of data.tags) {
      const date = new Date(tag.createdAt).toLocaleDateString();
      html += `<div class="tag-card" data-name="${esc(tag.name)}">
        <div class="tag-header">
          <div class="tag-name">${esc(tag.name)}</div>
          <div class="tag-meta">${tag.uses} uses · Created ${date}</div>
        </div>
        <div class="tag-content">${esc(tag.content)}</div>
        <div class="tag-actions">
          <button class="btn btn-sm btn-ghost" onclick="window._editTag('${esc(tag.name)}')" data-tooltip="Edit this tag's content.">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="window._deleteTag('${esc(tag.name)}')" data-tooltip="Permanently delete this tag.">Delete</button>
        </div>
      </div>`;
    }
    tagList.innerHTML = html;
  }

  window._createTag = async function() {
    const name = document.getElementById('tag-name').value.trim();
    const content = document.getElementById('tag-content').value.trim();
    if (!name || !content) return;
    const data = await api('/api/data/guild-tags-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, name, content }),
    });
    if (data.ok) {
      document.getElementById('tag-name').value = '';
      document.getElementById('tag-content').value = '';
      toast('Tag created', 'success');
      loadTags();
    } else {
      toast(data.error || 'Failed to create tag.', 'error');
    }
  };

  window._editTag = function(name) {
    const card = document.querySelector(`.tag-card[data-name="${name}"]`);
    if (!card) return;
    const contentEl = card.querySelector('.tag-content');
    const currentText = contentEl.textContent;
    contentEl.innerHTML = `<div class="tag-edit-area"><textarea id="edit-${esc(name)}" data-tooltip="Edit the response sent when this tag is invoked.">${esc(currentText)}</textarea></div>
      <button class="btn btn-sm btn-primary" onclick="window._saveTagEdit('${esc(name)}')" data-tooltip="Save the updated tag content.">Save</button>
      <button class="btn btn-sm btn-ghost" onclick="window._loadTags()" data-tooltip="Discard changes and reload tags.">Cancel</button>`;
  };

  window._saveTagEdit = async function(name) {
    const content = document.getElementById(`edit-${name}`).value.trim();
    if (!content) return;
    const data = await api('/api/data/guild-tag-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, name, content }),
    });
    if (data.ok) {
      toast('Tag updated', 'success');
      loadTags();
    } else {
      toast('Failed to update tag.', 'error');
    }
  };

  window._deleteTag = async function(name) {
    if (!(await confirmAsync('Delete Tag', `Remove tag <code style="background:var(--bg-0);padding:2px 6px;border-radius:var(--r-sm);font-size:var(--text-xs)">${esc(name)}</code> permanently?`))) return;
    const data = await api('/api/data/guild-tags-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, name }),
    });
    if (data.ok) {
      toast('Tag deleted', 'success');
      loadTags();
    } else {
      toast('Failed to delete tag.', 'error');
    }
  };

  window._loadTags = loadTags;

  await loadTags();
}