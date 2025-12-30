/**
 * Utility functions for torrent metadata handling
 */

// Base58 alphabet (Bitcoin style)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Generate 32 bytes of entropy as hex string (required for document creation)
 * @returns {string} 64-character hex string
 */
export function generateEntropy() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate 32 bytes of entropy as Uint8Array
 * @returns {Uint8Array} 32-byte array
 */
export function generateEntropyBytes() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Decode base58 string to Uint8Array
 * @param {string} str - Base58 encoded string
 * @returns {Uint8Array} Decoded bytes
 */
export function base58Decode(str) {
  const bytes = [];
  for (const c of str) {
    const idx = BASE58_ALPHABET.indexOf(c);
    if (idx === -1) throw new Error(`Invalid base58 character: ${c}`);

    let carry = idx;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Handle leading zeros
  for (const c of str) {
    if (c !== '1') break;
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

/**
 * Encode Uint8Array to base58 string
 * @param {Uint8Array} bytes - Bytes to encode
 * @returns {string} Base58 encoded string
 */
export function base58Encode(bytes) {
  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Handle leading zeros
  let result = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    result += '1';
  }

  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }

  return result;
}

/**
 * Compute SHA-256 hash
 * @param {Uint8Array} data - Data to hash
 * @returns {Promise<Uint8Array>} 32-byte hash
 */
export async function sha256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Compute double SHA-256 hash
 * @param {Uint8Array} data - Data to hash
 * @returns {Promise<Uint8Array>} 32-byte hash
 */
export async function doubleSha256(data) {
  const first = await sha256(data);
  return sha256(first);
}

/**
 * Generate a data contract ID from owner ID and entropy
 * Contract ID = base58(sha256(sha256(ownerId || entropy)))
 * @param {string} ownerIdBase58 - Owner identity ID in base58
 * @param {Uint8Array} entropy - 32 bytes of entropy
 * @returns {Promise<string>} Contract ID in base58
 */
export async function generateContractId(ownerIdBase58, entropy) {
  // Decode owner ID from base58
  const ownerIdBytes = base58Decode(ownerIdBase58);

  // Concatenate ownerId + entropy
  const combined = new Uint8Array(ownerIdBytes.length + entropy.length);
  combined.set(ownerIdBytes, 0);
  combined.set(entropy, ownerIdBytes.length);

  // Double SHA-256
  const hash = await doubleSha256(combined);

  // Encode as base58
  return base58Encode(hash);
}

/**
 * Parse a magnet link to extract infoHash, display name, and trackers
 * @param {string} magnetUri - The magnet link URI
 * @returns {{ infoHash: string|null, displayName: string|null, trackers: string }}
 */
export function parseMagnetLink(magnetUri) {
  const result = { infoHash: null, displayName: null, trackers: '' };

  if (!magnetUri || typeof magnetUri !== 'string') {
    return result;
  }

  // Extract infohash (40-char hex or 32-char base32)
  const hexMatch = magnetUri.match(/urn:btih:([a-fA-F0-9]{40})/i);
  const base32Match = magnetUri.match(/urn:btih:([A-Z2-7]{32})/i);

  if (hexMatch) {
    result.infoHash = hexMatch[1].toLowerCase();
  } else if (base32Match) {
    // Convert base32 to hex
    result.infoHash = base32ToHex(base32Match[1]);
  }

  // Extract display name (dn parameter)
  const dnMatch = magnetUri.match(/[?&]dn=([^&]+)/);
  if (dnMatch) {
    result.displayName = decodeURIComponent(dnMatch[1].replace(/\+/g, ' '));
  }

  // Extract all tracker URLs (tr parameter) as newline-separated string
  const trackerList = [];
  const trackerMatches = magnetUri.matchAll(/[?&]tr=([^&]+)/g);
  for (const match of trackerMatches) {
    try {
      trackerList.push(decodeURIComponent(match[1]));
    } catch (e) {
      // Ignore invalid URLs
    }
  }
  result.trackers = trackerList.join('\n');

  return result;
}

/**
 * Convert base32 encoded string to hex
 * @param {string} base32 - Base32 encoded string
 * @returns {string} Hex string
 */
export function base32ToHex(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';

  for (const char of base32.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.substr(i, 4), 2).toString(16);
  }

  return hex;
}

/**
 * Validate infoHash format
 * @param {string|Uint8Array} hash - The hash to validate
 * @returns {boolean}
 */
