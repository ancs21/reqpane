<p align="center">
  <img src="public/icons/icon128.png" alt="Reqpane icon" width="128" height="128">
</p>

# Reqpane

Chrome extension for capturing API calls, detecting errors, and debugging network requests directly from the browser side panel.

<p align="center">
  <img src="public/screenshot.png" alt="Reqpane screenshot" width="400">
</p>

## Features

### Request Capture
- Intercepts all `fetch` and `XMLHttpRequest` calls
- Captures request/response headers and bodies
- Tracks request duration and status codes
- Console error capture (errors, unhandled rejections, console.error)
- Auto-select mode to automatically focus on new requests

### Filtering & Search
- Filter by: All, Errors (4xx/5xx), Slow (>1s), Console errors
- URL pattern filtering
- Body content search (searches request and response bodies)

### View Modes
- **List** - Chronological request list
- **Timeline** - Visual timeline with duration bars
- **Grouped** - Organized by domain

### Request Comparison
- Select two requests to compare side-by-side
- Visual diff of headers, bodies, and metadata

### Mock Responses
- Define mock rules with URL patterns and HTTP methods
- Return custom status codes and response bodies
- Enable/disable rules on the fly

### Breakpoints
- Pause requests before they're sent
- Continue or cancel requests from an overlay
- Pattern-based URL matching

### Load Testing
- Replay any captured request multiple times (1-100 iterations)
- Configurable concurrency (1-10 parallel requests)
- Adjustable delay between batches and timeout settings
- Real-time progress with success/failure tracking
- Detailed statistics: avg/min/max/median/p95/p99 response times
- Latency distribution histogram
- Requests per second throughput metrics
- Error grouping and analysis
- Save and view test history

### Field Usage Detection
- Scan page DOM to find where API response values are used
- Highlight elements using specific field values
- Helps understand data flow from API to UI

### Export Options
- **HAR** - Standard HTTP Archive format
- **Postman** - Import directly into Postman collections
- **Claude prompt** - Formatted for AI debugging assistance
- **Markdown Report** - Comprehensive debugging report
- **Sessions** - Save and restore request history

### Settings
- Dark mode
- Adjustable font size (small/medium/large)
- Favorites for frequently accessed requests

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Build the extension:
   ```bash
   bun run build
   ```
4. Load in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

## Development

```bash
bun run dev      # Watch mode - rebuilds on file changes
bun run build    # Production build
bun run zip      # Build + create zip for Chrome Web Store
```

## Tech Stack

- React 19
- TypeScript
- Tailwind CSS v4
- Base UI components
- Vite
- Chrome Manifest V3
