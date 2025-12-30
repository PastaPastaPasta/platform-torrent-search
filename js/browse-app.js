/**
 * Browse Application Entry Point
 * Initializes SDK and loads browse UI
 */

import { CONFIG, loadSettings, hasSettings } from './browse-config.js';
import { initBrowseUI, updateSdkStatus, loadCurrentTab, showSettingsModal, updateContractDisplay } from './browse-ui.js';
import { sdkClient } from './sdk-client.js';

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing Dash Torrent Repository Browse Interface...');

  // Try to load saved settings from localStorage
  loadSettings();

  // Initialize UI handlers
  initBrowseUI();

  // Update contract display in footer
  updateContractDisplay();

  // Set up SDK status callback
  sdkClient.setStatusCallback((status, message) => {
    updateSdkStatus(status, message);
  });

  // Listen for settings changes to reconnect
  window.addEventListener('settings-changed', async () => {
    console.log('Settings changed, reconnecting...');
    await connectAndLoad();
  });

  // Check if settings are configured
  if (!hasSettings()) {
    // Show settings modal - user must configure before using
    updateSdkStatus('disconnected', 'Not configured');
    showSettingsModal();
    return;
  }

  // Load EvoSDK and connect
  await loadEvoSDK();
}

/**
 * Load EvoSDK WASM module and connect to network
 */
async function loadEvoSDK() {
  updateSdkStatus('loading', 'Loading SDK...');

  try {
    // Import from esm.sh CDN
    const { EvoSDK } = await import('https://esm.sh/@dashevo/evo-sdk');

    // Store globally for sdk-client to use
    window.EvoSDK = EvoSDK;

    await connectToNetwork();

  } catch (error) {
    console.error('Failed to initialize:', error);
    updateSdkStatus('error', `Failed: ${error.message}`);
  }
}

/**
 * Connect to the network and load data
 */
async function connectToNetwork() {
  updateSdkStatus('loading', 'Connecting to network...');

  try {
    // Connect to the configured network
    await sdkClient.connect(CONFIG.network);

    updateSdkStatus('connected', 'Connected');

    // Load the default tab data
    loadCurrentTab();

  } catch (error) {
    console.error('Failed to connect:', error);
    updateSdkStatus('error', `Failed: ${error.message}`);
  }
}

/**
 * Handle settings change - reconnect with new settings
 */
async function connectAndLoad() {
  // Update footer display
  updateContractDisplay();

  // If SDK is already loaded, just reconnect
  if (window.EvoSDK) {
    await connectToNetwork();
  } else {
    await loadEvoSDK();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
