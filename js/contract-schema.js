/**
 * Torrent Metadata Data Contract Schema v2
 * Defines 5 document types: movie, tv, book, iso, other
 *
 * Changes from v1:
 * - Simplified movie/tv/book schemas (query by IMDB/OpenLibrary ID only)
 * - TV: removed showName, season, episode fields
 * - Book: uses OpenLibrary Work ID instead of title/author
 * - Added trackers string (newline-separated URLs) to all document types
 */

// Movie document schema
const movieSchema = {
  type: 'object',
  properties: {
    infoHash: {
      type: 'array',
      byteArray: true,
      minItems: 20,
      maxItems: 20,
      position: 0,
      description: '20-byte raw BitTorrent v1 infohash'
    },
    torrentName: {
      type: 'string',
      maxLength: 256,
      position: 1,
      description: 'Full release name for display/magnet dn'
    },
    imdbId: {
      type: 'integer',
      minimum: 0,
      maximum: 9999999999,
      position: 2,
      description: 'IMDB numeric ID (e.g., 133093 from tt0133093)'
    },
    trackers: {
      type: 'string',
      maxLength: 2048,
      position: 3,
      description: 'Tracker URLs separated by newline (optional)'
    },
    sizeBytes: {
      type: 'integer',
      minimum: 0,
      position: 4,
      description: 'Total torrent size in bytes'
    }
  },
  required: ['infoHash', 'torrentName', 'imdbId'],
  additionalProperties: false,
  indices: [
    {
      name: 'byImdbId',
      properties: [{ imdbId: 'asc' }]
    }
  ]
};

// TV show document schema
const tvSchema = {
  type: 'object',
  properties: {
    infoHash: {
      type: 'array',
      byteArray: true,
      minItems: 20,
      maxItems: 20,
      position: 0
    },
    torrentName: {
      type: 'string',
      maxLength: 256,
      position: 1,
      description: 'Contains season/episode info (e.g., Breaking.Bad.S01E05.720p)'
    },
    seriesImdbId: {
      type: 'integer',
      minimum: 0,
      maximum: 9999999999,
      position: 2,
      description: 'IMDB series numeric ID (e.g., 903747 from tt0903747)'
    },
    trackers: {
      type: 'string',
      maxLength: 2048,
      position: 3,
      description: 'Tracker URLs separated by newline (optional)'
    },
    sizeBytes: {
      type: 'integer',
      minimum: 0,
      position: 4
    }
  },
  required: ['infoHash', 'torrentName', 'seriesImdbId'],
  additionalProperties: false,
  indices: [
    {
      name: 'bySeriesImdbId',
      properties: [{ seriesImdbId: 'asc' }]
    }
  ]
};

// Book document schema
const bookSchema = {
  type: 'object',
  properties: {
    infoHash: {
      type: 'array',
      byteArray: true,
      minItems: 20,
      maxItems: 20,
      position: 0
    },
    torrentName: {
      type: 'string',
      maxLength: 256,
      position: 1
    },
    workId: {
      type: 'integer',
      minimum: 0,
      maximum: 9999999999,
      position: 2,
      description: 'OpenLibrary Work ID numeric part (e.g., 8483260 from OL8483260W)'
    },
    trackers: {
      type: 'string',
      maxLength: 2048,
      position: 3,
      description: 'Tracker URLs separated by newline (optional)'
    },
    sizeBytes: {
      type: 'integer',
      minimum: 0,
      position: 4
    }
  },
  required: ['infoHash', 'torrentName', 'workId'],
  additionalProperties: false,
  indices: [
    {
      name: 'byWorkId',
      properties: [{ workId: 'asc' }]
    }
  ]
};

// ISO/Software document schema
const isoSchema = {
  type: 'object',
  properties: {
    infoHash: {
      type: 'array',
      byteArray: true,
      minItems: 20,
      maxItems: 20,
      position: 0
    },
    torrentName: {
      type: 'string',
      maxLength: 256,
      position: 1
    },
    title: {
      type: 'string',
      maxLength: 63,
      position: 2,
      description: 'Software/ISO name for search'
    },
    trackers: {
      type: 'string',
      maxLength: 2048,
      position: 3,
      description: 'Tracker URLs separated by newline (optional)'
    },
    sizeBytes: {
      type: 'integer',
      minimum: 0,
      position: 4
    }
  },
  required: ['infoHash', 'torrentName', 'title'],
  additionalProperties: false,
  indices: [
    {
      name: 'byTitle',
      properties: [{ title: 'asc' }]
    }
  ]
};

// Other/Miscellaneous document schema
const otherSchema = {
  type: 'object',
  properties: {
    infoHash: {
      type: 'array',
      byteArray: true,
      minItems: 20,
      maxItems: 20,
      position: 0
    },
    torrentName: {
      type: 'string',
      maxLength: 256,
      position: 1
    },
    title: {
      type: 'string',
      maxLength: 63,
      position: 2
    },
    trackers: {
      type: 'string',
      maxLength: 2048,
      position: 3,
      description: 'Tracker URLs separated by newline (optional)'
    },
    sizeBytes: {
      type: 'integer',
      minimum: 0,
      position: 4
    }
  },
  required: ['infoHash', 'torrentName', 'title'],
  additionalProperties: false,
  indices: [
    {
      name: 'byTitle',
      properties: [{ title: 'asc' }]
    }
  ]
};

