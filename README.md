# Code Formatter Extension

A browser extension that formats source code directly in the browser with syntax highlighting, line numbers, collapsible sections, and multiple formatter backends.

Works on any webpage showing source code. Automatically detects and formats:

- **Web**: JavaScript, TypeScript, JSX, TSX, CSS, SCSS, LESS, HTML, JSON
- **Backend**: Python, Go, Rust, Java, C#, C++, PHP
- **Data**: YAML, TOML, SQL, XML
- **DevOps**: Dockerfile, Makefile, .env

## Features

### Formatting

- **Format on Save** — `Ctrl+S` / `Cmd+S` formats the current code
- **Batch Format** — `Ctrl+Shift+B` formats all code blocks on the page
- **Format Selection** — highlight code and format just that section
- **Format on Paste** — auto-formats pasted code (configurable minimum length)
- **Format on Type** — formats as you type with 500ms delay (optional)

### Multiple Formatter Backends

- **Prettier** — default formatter for web languages, Python
- **js-beautify** — alternative formatter for web languages
- **Biome** — fast formatter for JavaScript, TypeScript, JSON, CSS (WASM-based)
- **Ruff** — Python formatter (WASM-based)
- **Gofmt** — Go formatter (WASM-based)
- **SQL Formatter** — SQL formatting (WASM-based)
- **YAML Formatter** — YAML formatting (WASM-based)
- **TOML Formatter** — TOML formatting (WASM-based)

Choose your preferred formatter per language in Settings.

### Editor

- Syntax highlighting with 10 built-in themes (Monokai, Material, Dracula, Nord, GitHub Dark/Light, Solarized Dark/Light, Tokyo Night, One Dark Pro)
- Line numbers
- Collapsible code sections
- Search in editor (`Ctrl+F`)
- Word wrap toggle
- Configurable font size and line height
- Drag and drop file support

### Toolbar

- Open file button
- Theme selector dropdown
- Collapse/Expand all sections
- Show original code toggle
- Search bar
- Batch format all blocks
- Copy to clipboard
- Download formatted file
- Print formatted code

### Language Detection

- Auto-detects language from file extension
- Special filename handling (Dockerfile, Makefile, .env, .eslintrc, .babelrc, etc.)
- Context menu for manual language selection

### Other

- Works offline and online
- Supports local files (`file://` URLs)
- Lightweight and fast
- Open source and free
- No user data collected
- Click extension icon to open Settings

## Installation

### Chrome

1. Clone this repo
2. Run `npm install && npm run build`
3. Open `chrome://extensions`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the project folder

### Firefox

1. Clone this repo
2. Run `npm install && npm run build`
3. Open `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on" and select `manifest.json`

## Development

| Command | Description |
|---------|-------------|
| `npm run build` | Full build (TypeScript + CSS) |
| `npm run dev` | Watch mode |
| `npm run test` | Run tests |
| `npm run lint` | Lint TypeScript |

## Permissions

- `scripting` — inject content scripts for formatting
- `tabs` — track active tab for context menus
- `storage` — persist user settings
- `contextMenus` — right-click format options

## License

MIT
