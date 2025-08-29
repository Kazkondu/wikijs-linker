# Chrome Web Store – Data Disclosure Declaration

## Data Collection and Usage

### Personal Data Collection
- **Type**: User-provided data only
- **Data collected**: Wiki.js URL and API token (entered by user in extension options)
- **Purpose**: Application functionality (communication with user's own Wiki.js instance)
- **Storage**: Local storage only (chrome.storage.sync)

### Browsing Data Collection
- **Type**: Active tab information
- **Data collected**: Current page title and URL (only when user clicks "Add Link")
- **Purpose**: Create link cards in Wiki.js
- **Storage**: Not stored - transmitted directly to user's Wiki.js instance

### Data Sharing
- **Third-party sharing**: None
- **Data sale/rental/trading**: None
- **Analytics/advertising**: None

### Data Security
- **Transmission**: HTTPS recommended for Wiki.js communication
- **Local storage**: Encrypted by Chrome's storage API
- **Access control**: Only the extension can access its stored data

### User Control
- **Data deletion**: Users can clear data via extension options or by uninstalling
- **Data export**: Configuration can be exported/imported via extension options
- **Transparency**: All data handling is documented in source code (open source)

### Compliance Notes
- **GDPR**: No personal data processing beyond user-provided configuration
- **CCPA**: No sale of personal information
- **COPPA**: Not directed at children under 13

## Permissions Justification

| Permission | Purpose | Data Access |
|------------|---------|-------------|
| `storage` | Store user configuration locally | Wiki.js URL, API token, layout preferences |
| `activeTab` | Read current page info when saving links | Page title, URL, favicon |
| `scripting` | Inject live edit overlay (optional) | Page DOM (temporary, not stored) |
| `clipboardWrite` | Copy link HTML as fallback | Generated HTML (not personal data) |
| `notifications` | Show operation status | No data access |
| `tabs` | Access tab information | Active tab title/URL only |
| `host_permissions` | Connect to user's Wiki.js | Communication with user-specified domain only |

## Future Updates
If analytics or telemetry features are added in future versions, this disclosure will be updated and users will be notified through extension updates.

**Note**: This extension is open source. All data handling can be audited in the public GitHub repository.