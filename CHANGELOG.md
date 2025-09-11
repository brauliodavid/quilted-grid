## [Unreleased]

### Added
- **DOM-driven authoring** via custom elements: `<quilted-grid>` + `<quilted-tile>`.
  - Grid auto-bootstraps from existing child tiles on connect.
  - Live sync of child attribute changes via `tile-attrs-changed` → parent calls `updateTileAt(...)`.
  - Child add/remove handled with a `MutationObserver`.
- **Element API** on `<quilted-grid>` wrapper: `appendTile(...)`, `appendTileAt(index, ...)`, `removeTile(el)`, `removeTileAt(index)`.
- **Core API**: `QuiltedGrid.addTileElement(el, { index?, animate? })` to adopt an existing DOM tile.
- **React wrappers**:
  - `<QuiltedGrid />` (DOM-driven when children are present; data-driven otherwise) with `QuiltedGridRef` exposing the live `grid`.
  - `<QuiltedTile />` helper that emits `rows/cols` **and** `data-rows/data-cols` (works with `readInt`).
- **Tile update pipeline**: `QuiltedGridTile.update(patch?)` to reflect spans, attributes, and (when provided) image properties.
```html
CDN:
<script src="https://cdn.jsdelivr.net/npm/quilted-grid/dist/index.global.js" defer></script>
```

### Changed
- **Attribute reader**: `readInt(el, name, fallback)` now checks plain attributes (`rows/cols`) first, then `dataset`, then `data-*`.
- **Tile application**: `applyTile(...)` delegates to `update(...)`, ensuring spans and image state are kept in sync for both model- and element-created tiles.
- **Method names clarified** in core for symmetry: `updateTileAt(...)`, `removeTileAt(...)`, `createTileAt(...)`.

### Fixed
- **Rows/cols not applied** for DOM children:
  - Properly parse `rows/cols` from attributes and apply correct `grid-row`/`grid-column` spans.
  - Avoid double-adoption of initial children (bootstrap handled only inside `QuiltedGrid.bootstrapFromDOM()`).
- **React children wiped on init**: grid instance is created once after children commit; no destroy/recreate loop tied to `children`, so React DOM remains intact.

### Deprecated
- None.

### Removed
- None.

### Security
- None.
