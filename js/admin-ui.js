/**
 * UI Handlers - Form logic and UI interactions
 */

import { FORM_FIELDS } from './contract-schema.js';
import { parseMagnetLink, isValidInfoHash, prepareDocumentData, validateDocumentData, bytesToHex, buildMagnetUri, formatImdbId, formatWorkId } from './utils.js';
import { sdkClient } from './sdk-client.js';

/**
 * Format a document for display, converting infoHash to hex and building magnet
 * @param {object} doc - Document from query
 * @returns {object} Formatted document
 */
function formatDocumentForDisplay(doc) {
  const formatted = { ...doc };

  if (formatted.data) {
    formatted.data = { ...formatted.data };

    // Convert base64 infoHash to hex
    if (formatted.data.infoHash && typeof formatted.data.infoHash === 'string') {
      try {
        // Decode base64 to bytes, then to hex
        const bytes = Uint8Array.from(atob(formatted.data.infoHash), c => c.charCodeAt(0));
        formatted.data.infoHashHex = bytesToHex(bytes);

        // Build magnet URI with trackers
        const trackers = formatted.data.trackers || '';
        formatted.data.magnetUri = buildMagnetUri(bytes, formatted.data.torrentName, trackers);
      } catch (e) {
        console.warn('Could not decode infoHash:', e);
      }
    }

    // Format IMDB IDs for display
    if (formatted.data.imdbId != null) {
      formatted.data.imdbIdFormatted = formatImdbId(formatted.data.imdbId);
    }
    if (formatted.data.seriesImdbId != null) {
      formatted.data.seriesImdbIdFormatted = formatImdbId(formatted.data.seriesImdbId);
    }

    // Format Work ID for display
    if (formatted.data.workId != null) {
      formatted.data.workIdFormatted = formatWorkId(formatted.data.workId);
    }
  }

  return formatted;
}

// DOM Element references (populated on init)
let elements = {};

// Local storage keys
const STORAGE_KEYS = {
  contractId: 'torrent_contract_id',
  network: 'torrent_network'
};

/**
 * Initialize UI handlers
 */
export function initUI() {
  // Cache DOM elements
  elements = {
    // Network
    networkRadios: document.querySelectorAll('input[name="network"]'),

    // Identity ID
    identityIdInput: document.getElementById('identityId'),

    // Private key
    privateKeyInput: document.getElementById('privateKey'),

    // Contract ID
    contractIdInput: document.getElementById('contractId'),

    // Action
    actionRadios: document.querySelectorAll('input[name="action"]'),

    // Document type
    docTypeSection: document.getElementById('docTypeSection'),
    documentTypeSelect: document.getElementById('documentType'),

    // Magnet link
    magnetSection: document.getElementById('magnetSection'),
    magnetLinkInput: document.getElementById('magnetLink'),
    parseMagnetBtn: document.getElementById('parseMagnetBtn'),

    // Form fields
    formFieldsSection: document.getElementById('formFieldsSection'),
    dynamicForm: document.getElementById('dynamicForm'),

    // Query section
    querySection: document.getElementById('querySection'),
    queryField: document.getElementById('queryField'),
    queryOperator: document.getElementById('queryOperator'),
    queryValue: document.getElementById('queryValue'),
    queryLimit: document.getElementById('queryLimit'),

    // Execute
    executeBtn: document.getElementById('executeBtn'),
    executeBtnText: document.getElementById('executeBtnText'),

    // Results
    copyBtn: document.getElementById('copyBtn'),
    clearBtn: document.getElementById('clearBtn'),
    outputArea: document.getElementById('outputArea'),

    // Status
    sdkStatus: document.getElementById('sdkStatus'),
    wasmStatus: document.getElementById('wasmStatus'),
    networkStatus: document.getElementById('networkStatus')
  };

  // Load saved values from localStorage
  loadSavedState();

  // Set up event listeners
  setupEventListeners();

  // Initial UI state
  updateActionUI();
}

/**
 * Load saved state from localStorage
 */
