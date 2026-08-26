// Local development backend.
// For production, change this to the public URL of your Linkly backend.
const API_BASE = window.LINKLY_API_BASE || 'http://localhost:3001';
const MAX_URL_LENGTH = 2048;

const form = document.getElementById('shortenForm');
const urlInput = document.getElementById('url');
const urlError = document.getElementById('urlError');
const resultBox = document.getElementById('result');
const shortLinkEl = document.getElementById('shortLink');
const copyResultBtn = document.getElementById('copyResult');
const shortenBtn = document.getElementById('shortenBtn');
const linkList = document.getElementById('linkList');
const emptyState = document.getElementById('empty');
const loadingEl = document.getElementById('loading');
const linkCountEl = document.getElementById('linkCount');
const toastEl = document.getElementById('toast');
const themeBtn = document.getElementById('theme');

let toastTimer = null;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function showError(message = '') {
  urlError.textContent = message;
}

function setSubmitting(isSubmitting) {
  shortenBtn.disabled = isSubmitting;
  shortenBtn.classList.toggle('loading', isSubmitting);
  urlInput.disabled = isSubmitting;
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

async function loadLinks() {
  loadingEl.hidden = false;

  try {
    const res = await fetch(`${API_BASE}/api/links?limit=50`, {
      headers: { Accept: 'application/json' },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to load links');
    }

    renderLinks(Array.isArray(data) ? data : []);
  } catch (err) {
    linkList.innerHTML = '';
    emptyState.hidden = false;
    showToast(`Backend unavailable: ${err.message}`);
  } finally {
    loadingEl.hidden = true;
  }
}

function renderLinks(links) {
  linkList.innerHTML = '';
  linkCountEl.textContent = `${links.length}${links.length === 50 ? '+' : ''} link${links.length === 1 ? '' : 's'}`;

  if (!links.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  for (const link of links) {
    const item = document.createElement('article');
    item.className = 'link-row';

    item.innerHTML = `
      <div class="link-main">
        <a href="${escapeHtml(link.shortUrl)}" target="_blank" rel="noopener noreferrer" class="short">
          ${escapeHtml(link.shortUrl)}
        </a>
        <p class="long" title="${escapeHtml(link.destinationUrl)}">${escapeHtml(link.destinationUrl)}</p>
        <p class="created">${escapeHtml(formatDate(link.createdAt))}</p>
      </div>
      <div class="clicks">
        <strong>${Number(link.clicks) || 0}</strong>
        <span>click${Number(link.clicks) === 1 ? '' : 's'}</span>
      </div>
      <div class="link-actions">
        <button data-copy="${escapeHtml(link.shortUrl)}" class="secondary small" type="button">Copy</button>
        <button data-delete="${escapeHtml(link.id)}" class="danger small" type="button">Delete</button>
      </div>
    `;

    linkList.appendChild(item);
  }

  linkList.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const copied = await copyText(btn.dataset.copy);
      showToast(copied ? 'Copied to clipboard' : 'Copy failed');
    });
  });

  linkList.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteLink(btn.dataset.delete));
  });
}

async function deleteLink(id) {
  const button = linkList.querySelector(`[data-delete="${CSS.escape(String(id))}"]`);
  if (button) button.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/links/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Failed to delete link');

    await loadLinks();
    showToast('Link deleted');
  } catch (err) {
    if (button) button.disabled = false;
    showToast(err.message);
  }
}

copyResultBtn.addEventListener('click', async () => {
  const copied = await copyText(shortLinkEl.href);
  showToast(copied ? 'Copied to clipboard' : 'Copy failed');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  resultBox.hidden = true;

  const destinationUrl = urlInput.value.trim();

  if (!destinationUrl) {
    showError('Enter a URL first.');
    urlInput.focus();
    return;
  }

  if (destinationUrl.length > MAX_URL_LENGTH) {
    showError(`URL must be ${MAX_URL_LENGTH} characters or fewer.`);
    return;
  }

  if (!isValidUrl(destinationUrl)) {
    showError('Enter a valid http:// or https:// URL.');
    urlInput.focus();
    return;
  }

  setSubmitting(true);

  try {
    const res = await fetch(`${API_BASE}/api/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ destinationUrl }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to shorten URL');
    }

    shortLinkEl.href = data.shortUrl;
    shortLinkEl.textContent = data.shortUrl;
    resultBox.hidden = false;

    urlInput.value = '';
    await loadLinks();
    showToast('Short link created');
  } catch (err) {
    showError(err.message);
  } finally {
    setSubmitting(false);
  }
});

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  themeBtn.textContent = theme === 'dark' ? '☀' : '☾';
  themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  localStorage.setItem('linkly-theme', theme);
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
});

const savedTheme = localStorage.getItem('linkly-theme');
const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
applyTheme(savedTheme || (systemDark ? 'dark' : 'light'));

loadLinks();
