# wikijs-linker
A Chrome extension to save the current page as a structured link card in Wiki.js. Supports categories, i18n, and optional Live Edit via GraphQL 

# Wiki.js Linker (by ID)

Adds the current page as a link card to a Wiki.js page (GraphQL, Page ID).

> Manifest version: 3 · Current version: 1.67

## Features
- One-click: save current tab as **link card** to Wiki.js
- **Containers / categories**
- **i18n**
- **Live Edit** via GraphQL (optional)
- **Copy to Clipboard** helper

## Requirements
- Running **Wiki.js** with GraphQL endpoint (`/graphql`)
- API token with necessary permissions

## Install from source
1. Clone this repo or unzip the release
2. Chrome → Extensions → Enable **Developer mode**
3. **Load unpacked** → select the folder

## Permissions
See `manifest.json`. Keep host permissions as tight as possible (your wiki domain only).

## Privacy
See `PRIVACY.md`.

## License
Apache License 2.0 – see `LICENSE`.