function loadSavedState() {
  // Load saved contract ID
  const savedContractId = localStorage.getItem(STORAGE_KEYS.contractId);
  if (savedContractId) {
    elements.contractIdInput.value = savedContractId;
  }

  // Load saved network preference
  const savedNetwork = localStorage.getItem(STORAGE_KEYS.network);
  if (savedNetwork) {
    const radio = document.querySelector(`input[name="network"][value="${savedNetwork}"]`);
    if (radio) {
      radio.checked = true;
      updateNetworkStatus(savedNetwork);
    }
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Network change
  elements.networkRadios.forEach(radio => {
    radio.addEventListener('change', onNetworkChange);
  });

  // Action change
  elements.actionRadios.forEach(radio => {
    radio.addEventListener('change', onActionChange);
  });

  // Document type change
  elements.documentTypeSelect.addEventListener('change', onDocumentTypeChange);

  // Parse magnet button
  elements.parseMagnetBtn.addEventListener('click', onParseMagnet);

  // Magnet input - auto-parse on paste
  elements.magnetLinkInput.addEventListener('paste', (e) => {
    setTimeout(onParseMagnet, 100);
  });

  // Execute button
  elements.executeBtn.addEventListener('click', onExecute);

  // Copy button
  elements.copyBtn.addEventListener('click', onCopy);

  // Clear button
  elements.clearBtn.addEventListener('click', onClear);

  // Contract ID save on change
  elements.contractIdInput.addEventListener('change', () => {
    const value = elements.contractIdInput.value.trim();
    if (value) {
      localStorage.setItem(STORAGE_KEYS.contractId, value);
    }
  });
}

/**
 * Handle network change
 */
function onNetworkChange(e) {
  const network = e.target.value;
  localStorage.setItem(STORAGE_KEYS.network, network);
  updateNetworkStatus(network);

  // Reconnect SDK with new network
  connectToNetwork(network);
}

/**
 * Handle action change (register vs submit)
 */
function onActionChange() {
  updateActionUI();
}

/**
 * Handle document type change
 */
function onDocumentTypeChange() {
  const docType = elements.documentTypeSelect.value;
  generateFormFields(docType);
  updateQueryFieldOptions(docType);
}

/**
 * Update UI based on selected action
 */
function updateActionUI() {
  const action = document.querySelector('input[name="action"]:checked').value;
  const isSubmit = action === 'submit';
  const isQuery = action === 'query';

  // Show/hide sections based on action
  elements.docTypeSection.style.display = (isSubmit || isQuery) ? 'block' : 'none';
  elements.magnetSection.style.display = isSubmit ? 'block' : 'none';
  elements.formFieldsSection.style.display = isSubmit ? 'block' : 'none';
  elements.querySection.style.display = isQuery ? 'block' : 'none';

  // Update button text
  if (isSubmit) {
    elements.executeBtnText.textContent = 'Submit Document';
  } else if (isQuery) {
    elements.executeBtnText.textContent = 'Query Documents';
  } else {
    elements.executeBtnText.textContent = 'Register Contract';
  }

  // Generate form fields if submit mode
  if (isSubmit) {
    const docType = elements.documentTypeSelect.value;
    generateFormFields(docType);
  }

  // Update query field options if query mode
  if (isQuery) {
    const docType = elements.documentTypeSelect.value;
    updateQueryFieldOptions(docType);
  }
}

/**
 * Update query field options based on document type
 * @param {string} docType - Document type
 */
function updateQueryFieldOptions(docType) {
  const queryField = elements.queryField;
  queryField.innerHTML = '';

  // Add "All" option
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All (no filter)';
  queryField.appendChild(allOption);

  // Add type-specific query fields
  switch (docType) {
    case 'movie':
      addQueryOption(queryField, 'imdbId', 'IMDB ID');
      break;
    case 'tv':
      addQueryOption(queryField, 'seriesImdbId', 'Series IMDB ID');
      break;
    case 'book':
      addQueryOption(queryField, 'workId', 'OpenLibrary Work ID');
      break;
    case 'iso':
    case 'other':
      addQueryOption(queryField, 'title', 'Title');
      break;
  }
}

/**
 * Add option to query field select
 */
function addQueryOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

/**
 * Generate dynamic form fields for document type
 * @param {string} docType - Document type
 */
function generateFormFields(docType) {
  const fields = FORM_FIELDS[docType];
  if (!fields) return;

  elements.dynamicForm.innerHTML = '';

  fields.forEach(field => {
    const formGroup = document.createElement('div');
    formGroup.className = `form-group${field.required ? ' required' : ''}`;

    const label = document.createElement('label');
    label.textContent = field.label;
    label.setAttribute('for', `field_${field.name}`);

    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 4;
    } else {
      input = document.createElement('input');
      input.type = field.type;
    }

    input.id = `field_${field.name}`;
    input.name = field.name;
    input.className = 'input-field';
    input.placeholder = field.placeholder || '';

    if (field.maxLength) input.maxLength = field.maxLength;
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.required) input.required = true;

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    elements.dynamicForm.appendChild(formGroup);
  });
}

