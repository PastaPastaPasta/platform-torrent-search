/**
 * Browse UI Handlers
 * Manages tab switching, search, pagination, and card rendering
 */

import { sdkClient } from './sdk-client.js';
import { CONFIG, TAB_CONFIG } from './browse-config.js';
import { buildMagnetUri, formatImdbId, formatWorkId, formatBytes, parseImdbId, parseWorkId, bytesToHex } from './utils.js';

// State
let activeTab = CONFIG.defaultTab;
let currentPage = 1;
let pageHistory = [];  // Stack of cursors for previous pages
let currentCursor = null;  // Last document ID for pagination
let lastResults = [];  // Store last results for pagination
let isSearchMode = false;
let searchQuery = '';

// DOM Elements
let elements = {};

/**
 * Initialize Browse UI
 */
export function initBrowseUI() {
  // Cache DOM elements
  elements = {
    sdkStatus: document.getElementById('sdkStatus'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    resultsGrid: document.getElementById('resultsGrid'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    emptyState: document.getElementById('emptyState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    pagination: document.getElementById('pagination'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageInfo: document.getElementById('pageInfo'),
    tabs: document.querySelectorAll('.tab')
  };

  // Set up event listeners
  setupEventListeners();

  // Set initial search placeholder
  updateSearchPlaceholder();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Tab clicks
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const docType = tab.dataset.type;
      if (docType !== activeTab) {
        switchTab(docType);
      }
    });
  });

  // Search
  elements.searchBtn.addEventListener('click', handleSearch);
  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  // Clear search
  elements.clearSearchBtn.addEventListener('click', clearSearch);

  // Pagination
  elements.prevPageBtn.addEventListener('click', loadPreviousPage);
  elements.nextPageBtn.addEventListener('click', loadNextPage);
}

/**
 * Update SDK status display
 */
export function updateSdkStatus(status, message) {
  if (!elements.sdkStatus) return;

  elements.sdkStatus.textContent = message;
  elements.sdkStatus.className = 'status-value';

  switch (status) {
    case 'connected':
      elements.sdkStatus.classList.add('status-connected');
      break;
    case 'loading':
      elements.sdkStatus.classList.add('status-loading');
      break;
    case 'error':
      elements.sdkStatus.classList.add('status-error');
      break;
    default:
      elements.sdkStatus.classList.add('status-disconnected');
  }
}

/**
 * Switch to a different tab
 */
function switchTab(docType) {
  // Update active tab
  activeTab = docType;

  // Update tab styling
  elements.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.type === docType);
  });

  // Update search placeholder
  updateSearchPlaceholder();

  // Reset pagination and search
  resetPagination();
  isSearchMode = false;
  searchQuery = '';
  elements.searchInput.value = '';

  // Load data for new tab
  loadCurrentTab();
}

/**
 * Update search input placeholder based on active tab
 */
function updateSearchPlaceholder() {
  const config = TAB_CONFIG[activeTab];
  if (config && elements.searchInput) {
    elements.searchInput.placeholder = config.searchPlaceholder;
  }
}

/**
 * Reset pagination state
 */
function resetPagination() {
  currentPage = 1;
  pageHistory = [];
  currentCursor = null;
  lastResults = [];
  updatePaginationUI();
}

/**
 * Load data for the current tab
 */
export async function loadCurrentTab() {
  if (!sdkClient.isReady()) {
    console.log('SDK not ready yet');
    return;
  }

  showLoading();

  try {
    const options = {
      limit: CONFIG.pageSize
    };

    // Add cursor for pagination if not first page
    if (currentCursor && currentPage > 1) {
      options.startAfter = currentCursor;
    }

    // Add search filter if in search mode
    if (isSearchMode && searchQuery) {
      options.where = buildWhereClause(searchQuery);
    }

    console.log(`Querying ${activeTab} documents:`, options);

    const results = await sdkClient.queryDocuments(
      CONFIG.contractId,
      activeTab,
      options
    );

    lastResults = results || [];
    renderResults(lastResults);
    updatePaginationUI();

  } catch (error) {
    console.error('Failed to load documents:', error);
    showError(error.message);
  }
}

/**
 * Build where clause for search
 */
function buildWhereClause(query) {
  const config = TAB_CONFIG[activeTab];
  const field = config.searchField;

  if (field === 'imdbId' || field === 'seriesImdbId') {
    // Parse IMDB format
    const imdbNum = parseImdbId(query);
    if (imdbNum !== null) {
      return [[field, '==', imdbNum]];
    }
  } else if (field === 'workId') {
    // Parse OpenLibrary format
    const workNum = parseWorkId(query);
    if (workNum !== null) {
      return [[field, '==', workNum]];
    }
  } else if (field === 'title') {
    // Title search: starts with
    return [[field, 'startsWith', query]];
  }

  return null;
}

/**
 * Handle search
 */
function handleSearch() {
  const query = elements.searchInput.value.trim();

  if (!query) {
    clearSearch();
    return;
  }

  searchQuery = query;
  isSearchMode = true;
  resetPagination();
  loadCurrentTab();
}

/**
 * Clear search and show all results
 */
function clearSearch() {
  elements.searchInput.value = '';
  searchQuery = '';
  isSearchMode = false;
  resetPagination();
  loadCurrentTab();
}

/**
 * Load next page
 */