export function isValidInfoHash(hash) {
  if (typeof hash === 'string') {
    return /^[a-f0-9]{40}$/i.test(hash);
  }
  if (hash instanceof Uint8Array) {
    return hash.length === 20;
  }
  return false;
}

/**
 * Convert hex string to Uint8Array (for storage)
 * @param {string} hex - 40-character hex string
 * @returns {Uint8Array} 20-byte array
 */
export function hexToBytes(hex) {
  if (!hex || hex.length !== 40) {
    throw new Error('Invalid hex string: must be 40 characters');
  }

  const bytes = new Uint8Array(20);
  for (let i = 0; i < 40; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string (for display/magnet)
 * @param {Uint8Array} bytes - 20-byte array
 * @returns {string} 40-character hex string
 */
export function bytesToHex(bytes) {
  if (!bytes || bytes.length !== 20) {
    throw new Error('Invalid bytes array: must be 20 bytes');
  }

  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parse IMDB ID string to integer (strips "tt" prefix)
 * @param {string} imdbStr - IMDB ID string like "tt0133093"
 * @returns {number|null} Numeric ID or null if invalid
 */
export function parseImdbId(imdbStr) {
  if (!imdbStr) return null;

  // Handle both "tt0133093" and plain numeric input
  if (typeof imdbStr === 'number') {
    return imdbStr;
  }

  const match = imdbStr.match(/^tt(\d{1,10})$/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try parsing as plain number
  const num = parseInt(imdbStr, 10);
  if (!isNaN(num) && num >= 0 && num <= 9999999999) {
    return num;
  }

  return null;
}

/**
 * Format integer back to IMDB string (adds "tt" prefix)
 * @param {number} imdbInt - Numeric IMDB ID
 * @returns {string|null} Formatted IMDB ID like "tt0133093"
 */
export function formatImdbId(imdbInt) {
  if (imdbInt == null || isNaN(imdbInt)) return null;
  return `tt${imdbInt.toString().padStart(7, '0')}`;
}

/**
 * Validate IMDB ID (accepts string "tt0133093" or integer 133093)
 * @param {string|number} id - IMDB ID to validate
 * @returns {boolean}
 */
export function isValidImdbId(id) {
  if (typeof id === 'string') {
    return /^tt\d{1,10}$/i.test(id);
  }
  if (typeof id === 'number') {
    return Number.isInteger(id) && id >= 0 && id <= 9999999999;
  }
  return false;
}

/**
 * Parse OpenLibrary Work ID string to integer
 * @param {string} workIdStr - Work ID string like "OL8483260W"
 * @returns {number|null} Numeric ID or null if invalid
 */
export function parseWorkId(workIdStr) {
  if (!workIdStr) return null;

  // Handle numeric input
  if (typeof workIdStr === 'number') {
    return workIdStr;
  }

  // Match OpenLibrary Work ID format: OL<digits>W
  const match = workIdStr.match(/^OL(\d{1,10})W$/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try parsing as plain number
  const num = parseInt(workIdStr, 10);
  if (!isNaN(num) && num >= 0 && num <= 9999999999) {
    return num;
  }

  return null;
}

/**
 * Format integer back to OpenLibrary Work ID string
 * @param {number} workIdInt - Numeric Work ID
 * @returns {string|null} Formatted Work ID like "OL8483260W"
 */
export function formatWorkId(workIdInt) {
  if (workIdInt == null || isNaN(workIdInt)) return null;
  return `OL${workIdInt}W`;
}

/**
 * Validate OpenLibrary Work ID (accepts string "OL8483260W" or integer 8483260)
 * @param {string|number} id - Work ID to validate
 * @returns {boolean}
 */
export function isValidWorkId(id) {
  if (typeof id === 'string') {
    return /^OL\d{1,10}W$/i.test(id);
  }
  if (typeof id === 'number') {
    return Number.isInteger(id) && id >= 0 && id <= 9999999999;
  }
  return false;
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string like "1.5 GB"
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return 'Unknown';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;

  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }

  return `${size.toFixed(2)} ${units[i]}`;
}

/**
 * Build a magnet URI from document data
 * @param {Uint8Array|string} infoHash - The infohash (bytes or hex string)
 * @param {string} displayName - The display name for the magnet
 * @param {string} trackers - Tracker URLs (newline-separated string)
 * @returns {string} Magnet URI
 */
export function buildMagnetUri(infoHash, displayName, trackers = '') {
  let hashHex;

  if (infoHash instanceof Uint8Array) {
    hashHex = bytesToHex(infoHash);
  } else if (typeof infoHash === 'string') {
    hashHex = infoHash.toLowerCase();
  } else {
    throw new Error('Invalid infoHash type');
  }

  let magnet = `magnet:?xt=urn:btih:${hashHex}`;

  if (displayName) {
    magnet += `&dn=${encodeURIComponent(displayName)}`;
  }

  // Add tracker URLs from newline-separated string
  if (trackers && trackers.length > 0) {
    const trackerList = trackers.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    for (const tracker of trackerList) {
      magnet += `&tr=${encodeURIComponent(tracker)}`;
    }
  }

  return magnet;
}

/**
 * Parse trackers from textarea input (one per line or comma-separated)
 * @param {string} input - Raw textarea input
 * @returns {string[]} Array of tracker URLs
 */
export function parseTrackersInput(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }

  // Split by newlines and/or commas
  const trackers = input
    .split(/[\n,]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && (t.startsWith('udp://') || t.startsWith('http://') || t.startsWith('https://') || t.startsWith('wss://')));

  // Deduplicate
  return [...new Set(trackers)];
}

/**
 * Prepare document data for submission
 * Converts hex strings to bytes, IMDB strings to integers, etc.
 * @param {string} docType - Document type
 * @param {object} formData - Raw form data
 * @returns {object} Prepared data for Platform submission
 */
export function prepareDocumentData(docType, formData) {
  const data = {};

  // Convert infoHash from hex string to bytes
  if (formData.infoHash) {
    data.infoHash = Array.from(hexToBytes(formData.infoHash));
  }

  // Copy torrentName
  if (formData.torrentName) {
    data.torrentName = formData.torrentName.trim();
  }

  // Parse trackers (string input to newline-separated string)
  if (formData.trackers) {
    const trackers = parseTrackersInput(formData.trackers);
    if (trackers.length > 0) {
      // Store as newline-separated string (not array - Platform only supports byte arrays)
      data.trackers = trackers.join('\n');
    }
  }

  // Handle document-type specific fields
  switch (docType) {
    case 'movie':
      if (formData.imdbId) data.imdbId = parseImdbId(formData.imdbId);
      if (formData.sizeBytes) data.sizeBytes = parseInt(formData.sizeBytes, 10);
      break;

    case 'tv':
      if (formData.seriesImdbId) data.seriesImdbId = parseImdbId(formData.seriesImdbId);
      if (formData.sizeBytes) data.sizeBytes = parseInt(formData.sizeBytes, 10);
      break;

    case 'book':
      if (formData.workId) data.workId = parseWorkId(formData.workId);
      if (formData.sizeBytes) data.sizeBytes = parseInt(formData.sizeBytes, 10);
      break;

    case 'iso':
    case 'other':
      if (formData.title) data.title = formData.title.trim();
      if (formData.sizeBytes) data.sizeBytes = parseInt(formData.sizeBytes, 10);
      break;
  }

  // Remove undefined/null/NaN values
  for (const key of Object.keys(data)) {
    if (data[key] === undefined || data[key] === null || Number.isNaN(data[key])) {
      delete data[key];
    }
  }

  return data;
}

/**
 * Validate document data before submission
 * @param {string} docType - Document type
 * @param {object} data - Prepared document data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDocumentData(docType, data) {
  const errors = [];

  // Common validations
  if (!data.infoHash || data.infoHash.length !== 20) {
    errors.push('Invalid or missing infoHash (must be 40-char hex)');
  }

  if (!data.torrentName || data.torrentName.length === 0) {
    errors.push('Torrent name is required');
  }

  // Document-type specific validations
  switch (docType) {
    case 'movie':
      if (data.imdbId == null) errors.push('IMDB ID is required (e.g., tt0133093)');
      break;

    case 'tv':
      if (data.seriesImdbId == null) errors.push('Series IMDB ID is required (e.g., tt0903747)');
      break;

    case 'book':
      if (data.workId == null) errors.push('OpenLibrary Work ID is required (e.g., OL8483260W)');
      break;

    case 'iso':
    case 'other':
      if (!data.title) errors.push('Title is required');
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
