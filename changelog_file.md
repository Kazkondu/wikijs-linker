# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.67] - 2025-08-29

### Added
- Complete English translation for international users
- Apache 2.0 license with proper copyright headers
- Comprehensive documentation for open source release
- Professional README with installation and usage guides
- File structure documentation and API integration details

### Changed
- All user interface text translated from German to English
- Updated manifest to version 1.67 with broader host permissions
- Improved code comments and documentation in English
- Enhanced error messages for better user experience

### Fixed
- Content Security Policy compliance for extension stability
- Storage access patterns optimized for Manifest V3
- GraphQL error handling consistency across all files

## [1.0.1] - 2025-08-28

### Fixed
- GraphQL mutation error with tag object handling
- Improved storage handling in live_edit.js
- Added fallback for clipboard save functionality
- Enhanced dropdown styling for better readability

### Security
- Fixed Content Security Policy violations in live edit overlay
- Improved inline script handling for extension pages

## [1.0.0] - 2025-08-20

### Added
- Initial public release
- Core bookmark saving and live edit functionality
- Multi-container layout system with 1-4 column support
- Category management with three layout types (cards, compact, large)
- Demo template with pre-built examples
- Configuration import/export functionality
- Reset functions for link and page management
- Real-time Wiki.js integration via GraphQL API

### Features
- One-click link addition from any webpage
- Structured organization with containers and categories
- Live editing overlay for direct Wiki page modification
- Smart tab detection with automatic favicon extraction
- Responsive design for different screen sizes
- Error handling with clipboard fallback
- Chrome storage synchronization

### Technical
- Manifest V3 compliance
- Service worker architecture
- Promise-based storage with timeout handling
- Content script injection for live editing
- GraphQL integration with robust error handling