async function loadNextPage() {
  if (lastResults.length < CONFIG.pageSize) {
    return; // No more results
  }

  // Save current cursor to history for going back
  pageHistory.push(currentCursor);

  // Set cursor to last document's ID
  if (lastResults.length > 0) {
    const lastDoc = lastResults[lastResults.length - 1];
    currentCursor = lastDoc.$id || lastDoc.id;
  }

  currentPage++;
  await loadCurrentTab();
}

/**
 * Load previous page
 */
async function loadPreviousPage() {
  if (currentPage <= 1) {
    return;
  }

  // Restore previous cursor
  currentCursor = pageHistory.pop() || null;
  currentPage--;

  await loadCurrentTab();
}

/**
 * Update pagination UI
 */
function updatePaginationUI() {
  const hasResults = lastResults.length > 0;
  const hasMore = lastResults.length >= CONFIG.pageSize;
  const hasPrevious = currentPage > 1;

  // Show/hide pagination
  elements.pagination.style.display = hasResults ? 'flex' : 'none';

  // Update buttons
  elements.prevPageBtn.disabled = !hasPrevious;
  elements.nextPageBtn.disabled = !hasMore;

  // Update page info
  elements.pageInfo.textContent = `Page ${currentPage}`;
}

/**
 * Render results to the grid
 */
function renderResults(documents) {
  hideLoading();
  hideError();

  if (!documents || documents.length === 0) {
    showEmpty();
    elements.pagination.style.display = 'none';
    return;
  }

  hideEmpty();

  // Clear grid
  elements.resultsGrid.innerHTML = '';

  // Render cards
  documents.forEach(doc => {
    const card = createTorrentCard(doc);
    elements.resultsGrid.appendChild(card);
  });
}

/**
 * Create a torrent card element
 */
function createTorrentCard(doc) {
  const card = document.createElement('div');
  card.className = 'torrent-card';

  // Format document data
  const formatted = formatDocument(doc);

  card.innerHTML = `
    <div class="card-title" title="${escapeHtml(formatted.torrentName)}">
      ${escapeHtml(formatted.torrentName)}
    </div>
    <div class="card-meta">
      ${formatted.metaItems.map(item => `
        <span class="card-meta-item">
          <span>${item.label}:</span>
          <strong>${escapeHtml(item.value)}</strong>
        </span>
      `).join('')}
    </div>
    <div class="card-actions">
      <button class="btn btn-magnet" onclick="window.open('${escapeHtml(formatted.magnetUri)}')">
        Open Magnet
      </button>
      <button class="btn btn-copy" data-magnet="${escapeHtml(formatted.magnetUri)}">
        Copy Link
      </button>
    </div>
  `;

  // Add copy button handler
  const copyBtn = card.querySelector('.btn-copy');
  copyBtn.addEventListener('click', () => {
    copyToClipboard(formatted.magnetUri);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy Link';
    }, 2000);
  });

  return card;
}

/**
 * Format document for display
 */
function formatDocument(doc) {
  const data = doc.data || doc;

  // Get torrent name
  const torrentName = data.torrentName || 'Unknown';

  // Convert infoHash to hex if needed
  let infoHashHex;
  if (data.infoHash) {
    if (Array.isArray(data.infoHash)) {
      infoHashHex = bytesToHex(new Uint8Array(data.infoHash));
    } else if (data.infoHash instanceof Uint8Array) {
      infoHashHex = bytesToHex(data.infoHash);
    } else if (typeof data.infoHash === 'string') {
      infoHashHex = data.infoHash;
    }
  }

  // Build magnet URI
  const trackers = data.trackers || '';
  const magnetUri = infoHashHex ? buildMagnetUri(infoHashHex, torrentName, trackers) : '';

  // Build meta items based on document type
  const metaItems = [];

  // Add type-specific identifier
  if (data.imdbId != null) {
    metaItems.push({ label: 'IMDB', value: formatImdbId(data.imdbId) || data.imdbId });
  }
  if (data.seriesImdbId != null) {
    metaItems.push({ label: 'Series', value: formatImdbId(data.seriesImdbId) || data.seriesImdbId });
  }
  if (data.workId != null) {
    metaItems.push({ label: 'Work ID', value: formatWorkId(data.workId) || data.workId });
  }
  if (data.title) {
    metaItems.push({ label: 'Title', value: data.title });
  }

  // Add size if available
  if (data.sizeBytes) {
    metaItems.push({ label: 'Size', value: formatBytes(data.sizeBytes) });
  }

  // Add tracker count
  if (trackers && trackers.length > 0) {
    const trackerCount = trackers.split('\n').filter(t => t.trim()).length;
    if (trackerCount > 0) {
      metaItems.push({ label: 'Trackers', value: trackerCount.toString() });
    }
  }

  return {
    torrentName,
    infoHashHex,
    magnetUri,
    metaItems
  };
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Show loading state
 */
function showLoading() {
  elements.loadingIndicator.style.display = 'flex';
  elements.resultsGrid.innerHTML = '';
  hideEmpty();
  hideError();
}

/**
 * Hide loading state
 */
function hideLoading() {
  elements.loadingIndicator.style.display = 'none';
}

/**
 * Show empty state
 */
function showEmpty() {
  elements.emptyState.style.display = 'block';
}

/**
 * Hide empty state
 */
function hideEmpty() {
  elements.emptyState.style.display = 'none';
}

/**
 * Show error state
 */
function showError(message) {
  hideLoading();
  hideEmpty();
  elements.errorMessage.textContent = message;
  elements.errorState.style.display = 'block';
}

/**
 * Hide error state
 */
function hideError() {
  elements.errorState.style.display = 'none';
}
