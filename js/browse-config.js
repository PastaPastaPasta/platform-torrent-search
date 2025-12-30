/**
 * Browse Page Configuration
 */

// Configuration - hardcoded for browse page
export const CONFIG = {
  contractId: '2UGyMaAc1bhk92gkvcpDLC4YvSd5q3SLhEZ1Vc4nqjwk',
  network: 'testnet',
  pageSize: 12,
  defaultTab: 'movie'
};

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
