/**
 * Browse Application Entry Point
 * Initializes SDK and loads browse UI
 */

import { CONFIG } from './browse-config.js';
import { initBrowseUI, updateSdkStatus, loadCurrentTab } from './browse-ui.js';
import { sdkClient } from './sdk-client.js';

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing Dash Torrent Repository Browse Interface...');

  // Initialize UI handlers
  initBrowseUI();

  // Display contract ID in footer
  const contractDisplay = document.getElementById('contractIdDisplay');
  if (contractDisplay) {
    contractDisplay.textContent = CONFIG.contractId;
  }

  // Set up SDK status callback
  sdkClient.setStatusCallback((status, message) => {
    updateSdkStatus(status, message);
  });

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

    updateSdkStatus('loading', 'Connecting to network...');

    // Connect to the configured network
    await sdkClient.connect(CONFIG.network);

    updateSdkStatus('connected', 'Connected');

    // Load the default tab data
    loadCurrentTab();

  } catch (error) {
    console.error('Failed to initialize:', error);
    updateSdkStatus('error', `Failed: ${error.message}`);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