/**
 * Handle magnet link parsing
 */
function onParseMagnet() {
  const magnetUri = elements.magnetLinkInput.value.trim();

  if (!magnetUri) {
    appendOutput('No magnet link provided');
    return;
  }

  const parsed = parseMagnetLink(magnetUri);

  if (parsed.infoHash) {
    // Fill infoHash field
    const infoHashInput = document.getElementById('field_infoHash');
    if (infoHashInput) {
      infoHashInput.value = parsed.infoHash;
    }

    appendOutput(`Parsed infoHash: ${parsed.infoHash}`);
  } else {
    appendOutput('Could not parse infoHash from magnet link');
  }

  if (parsed.displayName) {
    // Fill torrentName field
    const torrentNameInput = document.getElementById('field_torrentName');
    if (torrentNameInput) {
      torrentNameInput.value = parsed.displayName;
    }

    appendOutput(`Parsed displayName: ${parsed.displayName}`);
  }

  // Fill trackers field if trackers were found
  if (parsed.trackers && parsed.trackers.length > 0) {
    const trackersInput = document.getElementById('field_trackers');
    if (trackersInput) {
      trackersInput.value = parsed.trackers;
    }

    const trackerCount = parsed.trackers.split('\n').filter(t => t.length > 0).length;
    appendOutput(`Parsed ${trackerCount} tracker(s)`);
  }
}

/**
 * Handle execute button click
 */
async function onExecute() {
  const action = document.querySelector('input[name="action"]:checked').value;
  const identityId = elements.identityIdInput.value.trim();
  const privateKey = elements.privateKeyInput.value.trim();

  // Query doesn't require identity/key
  if (action !== 'query') {
    if (!identityId) {
      appendOutput('Error: Identity ID is required');
      return;
    }

    if (!privateKey) {
      appendOutput('Error: Private key is required');
      return;
    }
  }

  // Disable button during execution
  setExecuting(true);

  try {
    // Ensure SDK is connected
    const network = document.querySelector('input[name="network"]:checked').value;
    await connectToNetwork(network);

    if (action === 'register') {
      await executeRegisterContract(identityId, privateKey);
    } else if (action === 'query') {
      await executeQueryDocuments();
    } else {
      await executeSubmitDocument(identityId, privateKey);
    }

  } catch (error) {
    appendOutput(`\nError: ${error.message}`);
    console.error('Execution error:', error);
  } finally {
    setExecuting(false);
  }
}

/**
 * Execute contract registration
 * @param {string} identityId - Identity ID
 * @param {string} privateKey - Private key WIF
 */
async function executeRegisterContract(identityId, privateKey) {
  appendOutput('\n--- Registering Contract (v2) ---\n');
  appendOutput(`Identity ID: ${identityId}`);
  appendOutput('Building contract definition with 5 document types...');
  appendOutput('Document types: movie, tv, book, iso, other\n');

  const { contractId, result } = await sdkClient.registerContract(identityId, privateKey);

  // Save contract ID
  elements.contractIdInput.value = contractId;
  localStorage.setItem(STORAGE_KEYS.contractId, contractId);

  appendOutput(`\nContract registered successfully!`);
  appendOutput(`Contract ID: ${contractId}`);
  appendOutput(`\nFull result:\n${JSON.stringify(result, null, 2)}`);
}

