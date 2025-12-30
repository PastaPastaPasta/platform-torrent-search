# Unstoppable Torrents

A decentralized torrent metadata repository powered by Dash Platform. Browse, search, and share torrent metadata stored on the blockchain - censorship-resistant and unstoppable.

## Features

- **Browse Interface**: Tab-based navigation for Movies, TV Shows, Books, Software, and Other content
- **Search**: Find torrents by IMDB ID, OpenLibrary Work ID, or title
- **Pagination**: Navigate through results with Previous/Next
- **Magnet Links**: One-click copy or open magnet links with embedded trackers
- **Admin Panel**: Register contracts and submit new torrent metadata

## Live Demo

Visit the live site: [GitHub Pages URL]

## Local Development

```bash
# Install dependencies
npm install

# Start local server
npm start

# Open http://localhost:8080
```

## Architecture

Built with vanilla JavaScript (ES6 modules) and the Dash Platform SDK:

- `index.html` - Browse interface
- `admin.html` - Admin panel for submissions
- `js/browse-*.js` - Browse page logic
- `js/admin-*.js` - Admin page logic
- `js/sdk-client.js` - Dash Platform SDK wrapper
- `js/utils.js` - Utility functions (magnet parsing, ID formatting)
- `js/contract-schema.js` - Data contract schema definitions

## Data Contract

The contract stores 5 document types:

| Type | Index Field | Description |
|------|-------------|-------------|
| movie | imdbId | Movies indexed by IMDB ID |
| tv | seriesImdbId | TV shows indexed by series IMDB ID |
| book | workId | Books indexed by OpenLibrary Work ID |
| iso | title | Software/ISOs indexed by title |
| other | title | Miscellaneous content indexed by title |

Each document includes: `infoHash`, `torrentName`, `trackers` (newline-separated), and `sizeBytes`.

## Configuration

Default configuration (in `js/browse-config.js`):
- Contract ID: `2UGyMaAc1bhk92gkvcpDLC4YvSd5q3SLhEZ1Vc4nqjwk`
- Network: `testnet`

## License

MIT License - see [LICENSE](LICENSE)
