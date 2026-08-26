/**
 * Linkly — Next-Gen URL Shortener Application Script
 * Vanilla ES6+ with Hybrid Cloud/Local Fallback, QR Generation, Analytics & Rich UI
 */

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const API_BASE = window.LINKLY_API_BASE || 'http://localhost:3001';
  const MAX_URL_LENGTH = 2048;
  const LOCAL_STORAGE_KEY = 'linkly_local_links';
  const THEME_STORAGE_KEY = 'linkly_theme';

  // --- State ---
  let linksState = [];
  let isCloudBackend = false;
  let currentDeleteId = null;
  let activeQrUrl = '';

  // --- DOM Elements ---
  const form = document.getElementById('shortenForm');
  const urlInput = document.getElementById('url');
  const customAliasInput = document.getElementById('customAlias');
  const toggleAliasBtn = document.getElementById('toggleAliasBtn');
  const aliasDrawer = document.getElementById('aliasDrawer');
  const shortenBtn = document.getElementById('shortenBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const urlError = document.getElementById('urlError');
  const errorMessage = document.getElementById('errorMessage');

  const resultBox = document.getElementById('result');
  const shortLinkEl = document.getElementById('shortLink');
  const copyResultBtn = document.getElementById('copyResult');
  const qrResultBtn = document.getElementById('qrResultBtn');
  const shareResultBtn = document.getElementById('shareResultBtn');
  const visitResultBtn = document.getElementById('visitResultBtn');

  const linkListEl = document.getElementById('linkList');
  const linkCountEl = document.getElementById('linkCount');
  const loadingEl = document.getElementById('loading');
  const emptyState = document.getElementById('empty');
  const noResultsState = document.getElementById('noResults');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const resetSearchBtn = document.getElementById('resetSearchBtn');
  const sortSelect = document.getElementById('sortSelect');

  const exportBtn = document.getElementById('exportBtn');
  const exportMenu = document.getElementById('exportMenu');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');

  const statTotalLinks = document.getElementById('statTotalLinks');
  const statTotalClicks = document.getElementById('statTotalClicks');
  const statTopClicks = document.getElementById('statTopClicks');
  const statAvgClicks = document.getElementById('statAvgClicks');

  const backendStatus = document.getElementById('backendStatus');
  const themeBtn = document.getElementById('theme');
  const toastContainer = document.getElementById('toastContainer');

  // Modals
  const qrModal = document.getElementById('qrModal');
  const qrCanvas = document.getElementById('qrCanvas');
  const qrModalUrl = document.getElementById('qrModalUrl');
  const closeQrModal = document.getElementById('closeQrModal');
  const downloadQrBtn = document.getElementById('downloadQrBtn');

  const shareModal = document.getElementById('shareModal');
  const shareModalUrlInput = document.getElementById('shareModalUrlInput');
  const shareModalCopyBtn = document.getElementById('shareModalCopyBtn');
  const closeShareModal = document.getElementById('closeShareModal');
  const shareXBtn = document.getElementById('shareXBtn');
  const shareWaBtn = document.getElementById('shareWaBtn');
  const shareInBtn = document.getElementById('shareInBtn');
  const shareTgBtn = document.getElementById('shareTgBtn');

  const deleteModal = document.getElementById('deleteModal');
  const deleteModalTarget = document.getElementById('deleteModalTarget');
  const closeDeleteModal = document.getElementById('closeDeleteModal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  // =========================================================================
  // Compact QR Code Generator (Zero Dependency Canvas Renderer)
  // =========================================================================
  const QR = (function () {
    // Standard minimal QR Code generator algorithm
    const PAD0 = 0xec, PAD1 = 0x11;

    const RS_FACTORS = {
      7: [1, 127, 122, 154, 164, 11, 68, 117],
      10: [1, 216, 194, 159, 111, 199, 94, 95, 113, 157, 193],
      15: [1, 29, 196, 111, 163, 112, 74, 10, 105, 139, 132, 151, 32, 134, 26, 53],
      18: [1, 215, 234, 158, 94, 184, 97, 118, 170, 79, 187, 152, 148, 252, 179, 5, 98, 96, 153],
      26: [1, 173, 125, 158, 2, 103, 182, 118, 17, 145, 201, 111, 28, 165, 53, 161, 21, 245, 142, 13, 102, 48, 227, 153, 145, 218, 70]
    };

    const EXP_TABLE = new Uint8Array(512);
    const LOG_TABLE = new Uint8Array(256);
    (function initGalois() {
      let x = 1;
      for (let i = 0; i < 255; i++) {
        EXP_TABLE[i] = x;
        EXP_TABLE[i + 255] = x;
        LOG_TABLE[x] = i;
        x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
      }
    })();

    function gMul(a, b) {
      if (a === 0 || b === 0) return 0;
      return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
    }

    function calculateRS(data, rsCount) {
      const gen = RS_FACTORS[rsCount] || RS_FACTORS[10];
      const res = new Uint8Array(rsCount);
      for (let i = 0; i < data.length; i++) {
        const factor = data[i] ^ res[0];
        for (let j = 0; j < rsCount - 1; j++) {
          res[j] = res[j + 1] ^ gMul(gen[j + 1], factor);
        }
        res[rsCount - 1] = gMul(gen[rsCount] || 0, factor);
      }
      return res;
    }

    function generateMatrix(text) {
      // Choose version based on text length (versions 1..4)
      const len = text.length;
      let version = 1;
      let dataCapacity = 19;
      let rsCount = 7;

      if (len > 14) { version = 2; dataCapacity = 34; rsCount = 10; }
      if (len > 26) { version = 3; dataCapacity = 55; rsCount = 15; }
      if (len > 44) { version = 4; dataCapacity = 80; rsCount = 18; }
      if (len > 64) { version = 6; dataCapacity = 136; rsCount = 26; }

      const size = version * 4 + 17;
      const matrix = Array.from({ length: size }, () => new Int8Array(size));
      const isReserved = Array.from({ length: size }, () => new Uint8Array(size));

      function setModule(r, c, val) {
        if (r >= 0 && r < size && c >= 0 && c < size) {
          matrix[r][c] = val ? 1 : 0;
          isReserved[r][c] = 1;
        }
      }

      // Finder patterns
      function addFinder(r, c) {
        for (let dr = -1; dr <= 7; dr++) {
          for (let dc = -1; dc <= 7; dc++) {
            const isBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
            const isBlack = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
                            (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
                            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
            if (isBorder) {
              if (r + dr >= 0 && r + dr < size && c + dc >= 0 && c + dc < size) {
                setModule(r + dr, c + dc, 0);
              }
            } else {
              setModule(r + dr, c + dc, isBlack ? 1 : 0);
            }
          }
        }
      }

      addFinder(0, 0);
      addFinder(0, size - 7);
      addFinder(size - 7, 0);

      // Alignment pattern for version >= 2
      if (version >= 2) {
        const alignPos = size - 7;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(alignPos + dr, alignPos + dc, isBlack ? 1 : 0);
          }
        }
      }

      // Timing patterns
      for (let i = 8; i < size - 8; i++) {
        setModule(6, i, i % 2 === 0);
        setModule(i, 6, i % 2 === 0);
      }

      // Dark module
      setModule(size - 8, 8, 1);

      // Format info area reservation
      for (let i = 0; i < 9; i++) {
        if (i !== 6) { isReserved[8][i] = 1; isReserved[i][8] = 1; }
      }
      for (let i = 0; i < 8; i++) {
        isReserved[8][size - 1 - i] = 1;
        isReserved[size - 1 - i][8] = 1;
      }

      // Encode data stream: 8-bit byte mode (mode 0100)
      const bits = [];
      function addBits(val, count) {
        for (let i = count - 1; i >= 0; i--) {
          bits.push((val >> i) & 1);
        }
      }

      addBits(0b0100, 4); // Byte mode
      addBits(len, 8);    // Character count

      for (let i = 0; i < len; i++) {
        addBits(text.charCodeAt(i) & 0xff, 8);
      }

      // Terminator
      const totalDataBits = dataCapacity * 8;
      addBits(0, Math.min(4, totalDataBits - bits.length));

      // Byte align
      while (bits.length % 8 !== 0) bits.push(0);

      // Pad bytes
      let padToggle = false;
      while (bits.length < totalDataBits) {
        addBits(padToggle ? PAD1 : PAD0, 8);
        padToggle = !padToggle;
      }

      // Convert data bits to bytes
      const dataBytes = new Uint8Array(dataCapacity);
      for (let i = 0; i < dataCapacity; i++) {
        let b = 0;
        for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
        dataBytes[i] = b;
      }

      // Calculate RS error correction
      const rsBytes = calculateRS(dataBytes, rsCount);

      // Combine data + RS into allBits
      const allBits = [];
      for (let i = 0; i < dataBytes.length; i++) {
        for (let j = 7; j >= 0; j--) allBits.push((dataBytes[i] >> j) & 1);
      }
      for (let i = 0; i < rsBytes.length; i++) {
        for (let j = 7; j >= 0; j--) allBits.push((rsBytes[i] >> j) & 1);
      }

      // Place data modules (up/down zigzag)
      let bitIdx = 0;
      let upward = true;
      for (let right = size - 1; right > 0; right -= 2) {
        if (right === 6) right--; // Skip vertical timing column
        const rows = upward
          ? Array.from({ length: size }, (_, i) => size - 1 - i)
          : Array.from({ length: size }, (_, i) => i);

        for (const r of rows) {
          for (const c of [right, right - 1]) {
            if (!isReserved[r][c]) {
              const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
              // Apply Mask 0: (r + c) % 2 == 0
              const mask = (r + c) % 2 === 0 ? 1 : 0;
              matrix[r][c] = (bit ^ mask) ? 1 : 0;
            }
          }
        }
        upward = !upward;
      }

      // Format information (Mask 0, Level M: 0b101010000010010)
      const formatBits = [1,0,1,0,1,0,0,0,0,0,1,0,0,1,0];
      for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i];
      matrix[8][7] = formatBits[6];
      matrix[8][8] = formatBits[7];
      matrix[7][8] = formatBits[8];
      for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i];

      for (let i = 0; i < 8; i++) matrix[8][size - 1 - i] = formatBits[14 - i];
      for (let i = 0; i < 7; i++) matrix[size - 7 + i][8] = formatBits[i];

      return matrix;
    }

    function renderToCanvas(canvas, text, options = {}) {
      const matrix = generateMatrix(text);
      const size = matrix.length;
      const margin = options.margin || 4;
      const totalModules = size + margin * 2;
      const targetSize = options.size || 220;
      const scale = Math.floor(targetSize / totalModules) || 5;
      const canvasSize = totalModules * scale;

      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = options.bgColor || '#ffffff';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      ctx.fillStyle = options.fgColor || '#000000';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (matrix[r][c] === 1) {
            ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
          }
        }
      }
    }

    return { renderToCanvas };
  })();

  // =========================================================================
  // Toast & Alerts System
  // =========================================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function showError(msg = '') {
    if (msg) {
      errorMessage.textContent = msg;
      urlError.hidden = false;
    } else {
      urlError.hidden = true;
    }
  }

  // =========================================================================
  // Helpers & Utilities
  // =========================================================================
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function isValidUrl(val) {
    try {
      const u = new URL(val);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function extractDomain(urlStr) {
    try {
      return new URL(urlStr).hostname;
    } catch {
      return 'link';
    }
  }

  function formatRelativeTime(dateValue) {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now - d;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 45) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(d);
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const res = document.execCommand('copy');
      ta.remove();
      return res;
    } catch {
      return false;
    }
  }

  function generateLocalCode() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // =========================================================================
  // Local Storage Data Layer
  // =========================================================================
  function getLocalLinks() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function saveLocalLinks(links) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(links));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // =========================================================================
  // Backend Connection & Health Check
  // =========================================================================
  async function checkBackendHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${API_BASE}/`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        isCloudBackend = true;
        backendStatus.className = 'status-pill status-live';
        backendStatus.querySelector('.status-text').textContent = 'Cloud Sync';
        backendStatus.title = `Connected to live API at ${API_BASE}`;
        return true;
      }
    } catch {
      // Backend not running or unreachable
    }

    isCloudBackend = false;
    backendStatus.className = 'status-pill status-local';
    backendStatus.querySelector('.status-text').textContent = 'Local Demo';
    backendStatus.title = 'Running in resilient offline mode with LocalStorage persistence';
    return false;
  }

  // =========================================================================
  // Data Fetching & Sync
  // =========================================================================
  async function loadLinks() {
    loadingEl.hidden = false;
    emptyState.hidden = true;
    noResultsState.hidden = true;

    if (isCloudBackend) {
      try {
        const res = await fetch(`${API_BASE}/api/links?limit=50`, {
          headers: { Accept: 'application/json' }
        });
        if (!res.ok) throw new Error('API fetch failed');
        const data = await res.json();
        linksState = Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn('Live API request failed, falling back to local:', err);
        linksState = getLocalLinks();
      }
    } else {
      linksState = getLocalLinks();
    }

    loadingEl.hidden = true;
    updateAnalytics();
    renderFilteredLinks();
  }

  // =========================================================================
  // Analytics Calculation
  // =========================================================================
  function updateAnalytics() {
    const total = linksState.length;
    const totalClicks = linksState.reduce((acc, l) => acc + (Number(l.clicks) || 0), 0);
    const topClicks = linksState.reduce((max, l) => Math.max(max, Number(l.clicks) || 0), 0);
    const avgClicks = total > 0 ? (totalClicks / total).toFixed(1) : '0.0';

    statTotalLinks.textContent = total.toLocaleString();
    statTotalClicks.textContent = totalClicks.toLocaleString();
    statTopClicks.textContent = topClicks.toLocaleString();
    statAvgClicks.textContent = avgClicks;
  }

  // =========================================================================
  // Link Rendering & Filtering
  // =========================================================================
  function getFilteredAndSortedLinks() {
    const query = searchInput.value.trim().toLowerCase();
    const sortVal = sortSelect.value;

    let filtered = linksState.filter(link => {
      if (!query) return true;
      const short = (link.shortUrl || '').toLowerCase();
      const code = (link.code || '').toLowerCase();
      const dest = (link.destinationUrl || '').toLowerCase();
      return short.includes(query) || code.includes(query) || dest.includes(query);
    });

    filtered.sort((a, b) => {
      if (sortVal === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortVal === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      } else if (sortVal === 'clicks-desc') {
        return (Number(b.clicks) || 0) - (Number(a.clicks) || 0);
      } else if (sortVal === 'clicks-asc') {
        return (Number(a.clicks) || 0) - (Number(b.clicks) || 0);
      }
      return 0;
    });

    return filtered;
  }

  function renderFilteredLinks() {
    const filtered = getFilteredAndSortedLinks();
    linkListEl.innerHTML = '';

    linkCountEl.textContent = `${filtered.length} link${filtered.length === 1 ? '' : 's'}`;

    if (linksState.length === 0) {
      emptyState.hidden = false;
      noResultsState.hidden = true;
      return;
    }

    if (filtered.length === 0) {
      emptyState.hidden = true;
      noResultsState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    noResultsState.hidden = true;

    for (const link of filtered) {
      const domain = extractDomain(link.destinationUrl);
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

      const card = document.createElement('article');
      card.className = 'link-card';
      card.dataset.id = link.id;

      card.innerHTML = `
        <div class="link-card-main">
          <div class="link-favicon" title="${escapeHtml(domain)}">
            <img src="${faviconUrl}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2364748b\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/></svg>'">
          </div>
          <div class="link-details">
            <div class="link-url-row">
              <a href="${escapeHtml(link.shortUrl)}" target="_blank" rel="noopener noreferrer" class="short-url-link" data-track-click="${escapeHtml(link.id)}">
                ${escapeHtml(link.shortUrl)}
              </a>
            </div>
            <span class="original-url-text" title="${escapeHtml(link.destinationUrl)}">
              ${escapeHtml(link.destinationUrl)}
            </span>
            <div class="link-meta-row">
              <span class="meta-time">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${escapeHtml(formatRelativeTime(link.createdAt))}
              </span>
              <span>·</span>
              <span>${escapeHtml(domain)}</span>
            </div>
          </div>
        </div>

        <div class="link-clicks-badge">
          <strong class="click-count-num">${Number(link.clicks) || 0}</strong>
          <span class="click-count-label">Clicks</span>
        </div>

        <div class="link-card-actions">
          <button class="action-icon-btn copy-item-btn" type="button" data-copy="${escapeHtml(link.shortUrl)}" title="Copy short link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>

          <button class="action-icon-btn qr-item-btn" type="button" data-qr="${escapeHtml(link.shortUrl)}" title="View QR Code">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>

          <button class="action-icon-btn share-item-btn" type="button" data-share="${escapeHtml(link.shortUrl)}" title="Share link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>

          <button class="action-icon-btn delete-btn delete-item-btn" type="button" data-delete-id="${escapeHtml(link.id)}" data-delete-url="${escapeHtml(link.shortUrl)}" title="Delete link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      linkListEl.appendChild(card);
    }

    attachCardListeners();
  }

  function attachCardListeners() {
    // Copy item
    linkListEl.querySelectorAll('.copy-item-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy;
        const ok = await copyToClipboard(text);
        if (ok) {
          showToast('Copied link to clipboard!', 'success');
          btn.style.color = 'var(--success)';
          setTimeout(() => btn.style.color = '', 1000);
        } else {
          showToast('Failed to copy', 'error');
        }
      });
    });

    // QR Item
    linkListEl.querySelectorAll('.qr-item-btn').forEach(btn => {
      btn.addEventListener('click', () => openQrModal(btn.dataset.qr));
    });

    // Share Item
    linkListEl.querySelectorAll('.share-item-btn').forEach(btn => {
      btn.addEventListener('click', () => openShareModal(btn.dataset.share));
    });

    // Delete Item
    linkListEl.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openDeleteModal(btn.dataset.deleteId, btn.dataset.deleteUrl);
      });
    });

    // Local Click Tracking for Demo Links
    linkListEl.querySelectorAll('[data-track-click]').forEach(linkEl => {
      linkEl.addEventListener('click', () => {
        const id = linkEl.dataset.trackClick;
        const item = linksState.find(l => String(l.id) === String(id));
        if (item) {
          item.clicks = (Number(item.clicks) || 0) + 1;
          if (!isCloudBackend) saveLocalLinks(linksState);
          updateAnalytics();
          const countEl = linkEl.closest('.link-card')?.querySelector('.click-count-num');
          if (countEl) countEl.textContent = item.clicks;
        }
      });
    });
  }

  // =========================================================================
  // Form Submission & Link Creation
  // =========================================================================
  function setSubmitting(isSubmitting) {
    shortenBtn.disabled = isSubmitting;
    shortenBtn.classList.toggle('loading', isSubmitting);
    urlInput.disabled = isSubmitting;
    if (customAliasInput) customAliasInput.disabled = isSubmitting;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    resultBox.hidden = true;

    const destUrl = urlInput.value.trim();
    const alias = customAliasInput ? customAliasInput.value.trim() : '';

    if (!destUrl) {
      showError('Please enter a URL to shorten.');
      urlInput.focus();
      return;
    }

    if (destUrl.length > MAX_URL_LENGTH) {
      showError(`URL exceeds the maximum length of ${MAX_URL_LENGTH} characters.`);
      return;
    }

    if (!isValidUrl(destUrl)) {
      showError('Please enter a valid URL including http:// or https://');
      urlInput.focus();
      return;
    }

    if (alias && !/^[a-zA-Z0-9_-]{3,30}$/.test(alias)) {
      showError('Custom alias must be 3-30 characters (letters, numbers, hyphens, underscores).');
      if (customAliasInput) customAliasInput.focus();
      return;
    }

    setSubmitting(true);

    try {
      let createdLink = null;

      if (isCloudBackend) {
        const res = await fetch(`${API_BASE}/api/links`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ destinationUrl: destUrl, customAlias: alias || undefined })
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Failed to shorten URL on server');
        createdLink = data;
      } else {
        // Local Mode creation
        const code = alias || generateLocalCode();
        const shortUrl = `${window.location.origin.replace(/\/$/, '')}/${code}`;
        createdLink = {
          id: 'loc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          code: code,
          shortUrl: shortUrl,
          destinationUrl: destUrl,
          clicks: 0,
          createdAt: new Date().toISOString()
        };

        const localList = getLocalLinks();
        localList.unshift(createdLink);
        saveLocalLinks(localList);
        linksState = localList;
      }

      // Display active result
      activeQrUrl = createdLink.shortUrl;
      shortLinkEl.textContent = createdLink.shortUrl;
      visitResultBtn.href = createdLink.destinationUrl; // In local demo, directly test link destination
      resultBox.hidden = false;

      // Clear input
      urlInput.value = '';
      if (customAliasInput) customAliasInput.value = '';
      if (aliasDrawer) aliasDrawer.hidden = true;
      toggleAliasBtn.classList.remove('open');

      showToast('Short link generated successfully!', 'success');
      await loadLinks();
    } catch (err) {
      showError(err.message || 'An error occurred while shortening the link.');
    } finally {
      setSubmitting(false);
    }
  });

  // =========================================================================
  // Result Box Actions
  // =========================================================================
  copyResultBtn.addEventListener('click', async () => {
    const text = shortLinkEl.textContent;
    const ok = await copyToClipboard(text);
    if (ok) {
      copyResultBtn.classList.add('copied');
      copyResultBtn.querySelector('.copy-text').textContent = 'Copied!';
      showToast('Copied short link to clipboard!', 'success');
      setTimeout(() => {
        copyResultBtn.classList.remove('copied');
        copyResultBtn.querySelector('.copy-text').textContent = 'Copy';
      }, 2200);
    } else {
      showToast('Failed to copy', 'error');
    }
  });

  qrResultBtn.addEventListener('click', () => {
    if (activeQrUrl) openQrModal(activeQrUrl);
  });

  shareResultBtn.addEventListener('click', () => {
    if (activeQrUrl) openShareModal(activeQrUrl);
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          showError('');
          urlInput.focus();
          showToast('Pasted from clipboard!', 'info');
          return;
        }
      }
    } catch {
      // Permission denied or unsecure context
    }
    urlInput.focus();
  });

  toggleAliasBtn.addEventListener('click', () => {
    const isHidden = aliasDrawer.hidden;
    aliasDrawer.hidden = !isHidden;
    toggleAliasBtn.classList.toggle('open', !aliasDrawer.hidden);
    if (!aliasDrawer.hidden) customAliasInput.focus();
  });

  // =========================================================================
  // Search & Filter Controls
  // =========================================================================
  searchInput.addEventListener('input', () => {
    clearSearchBtn.hidden = !searchInput.value;
    renderFilteredLinks();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.hidden = true;
    renderFilteredLinks();
    searchInput.focus();
  });

  resetSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.hidden = true;
    renderFilteredLinks();
  });

  sortSelect.addEventListener('change', () => {
    renderFilteredLinks();
  });

  // =========================================================================
  // Export Functions
  // =========================================================================
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.hidden = !exportMenu.hidden;
  });

  document.addEventListener('click', () => {
    if (!exportMenu.hidden) exportMenu.hidden = true;
  });

  exportCsvBtn.addEventListener('click', () => {
    if (linksState.length === 0) {
      showToast('No links to export', 'error');
      return;
    }

    const headers = ['ID', 'Short Code', 'Short URL', 'Destination URL', 'Clicks', 'Created At'];
    const rows = linksState.map(l => [
      `"${l.id || ''}"`,
      `"${l.code || ''}"`,
      `"${l.shortUrl || ''}"`,
      `"${(l.destinationUrl || '').replace(/"/g, '""')}"`,
      Number(l.clicks) || 0,
      `"${l.createdAt || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `linkly_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Exported CSV file!', 'success');
  });

  exportJsonBtn.addEventListener('click', () => {
    if (linksState.length === 0) {
      showToast('No links to export', 'error');
      return;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(linksState, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `linkly_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Exported JSON file!', 'success');
  });

  // =========================================================================
  // Modals Implementation
  // =========================================================================
  function openQrModal(url) {
    qrModalUrl.textContent = url;
    QR.renderToCanvas(qrCanvas, url, { size: 220 });
    qrModal.hidden = false;
  }

  closeQrModal.addEventListener('click', () => qrModal.hidden = true);
  downloadQrBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `linkly-qr-${Date.now()}.png`;
    link.href = qrCanvas.toDataURL('image/png');
    link.click();
    showToast('QR Code image downloaded!', 'success');
  });

  function openShareModal(url) {
    shareModalUrlInput.value = url;
    shareModal.hidden = false;

    // Web Share API if supported on mobile
    if (navigator.share) {
      // Optional fallback
    }

    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent('Check out this link:');

    shareXBtn.onclick = () => {
      window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank', 'noopener,noreferrer');
    };

    shareWaBtn.onclick = () => {
      window.open(`https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`, '_blank', 'noopener,noreferrer');
    };

    shareInBtn.onclick = () => {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank', 'noopener,noreferrer');
    };

    shareTgBtn.onclick = () => {
      window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank', 'noopener,noreferrer');
    };
  }

  closeShareModal.addEventListener('click', () => shareModal.hidden = true);
  shareModalCopyBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(shareModalUrlInput.value);
    if (ok) showToast('Link copied!', 'success');
  });

  function openDeleteModal(id, url) {
    currentDeleteId = id;
    deleteModalTarget.textContent = url;
    deleteModal.hidden = false;
  }

  closeDeleteModal.addEventListener('click', () => deleteModal.hidden = true);
  cancelDeleteBtn.addEventListener('click', () => deleteModal.hidden = true);

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!currentDeleteId) return;
    const id = currentDeleteId;
    deleteModal.hidden = true;

    try {
      if (isCloudBackend) {
        const res = await fetch(`${API_BASE}/api/links/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete on server');
      } else {
        const updated = linksState.filter(l => String(l.id) !== String(id));
        saveLocalLinks(updated);
        linksState = updated;
      }

      showToast('Link deleted', 'info');
      await loadLinks();
    } catch (err) {
      showToast(err.message || 'Failed to delete link', 'error');
    }
  });

  // Close modals on clicking backdrop
  [qrModal, shareModal, deleteModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.hidden = true;
    });
  });

  // =========================================================================
  // Keyboard Shortcuts & Navigation
  // =========================================================================
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      qrModal.hidden = true;
      shareModal.hidden = true;
      deleteModal.hidden = true;
      if (!exportMenu.hidden) exportMenu.hidden = true;
    } else if (e.key === '/' && document.activeElement !== urlInput && document.activeElement !== searchInput) {
      e.preventDefault();
      urlInput.focus();
      urlInput.select();
    }
  });

  // =========================================================================
  // Theme Toggle & Persistence
  // =========================================================================
  function applyTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');
    themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeBtn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }

  themeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  });

  const savedTheme = (function () {
    try { return localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
  })();
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (systemPrefersDark ? 'dark' : 'dark')); // default dark

  // =========================================================================
  // Initialization
  // =========================================================================
  async function init() {
    await checkBackendHealth();
    await loadLinks();
  }

  init();
})();