/**
 * Execute document submission
 * @param {string} identityId - Identity ID
 * @param {string} privateKey - Private key WIF
 */
async function executeSubmitDocument(identityId, privateKey) {
  const contractId = elements.contractIdInput.value.trim();
  const docType = elements.documentTypeSelect.value;

  if (!contractId) {
    throw new Error('Contract ID is required. Register a contract first.');
  }

  appendOutput(`\n--- Submitting ${docType.toUpperCase()} Document ---\n`);
  appendOutput(`Identity ID: ${identityId}`);
  appendOutput(`Contract ID: ${contractId}\n`);

  // Collect form data
  const formData = collectFormData();
  appendOutput(`Form data collected:\n${JSON.stringify(formData, null, 2)}\n`);

  // Prepare data for submission (convert types)
  const preparedData = prepareDocumentData(docType, formData);
  appendOutput(`Prepared data:\n${JSON.stringify(preparedData, null, 2)}\n`);

  // Validate
  const validation = validateDocumentData(docType, preparedData);
  if (!validation.valid) {
    throw new Error(`Validation failed:\n- ${validation.errors.join('\n- ')}`);
  }

  appendOutput('Validation passed. Submitting to Platform...\n');

  const { documentId, result } = await sdkClient.submitDocument(
    contractId,
    docType,
    identityId,
    preparedData,
    privateKey
  );

  appendOutput(`\nDocument submitted successfully!`);
  appendOutput(`Document ID: ${documentId}`);
  appendOutput(`\nFull result:\n${JSON.stringify(result, null, 2)}`);
}

/**
 * Execute document query
 */
async function executeQueryDocuments() {
  const contractId = elements.contractIdInput.value.trim();
  const docType = elements.documentTypeSelect.value;
  const queryField = elements.queryField.value;
  const queryOperator = elements.queryOperator.value;
  const queryValue = elements.queryValue.value.trim();
  const limit = parseInt(elements.queryLimit.value, 10) || 10;

  if (!contractId) {
    throw new Error('Contract ID is required for querying');
  }

  appendOutput(`\n--- Querying ${docType.toUpperCase()} Documents ---\n`);
  appendOutput(`Contract ID: ${contractId}`);
  appendOutput(`Document Type: ${docType}`);
  appendOutput(`Limit: ${limit}`);

  // Build query options
  const queryOptions = { limit };

  if (queryField && queryValue) {
    // Parse the query value based on field type
    let parsedValue = queryValue;

    // Convert IMDB ID format to integer for querying
    if (queryField === 'imdbId' || queryField === 'seriesImdbId') {
      const match = queryValue.match(/^tt(\d+)$/i);
      if (match) {
        parsedValue = parseInt(match[1], 10);
      } else if (/^\d+$/.test(queryValue)) {
        parsedValue = parseInt(queryValue, 10);
      }
    }

    // Convert Work ID format to integer for querying
    if (queryField === 'workId') {
      const match = queryValue.match(/^OL(\d+)W$/i);
      if (match) {
        parsedValue = parseInt(match[1], 10);
      } else if (/^\d+$/.test(queryValue)) {
        parsedValue = parseInt(queryValue, 10);
      }
    }

    queryOptions.where = [[queryField, queryOperator, parsedValue]];
    appendOutput(`Filter: ${queryField} ${queryOperator} "${queryValue}" (parsed: ${parsedValue})`);
  } else {
    appendOutput('Filter: None (fetching all)');
  }

  appendOutput('\nQuerying Platform...\n');

  const documents = await sdkClient.queryDocuments(contractId, docType, queryOptions);

  if (!documents || documents.length === 0) {
    appendOutput('No documents found.');
    return;
  }

  appendOutput(`Found ${documents.length} document(s):\n`);

  // Display each document with formatted data and magnet link
  documents.forEach((doc, index) => {
    const formatted = formatDocumentForDisplay(doc);
    appendOutput(`\n--- Document ${index + 1} ---`);
    appendOutput(`ID: ${formatted.id}`);

    // Display type-specific info
    if (formatted.data?.imdbIdFormatted) {
      appendOutput(`IMDB: ${formatted.data.imdbIdFormatted}`);
    }
    if (formatted.data?.seriesImdbIdFormatted) {
      appendOutput(`Series IMDB: ${formatted.data.seriesImdbIdFormatted}`);
    }
    if (formatted.data?.workIdFormatted) {
      appendOutput(`OpenLibrary Work: ${formatted.data.workIdFormatted}`);
    }
    if (formatted.data?.title) {
      appendOutput(`Title: ${formatted.data.title}`);
    }

    appendOutput(`Torrent: ${formatted.data?.torrentName || 'N/A'}`);

    if (formatted.data?.infoHashHex) {
      appendOutput(`InfoHash: ${formatted.data.infoHashHex}`);
    }

    if (formatted.data?.trackers && formatted.data.trackers.length > 0) {
      const trackerCount = formatted.data.trackers.split('\n').filter(t => t.length > 0).length;
      appendOutput(`Trackers: ${trackerCount}`);
    }

    if (formatted.data?.magnetUri) {
      appendOutput(`\nMagnet Link:\n${formatted.data.magnetUri}`);
    }

    appendOutput(`\nFull data:\n${JSON.stringify(formatted.data, null, 2)}`);
  });
}

