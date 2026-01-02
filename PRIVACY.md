# Reqpane Privacy Policy

Last updated: January 2, 2025

Reqpane is a browser extension for developers to debug API calls.

## Data Collection

This extension does **NOT** collect, store, or transmit any personal data to external servers. All captured network request data remains entirely local to your browser.

## Local Storage

The extension stores the following data locally on your device:

- **Captured API requests** - Temporary, stored per tab and cleared on navigation
- **Console errors** - Temporary, stored per tab
- **User preferences** - Dark mode, font size settings
- **Mock response rules** - Custom rules you create for mocking API responses
- **Breakpoint rules** - Custom rules for pausing requests
- **Saved sessions** - Request history you explicitly save
- **Load test history** - Results from load tests you run
- **Favorites** - Requests you mark as favorites

This data never leaves your browser and is not accessible to the extension developer or any third party.

## No Analytics or Tracking

Reqpane does not include any analytics, telemetry, or tracking code. We do not collect usage statistics or any other information about how you use the extension.

## No External Connections

The extension does not make any network requests to external servers owned by us. The only network activity is:

- Replaying API requests you explicitly trigger (load testing feature)
- The original network interception to capture requests from websites you visit

## Permissions

The extension requires certain browser permissions to function:

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Display the debugging UI in Chrome's side panel |
| `activeTab` | Read current tab URL and title for request context |
| `tabs` | Detect tab changes to show correct requests per tab |
| `storage` | Save preferences, mock rules, and session history locally |
| `scripting` | Re-inject content scripts when extension updates |
| `clipboardWrite` | Copy request data to clipboard |
| `<all_urls>` | Capture API requests from any website you visit |

## Data Retention

- Tab-specific data (requests, console errors) is cleared when you close the tab or navigate away
- Saved sessions are stored until you manually delete them
- Preferences persist until you change them or uninstall the extension

## Your Control

You have full control over your data:

- Clear all captured requests with the "Clear" button
- Delete saved sessions individually or clear all
- Delete load test history
- Uninstalling the extension removes all stored data

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last updated" date at the top of this document.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.
