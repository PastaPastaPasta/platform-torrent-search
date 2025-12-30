/**
 * Main Application Entry Point
 * Initializes SDK and UI
 */

import { initUI, updateWasmStatus, updateSdkStatus, appendOutput } from './admin-ui.js';
import { sdkClient } from './sdk-client.js';

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing Dash Torrent Repository...');

  // Initialize UI handlers
  initUI();

  // Set up SDK status callback
  sdkClient.setStatusCallback((status, message) => {
    updateSdkStatus(status, message);
  });

  // Load EvoSDK WASM
  await loadEvoSDK();
}

/**
 * Load EvoSDK WASM module from esm.sh CDN
 */
async function loadEvoSDK() {
  updateWasmStatus('loading', 'Loading...');
  appendOutput('Loading Dash Platform SDK from esm.sh...');

  try {
    // Import from esm.sh CDN (same as working simple_platform.html)
    const { EvoSDK } = await import('https://esm.sh/@dashevo/evo-sdk');

    // Store globally for sdk-client to use
    window.EvoSDK = EvoSDK;

    updateWasmStatus('connected', 'Loaded');
    appendOutput('SDK loaded successfully from esm.sh');

  } catch (error) {
    console.error('Failed to load EvoSDK:', error);
    updateWasmStatus('error', 'Load Failed');
    appendOutput(`\nError loading SDK: ${error.message}`);
  }
}

/**
 * Display welcome message and instructions
 */
function showWelcome() {
  appendOutput('\n=== Dash Torrent Repository - Phase 1 Admin ===\n');
  appendOutput('This interface allows you to:');
  appendOutput('1. Register the TorrentMetadata data contract');
  appendOutput('2. Submit torrent metadata documents\n');
  appendOutput('Document types supported:');
  appendOutput('  - Movie: title, year, IMDB ID');
  appendOutput('  - TV: show name, season, episode');
  appendOutput('  - Book: title, author');
  appendOutput('  - ISO: software/OS images');
  appendOutput('  - Other: miscellaneous content\n');
  appendOutput('Instructions:');
  appendOutput('1. Select your network (Testnet recommended for testing)');
  appendOutput('2. Enter your private key (WIF format)');
  appendOutput('3. Choose an action and fill in the required fields');
  appendOutput('4. Click Execute to perform the action\n');
  appendOutput('Ready.\n');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().then(showWelcome);
  });
} else {
  init().then(showWelcome);
}