/**
 * Collect form data from dynamic fields
 * @returns {object} Form data object
 */
function collectFormData() {
  const data = {};
  const inputs = elements.dynamicForm.querySelectorAll('input, textarea');

  inputs.forEach(input => {
    const value = input.value.trim();
    if (value !== '') {
      data[input.name] = value;
    }
  });

  return data;
}

/**
 * Connect to Dash Platform network
 * @param {string} network - Network name
 */
async function connectToNetwork(network) {
  if (sdkClient.connected && sdkClient.network === network) {
    return; // Already connected
  }

  updateSdkStatus('loading', 'Connecting...');

  try {
    await sdkClient.connect(network);
    updateSdkStatus('connected', 'Connected');
  } catch (error) {
    updateSdkStatus('error', error.message);
    throw error;
  }
}

/**
 * Update SDK status display
 * @param {string} status - Status type
 * @param {string} message - Status message
 */
export function updateSdkStatus(status, message) {
  elements.sdkStatus.textContent = message;
  elements.sdkStatus.className = `status-value status-${status}`;
}

/**
 * Update WASM status display
 * @param {string} status - Status type
 * @param {string} message - Status message
 */
export function updateWasmStatus(status, message) {
  elements.wasmStatus.textContent = message;
  elements.wasmStatus.className = `status-value status-${status}`;
}

/**
 * Update network status display
 * @param {string} network - Network name
 */
function updateNetworkStatus(network) {
  elements.networkStatus.textContent = network.charAt(0).toUpperCase() + network.slice(1);
}

/**
 * Set executing state (disable/enable button)
 * @param {boolean} executing - Is executing
 */
function setExecuting(executing) {
  elements.executeBtn.disabled = executing;

  if (executing) {
    elements.executeBtnText.innerHTML = '<span class="loading"></span>Processing...';
  } else {
    const action = document.querySelector('input[name="action"]:checked').value;
    if (action === 'submit') {
      elements.executeBtnText.textContent = 'Submit Document';
    } else if (action === 'query') {
      elements.executeBtnText.textContent = 'Query Documents';
    } else {
      elements.executeBtnText.textContent = 'Register Contract';
    }
  }
}

/**
 * Append text to output area
 * @param {string} text - Text to append
 */
export function appendOutput(text) {
  const output = elements.outputArea;
  output.textContent += text + '\n';
  output.scrollTop = output.scrollHeight;
}

/**
 * Clear output area
 */
function onClear() {
  elements.outputArea.textContent = 'Output cleared. Ready.';
}

/**
 * Copy output to clipboard
 */
async function onCopy() {
  try {
    await navigator.clipboard.writeText(elements.outputArea.textContent);
    appendOutput('\n[Copied to clipboard]');
  } catch (error) {
    appendOutput('\n[Failed to copy to clipboard]');
  }
}
