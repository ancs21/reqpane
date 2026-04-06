# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Reqpane - a Chrome extension for capturing API calls, detecting errors, and exporting debug info. Built with React 19, Base UI components, and Tailwind CSS v4 using Chrome Manifest V3.

## Commands

```bash
bun run dev      # Watch mode - rebuilds on file changes
bun run build    # Production build to dist/
bun run zip      # Build + create reqpane.zip for Chrome Web Store
```

## Loading in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist` folder

## Architecture

### Script Execution Flow
```
background.js (service worker + CDP) → App.tsx (side panel)
content.js (content script) — DOM search/highlight only
```

- **background.js**: Service worker. Uses `chrome.debugger` API (CDP) to capture network requests via Network domain, intercept/mock via Fetch domain, and capture console errors via Runtime domain. Stores requests per tab (Map), manages mock/breakpoint rules via `chrome.storage.local`. Attaches debugger when side panel opens (via port), detaches on close.
- **content.js**: Content script for DOM field search/highlight feature only. No network capture role.
- **App.tsx**: React side panel UI. Opens a `chrome.runtime.connect` port on mount to trigger debugger attach. Displays requests, handles filtering/export, manages UI state for settings, mocks, breakpoints, sessions. Shows debugger status and breakpoint notification banners.

### File Structure
```
src/sidepanel/
├── App.tsx              # Main component, all feature state management
├── types.ts             # TypeScript interfaces (ApiRequest, MockRule, etc.)
├── components/          # UI components organized by feature
│   ├── common/          # TabButton, FilterButton, CodeCopyBlock
│   ├── requests/        # RequestRow
│   ├── detail/          # RequestDetail (bottom sheet)
│   ├── json/            # JsonTreeView, JsonTreeNode
│   ├── console/         # ConsoleErrorRow, ConsoleErrorDetail
│   ├── mocks/           # MockManager, MockRuleEditor
│   ├── breakpoints/     # BreakpointManager, BreakpointRuleEditor
│   ├── sessions/        # SessionHistory
│   ├── settings/        # SettingsPanel
│   └── views/           # TimelineView, GroupedView, DiffDialog
├── hooks/               # Custom hooks (useFieldUsage)
└── utils/               # Export generators (HAR, Postman, Claude prompt)

public/
├── manifest.json        # Extension manifest v3
├── background.js        # Service worker (CDP-based capture)
├── content.js           # Content script (DOM search/highlight only)
└── icons/               # SVG icons
```

## Key Technical Details

- **Vite config**: Uses `@tailwindcss/vite` plugin (not PostCSS) for Tailwind v4. Flat output naming (`[name].js`) for extension compatibility.
- **CDP domains**: Network (passive capture), Fetch (mock/breakpoint interception), Runtime (console errors). No Runtime.evaluate calls.
- **Message types**: `NEW_API_REQUEST`, `NEW_CONSOLE_ERROR`, `GET_API_REQUESTS`, `CLEAR_API_REQUESTS`, `DEBUGGER_STATUS`, `BREAKPOINT_REQUEST_PAUSED`, `RESUME_PAUSED_REQUEST`, `SAVE_MOCK_RULES`, `SAVE_BREAKPOINT_RULES`, etc.
- **Port signaling**: Side panel opens `chrome.runtime.connect({ name: 'sidepanel' })` port to trigger debugger attach; port disconnect triggers detach.
- **Storage keys**: `mockRules`, `breakpointRules`, `favorites`, `sessions`, `session_${id}`, `darkMode`, `fontSize`
- **Request limits**: 100 requests per tab, 50 console errors per tab, 5MB max response body size
- **CSS theming**: Uses CSS custom properties in `@theme` block. Dark mode via `html.dark` class.

## Chrome Extension Permissions

- `sidePanel`, `activeTab`, `tabs`, `storage` - Core functionality
- `debugger` - Chrome DevTools Protocol access for network capture (shows yellow infobar)
- `scripting` - Re-inject content scripts on install/update
- `clipboardWrite` - Copy to clipboard feature
- `<all_urls>` host permission - Capture requests from any page

## Design Guidelines

When building UI, follow the frontend-design skill guidelines:
- Choose distinctive fonts (avoid Inter, Roboto, Arial)
- Use bold color choices with sharp accents
- Add motion and micro-interactions
- Create atmosphere with backgrounds and visual details
