# Changelog
All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.2] - 2025-11-15
### Fixed
- Preserve the Strudel panel when hiding the VS Code Side Bar and maintain the running audio engine across show/hide cycles.
- Replace the old connect/disconnect buttons with an `Audio Engine` toggle that properly handles connect/disconnect state, avoiding overlapping UI and accidental double-disconnects.
- Show the “connect audio” warning only when a user tries to play without enabling the audio engine.
### Added
- Document prior project authorship in the README.
- Recognize both `.strudel` and `.sdt` Strudel document extensions throughout the extension.

## [1.0.0] - 2025-11-14
### Added
- Initial release under new maintainer.
- Updated Strudel engine to modern `@strudel/*` 1.2.x packages.
- Implemented full sample prebake loading (Dirt-Samples, Drum Machines, VCSL, SP12, Piano, etc.).
- Added `$:` syntax support using the official Strudel transpiler.
- Improved audio initialization flow for more reliable playback.
- Cleaned status reporting between webview and VS Code.
- Updated branding, package metadata, and extension identifiers.
- Refreshed README and documentation.

### Changed
- Rewrote the webview audio loader for stability.
- Migrated repository links, publisher ID, and extension metadata.
- Consolidated logging into a dedicated “Strudel” output channel.

### Removed
- Deprecated or unused legacy code paths from the original fork.

---
## 0.2.1

- add context menu entry to load a tune example
- convert to a web extension
- several fixes
- refactoring

## 0.2 (beta)

- rename *Tidal Strudel* to avoid confusion with other extensions
- improve status bar
- add *play selection* option in context menu
- improve Strudel view to better show the piano roll
- load default sound files
- make file extension customisable via VSCode IDE (`.strudel` and `.str` by default)
- improve docs
- switch to agpl3 license
- some refactoring

## 0.1 (alpha)

- play active document
- show Strudel UI (including pianoroll) in a view (aka sidebar) instead a panel
- add buttons bar
- add logger
- add status bar
- add syntax highlighting
- setup a build workflow
- publish on VSCode marketplace

## 0.0.1 (prototype)

- display the Strudel repl in a webview panel that can play music
