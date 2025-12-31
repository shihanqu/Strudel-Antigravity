# Strudel Antigravity 🎹✨

A powerful VS Code extension for live-coding music with [Strudel](https://strudel.cc), the JavaScript port of TidalCycles.

> **Fork Notice**: This is a significantly enhanced fork of [strudel-vscode](https://codeberg.org/cmillsdev/strudel-vscode.git) by cmillsdev. See [What's New](#whats-new-in-this-fork) for details.

![Strudel Antigravity Demo](images/demo.gif)

## Features

- 🎵 **Full Strudel Engine** — Complete audio synthesis and sampling, running entirely in VS Code
- 🎹 **Csound Integration** — Load and use Csound orchestras for advanced synthesis
- ✨ **Live Hap Highlighting** — See your code light up in sync with the music
- 🎨 **Responsive Control Panel** — Play, stop, and record with a sleek UI
- 🎧 **Audio Recording** — Record your sessions directly to WebM audio files
- 📝 **Syntax Highlighting** — Full support for `.strudel` and `.str` files
- ⌨️ **Keyboard Shortcuts** — `Cmd+Enter` to play, `Cmd+.` to stop

## Installation

### From VSIX (Recommended)
```bash
code --install-extension strudel-repl.vsix --force
```

### Build from Source
```bash
git clone https://github.com/shihanqu/Strudel-Antigravity.git
cd Strudel-Antigravity
npm install
npm run build:all
npx vsce package -o strudel-repl.vsix
code --install-extension strudel-repl.vsix --force
```

## Quick Start

1. Create a new file with `.strudel` extension
2. Write your first pattern:
   ```javascript
   s("bd sd hh sd").bank("RolandTR909")
   ```
3. Press `Cmd+Enter` (Mac) or `Ctrl+Enter` (Windows/Linux) to play
4. The Strudel Control panel will open automatically
5. Toggle the **Audio Engine** switch to connect

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Play/Update pattern |
| `Shift + Cmd/Ctrl + Enter` | Play selection only |
| `Cmd/Ctrl + .` | Stop playback |

## What's New in This Fork

This fork includes significant enhancements over the original:

### 🎹 Csound Support
- Full integration with `@strudel/csound`
- Load Csound orchestras with `await loadOrc('...')`
- Use `.csound("InstrumentName")` for advanced synthesis

### ✨ Live Hap Highlighting
- Real-time code highlighting synchronized to the music
- Works with all sound sources including Csound instruments
- Visual feedback shows exactly which code is triggering

### 🎨 Responsive UI
- Control panel adapts to narrow side panels
- Buttons stack vertically when space is limited
- Clean, modern gradient design

### 🔧 Enhanced Sound Engine
- **ZZFX Synths**: `z_sine`, `z_sawtooth`, `z_triangle`, `z_square`, `z_noise`
- **Supersaw**: Rich, detuned saw waves for pads
- **All Soundfonts**: Full General MIDI instrument library
- **Sample Libraries**: Dirt-Samples, TR-808, TR-909, and more

### 🐛 Bug Fixes
- Fixed Csound timing errors (negative p2)
- Fixed "sound not found" for ZZFX synths
- Fixed scheduling issues with heavy patterns
- Improved audio engine stability

## Build Scripts

```bash
# Install dependencies
npm install

# Build extension host (TypeScript)
npm run build

# Build Strudel engine bundle
npx esbuild static/strudel.js --bundle --outfile=dist/strudel.js --target=es2021 --format=esm

# Build everything and package
npm run build:all
npx vsce package
```

## Project Structure

```
├── src/                    # Extension TypeScript source
│   └── extension.ts        # Main extension entry point
├── static/                 # Strudel engine source
│   └── strudel.js          # Audio engine and UI logic
├── dist/                   # Built bundles (gitignored)
├── assets/                 # Extension icons
├── examples/               # Sample .strudel files
├── syntaxes/               # Syntax highlighting grammars
├── package.json            # Extension manifest & dependencies
└── README.md               # This file
```

## Dependencies

- [@strudel/core](https://www.npmjs.com/package/@strudel/core) — Pattern engine
- [@strudel/mini](https://www.npmjs.com/package/@strudel/mini) — Mini-notation parser
- [@strudel/webaudio](https://www.npmjs.com/package/@strudel/webaudio) — Web Audio synthesis
- [@strudel/tonal](https://www.npmjs.com/package/@strudel/tonal) — Music theory utilities
- [@strudel/soundfonts](https://www.npmjs.com/package/@strudel/soundfonts) — General MIDI sounds
- [@strudel/transpiler](https://www.npmjs.com/package/@strudel/transpiler) — Code transpilation
- [@strudel/csound](https://www.npmjs.com/package/@strudel/csound) — Csound integration

## Credits

- **Original Extension**: [cmillsdev/strudel-vscode](https://codeberg.org/cmillsdev/strudel-vscode)
- **Strudel**: [strudel.cc](https://strudel.cc) by Felix Roos and contributors
- **TidalCycles**: [tidalcycles.org](https://tidalcycles.org) by Alex McLean

## License

AGPL-3.0-or-later — See [LICENSE](LICENSE) for details.

---

Made with 💜 by the Antigravity team