/**
 * Complete contract schema with all document types
 */
export const TORRENT_CONTRACT_SCHEMA = {
  movie: movieSchema,
  tv: tvSchema,
  book: bookSchema,
  iso: isoSchema,
  other: otherSchema
};

/**
 * Form field definitions for each document type
 * Used by UI to generate dynamic forms
 */
export const FORM_FIELDS = {
  movie: [
    { name: 'infoHash', label: 'Info Hash', type: 'text', required: true, placeholder: '40-char hex (auto-filled from magnet)' },
    { name: 'torrentName', label: 'Torrent Name', type: 'text', required: true, placeholder: 'Full release name' },
    { name: 'imdbId', label: 'IMDB ID', type: 'text', required: true, placeholder: 'e.g., tt0133093' },
    { name: 'trackers', label: 'Trackers', type: 'textarea', required: false, placeholder: 'One tracker URL per line (optional)' },
    { name: 'sizeBytes', label: 'Size (bytes)', type: 'number', required: false, placeholder: 'e.g., 1073741824', min: 0 }
  ],
  tv: [
    { name: 'infoHash', label: 'Info Hash', type: 'text', required: true, placeholder: '40-char hex (auto-filled from magnet)' },
    { name: 'torrentName', label: 'Torrent Name', type: 'text', required: true, placeholder: 'Full release name (includes S01E05 etc.)' },
    { name: 'seriesImdbId', label: 'Series IMDB ID', type: 'text', required: true, placeholder: 'e.g., tt0903747' },
    { name: 'trackers', label: 'Trackers', type: 'textarea', required: false, placeholder: 'One tracker URL per line (optional)' },
    { name: 'sizeBytes', label: 'Size (bytes)', type: 'number', required: false, placeholder: 'e.g., 1073741824', min: 0 }
  ],
  book: [
    { name: 'infoHash', label: 'Info Hash', type: 'text', required: true, placeholder: '40-char hex (auto-filled from magnet)' },
    { name: 'torrentName', label: 'Torrent Name', type: 'text', required: true, placeholder: 'Full release name' },
    { name: 'workId', label: 'OpenLibrary Work ID', type: 'text', required: true, placeholder: 'e.g., OL8483260W' },
    { name: 'trackers', label: 'Trackers', type: 'textarea', required: false, placeholder: 'One tracker URL per line (optional)' },
    { name: 'sizeBytes', label: 'Size (bytes)', type: 'number', required: false, placeholder: 'e.g., 10485760', min: 0 }
  ],
  iso: [
    { name: 'infoHash', label: 'Info Hash', type: 'text', required: true, placeholder: '40-char hex (auto-filled from magnet)' },
    { name: 'torrentName', label: 'Torrent Name', type: 'text', required: true, placeholder: 'Full release name' },
    { name: 'title', label: 'Software/ISO Title', type: 'text', required: true, placeholder: 'e.g., Ubuntu 24.04 LTS', maxLength: 63 },
    { name: 'trackers', label: 'Trackers', type: 'textarea', required: false, placeholder: 'One tracker URL per line (optional)' },
    { name: 'sizeBytes', label: 'Size (bytes)', type: 'number', required: false, placeholder: 'e.g., 4700000000', min: 0 }
  ],
  other: [
    { name: 'infoHash', label: 'Info Hash', type: 'text', required: true, placeholder: '40-char hex (auto-filled from magnet)' },
    { name: 'torrentName', label: 'Torrent Name', type: 'text', required: true, placeholder: 'Full release name' },
    { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g., Nature Wallpapers Collection', maxLength: 63 },
    { name: 'trackers', label: 'Trackers', type: 'textarea', required: false, placeholder: 'One tracker URL per line (optional)' },
    { name: 'sizeBytes', label: 'Size (bytes)', type: 'number', required: false, placeholder: 'e.g., 524288000', min: 0 }
  ]
};

/**
 * Build a complete contract definition for registration
 * @param {string} ownerIdentityId - The identity ID that will own the contract
 * @returns {object} Contract definition ready for registration
 */
export function buildContractDefinition(ownerIdentityId) {
  return {
    $format_version: '0',
    version: 1,
    ownerId: ownerIdentityId,
    schemaDefs: {},
    documentSchemas: TORRENT_CONTRACT_SCHEMA
  };
}

/**
 * Get the required fields for a document type
 * @param {string} docType - Document type (movie, tv, book, iso, other)
 * @returns {string[]} Array of required field names
 */
export function getRequiredFields(docType) {
  const schema = TORRENT_CONTRACT_SCHEMA[docType];
  return schema ? schema.required : [];
}
