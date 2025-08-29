# Wiki.js Linker Chrome Extension

A powerful Chrome extension that allows you to organize and add links from any webpage to your Wiki.js installation with advanced container and category management.

## Features

- **One-Click Link Addition**: Add the current webpage as a link card to your Wiki.js page
- **Advanced Organization**: Multi-container layout system with 1-4 column support
- **Multiple Layout Types**: Cards, compact list, and large preview layouts for categories
- **Live Editing**: Direct Wiki page modification with overlay interface
- **Configuration Management**: Import/export settings and structures
- **Demo Template**: Pre-built example layout to get started quickly
- **Smart Favicon Detection**: Automatic extraction of website icons
- **GraphQL Integration**: Robust Wiki.js API integration with error handling

## Installation

### From Chrome Web Store
*Coming soon*

### Manual Installation
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Setup

### 1. Wiki.js Configuration
1. In your Wiki.js admin panel, go to **API Access**
2. Create a new API key with appropriate permissions
3. Note your GraphQL endpoint (usually `/graphql`)

### 2. Extension Configuration
1. Right-click the extension icon and select "Options"
2. Enter your configuration:
   - **GraphQL Endpoint**: Your Wiki.js GraphQL URL
   - **API Token**: The bearer token from Wiki.js
   - **Page ID**: The ID of the page where links should be added
   - **Locale**: Language code (e.g., "en")

3. Click "Test Connection" to verify everything works
4. Click "Save" to store your settings

### 3. Finding Page ID
In Wiki.js, navigate to your target page and look at the page details - the ID appears in the top left corner.

## Usage

### Quick Start with Demo
1. Click the extension icon
2. Click "Load Demo" to create a sample layout
3. The demo creates containers and categories you can immediately use

### Adding Links
1. Navigate to any webpage you want to save
2. Click the extension icon
3. Select a container and category (or create new ones)
4. Click "Add Link"

### Creating Structure

#### Containers
Containers are top-level sections that define column layouts:
- **1 Column**: Full-width layout
- **2 Columns**: Split layout
- **3 Columns**: Triple column layout
- **4 Columns**: Quad layout (desktop only)

#### Categories
Categories are sections within containers with three layout types:
- **Cards**: Standard link cards with title and URL
- **Compact**: Dense list view
- **Large**: Preview images with content

### Live Editing
1. Navigate to your Wiki.js page
2. Click the extension icon
3. Click "Live Edit" 
4. Use the overlay interface to add categories directly on the page

### Management Functions
- **Reset Wiki**: Removes all links but keeps structure
- **Clear Wiki**: Completely empties the page
- **Export Config**: Download your settings as JSON
- **Import Config**: Load previously saved settings

## File Structure

```
wiki-linker-extension/
├── manifest.json          # Extension manifest
├── popup.html             # Main interface
├── popup.js               # Core functionality
├── options.html           # Configuration page
├── options.js             # Settings management
├── background.js          # Service worker
├── live_edit.js           # Live editing overlay
├── reset-functions.js     # Reset/clear functions
├── demo-template.js       # Demo template generator
├── styles.css             # Shared styles
└── LICENSE                # Apache 2.0 license
```

## API Integration

### GraphQL Queries Used

#### Page Loading
```graphql
query GetPage($id: Int!) {
  pages {
    single(id: $id) {
      id path title editor content
      description isPrivate isPublished locale
      tags { id tag title }
      createdAt updatedAt
    }
  }
}
```

#### Page Updates
```graphql
mutation UpdatePage($id: Int!, $content: String!, ...) {
  pages {
    update(id: $id, content: $content, ...) {
      responseResult { succeeded errorCode message }
      page { id updatedAt }
    }
  }
}
```

## HTML Structure

The extension generates semantic HTML for Wiki.js:

### Container Structure
```html
<div class="layout-container layout-3col" id="development-container">
  <!-- Container content -->
</div>
```

### Category Structure
```html
<section class="section-card accent-blue" id="webdev-section">
  <header class="section-card__header">
    <div class="section-card__title">Web Development</div>
    <div class="section-card__meta">Tools and resources</div>
  </header>
  <div class="links">
    <!-- Link cards here -->
  </div>
</section>
```

### Link Cards
```html
<a class="linkcard" href="..." target="_blank" rel="noopener">
  <img src="..." alt="">
  <div>
    <div class="title">Site Title</div>
    <div class="url">domain.com</div>
  </div>
</a>
```

## Configuration Export/Import

### Export Format
```json
{
  "version": "1.67",
  "exportDate": "2025-01-01T00:00:00.000Z",
  "config": {
    "endpoint": "https://wiki.example.com/graphql",
    "token": "bearer-token",
    "locale": "en",
    "pageId": "123",
    "containers": [...],
    "categories": [...]
  }
}
```

## Troubleshooting

### Common Issues

**"Connection failed"**
- Verify your GraphQL endpoint URL
- Check that your API token has sufficient permissions
- Ensure the Wiki.js instance is accessible

**"Page not found"**
- Confirm the page ID exists in your Wiki.js
- Check that the page is not deleted or moved

**"Storage not available"**
- Restart Chrome
- Check extension permissions
- Try reinstalling the extension

**Extension popup doesn't open**
- Disable other conflicting extensions
- Check Chrome console for errors
- Use the options page as fallback

### Debug Mode
Enable debug logging by setting `DEBUG = true` in the source files.

## Development

### Prerequisites
- Chrome browser
- Basic understanding of Chrome extensions
- Wiki.js instance for testing

### Local Development
1. Clone the repository
2. Make changes to source files
3. Reload extension in Chrome
4. Test with your Wiki.js instance

### Testing
- Test with different Wiki.js configurations
- Verify all layout types work correctly
- Check error handling with invalid inputs
- Test import/export functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

Please ensure:
- Code follows existing patterns
- All features are documented
- Error handling is implemented
- GraphQL compatibility is maintained

## Changelog

See [CHANGELOG.md](changelog_file.md) for version history.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](license_file.md) file for details.

Copyright (c) 2025 Adem Kazkondu

## Support

For support, please:
1. Check this documentation
2. Review troubleshooting section
3. Check existing issues on GitHub
4. Create a new issue if needed

---

**Made with ❤️ for the Wiki.js community**