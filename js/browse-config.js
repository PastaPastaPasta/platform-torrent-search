/**
 * Browse Page Configuration
 */

const STORAGE_KEY = 'unstoppable-torrents-settings';

// Default configuration - no contract ID by default for safety
export const CONFIG = {
  contractId: null,
  network: null,
  pageSize: 12,
  defaultTab: 'movie'
};

/**
 * Load settings from localStorage
 * @returns {boolean} True if settings were loaded successfully
 */
export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      if (settings.contractId && settings.network) {
        CONFIG.contractId = settings.contractId;
        CONFIG.network = settings.network;
        return true;
      }
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return false;
}

/**
 * Save settings to localStorage
 * @param {string} contractId - The contract ID
 * @param {string} network - The network (testnet/mainnet)
 */
export function saveSettings(contractId, network) {
  CONFIG.contractId = contractId;
  CONFIG.network = network;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ contractId, network }));
}

/**
 * Clear saved settings
 */
export function clearSettings() {
  CONFIG.contractId = null;
  CONFIG.network = null;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if settings are configured
 * @returns {boolean}
 */
export function hasSettings() {
  return CONFIG.contractId && CONFIG.network;
}

// Tab configuration for each document type
export const TAB_CONFIG = {
  movie: {
    label: 'Movies',
    searchField: 'imdbId',
    searchPlaceholder: 'Search by IMDB ID (e.g., tt0133093)',
    indexField: 'imdbId'
  },
  tv: {
    label: 'TV Shows',
    searchField: 'seriesImdbId',
    searchPlaceholder: 'Search by Series IMDB ID (e.g., tt0903747)',
    indexField: 'seriesImdbId'
  },
  book: {
    label: 'Books',
    searchField: 'workId',
    searchPlaceholder: 'Search by Work ID (e.g., OL8483260W)',
    indexField: 'workId'
  },
  iso: {
    label: 'Software',
    searchField: 'title',
    searchPlaceholder: 'Search by title...',
    indexField: 'title'
  },
  other: {
    label: 'Other',
    searchField: 'title',
    searchPlaceholder: 'Search by title...',
    indexField: 'title'
  }
};
