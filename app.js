// Point this at wherever backend/server.js is running.
// Local dev: http://localhost:3001
// Deployed: swap for your Render/Railway/Fly URL after deploying the backend.
const API_BASE = 'http://localhost:3001';

const form = document.getElementById('shortenForm');
const urlInput = document.getElementById('url');
const urlError = document.getElementById('urlError');
const resultBox = document.getElementById('result');
const shortLinkEl = document.getElementById('shortLink');
const copyResultBtn = document.getElementById('copyResult');
const linkList = document.getElementById('linkList');
const emptyState = document.getElementById('empty');
const linkCountEl = document.getElementById('linkCount');
const toastEl = document.getElementById('toast');

let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

function showError(message) {
  urlError.textContent = message || '';
}

async function loadLinks() {
  try {
    const res = await fetch(`${API_BASE}/api/links`);
    if (!res.ok) throw new Error('Failed to load links');
    renderLinks(await res.json());
  } catch (err) {
    showToast(err.message);
  }
}

function renderLinks(links) {
  linkList.innerHTML = '';
  linkCountEl.textContent = `${links.length} link${links.length === 1 ? '' : 's'}`;

  if (links.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const link of links) {
    const item = document.createElement('div');
    item.className = 'link-item';
    item.innerHTML = `
      <div class="link-info">
        <a href="${link.shortUrl}" target="_blank" rel="noopener" class="short-url">${link.shortUrl}</a>
        <p class="destination">${link.destinationUrl}</p>
        <p class="clicks">${link.clicks} click${link.clicks === 1 ? '' : 's'}</p>
      </div>
      <div class="link-actions">
        <button data-copy="${link.shortUrl}" class="secondary" type="button">Copy</button>
        <button data-delete="${link.id}" class="secondary" type="button">Delete</button>
      </div>
    `;
    linkList.appendChild(item);
  }

  linkList.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy);
      showToast('Copied to clipboard');
    });
  });

  linkList.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteLink(btn.dataset.delete));
  });
}

async function deleteLink(id) {
  try {
    const res = await fetch(`${API_BASE}/api/links/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete link');
    await loadLinks();
    showToast('Link deleted');
  } catch (err) {
    showToast(err.message);
  }
}

copyResultBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(shortLinkEl.href);
  showToast('Copied to clipboard');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  resultBox.hidden = true;

  const destinationUrl = urlInput.value.trim();
  if (!destinationUrl) return;

  try {
    const res = await fetch(`${API_BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to shorten URL');

    shortLinkEl.href = data.shortUrl;
    shortLinkEl.textContent = data.shortUrl;
    resultBox.hidden = false;

    urlInput.value = '';
    await loadLinks();
  } catch (err) {
    showError(err.message);
  }
});

loadLinks();
