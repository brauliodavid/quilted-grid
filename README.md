# Quilted Grid — Core

A tiny JavaScript grid that lays out variable-span tiles using **dense CSS Grid**.

Use it two ways:

- **DOM-driven:** author tiles in HTML with `rows` / `cols` attributes; the grid adopts them.
- **Data-driven:** set `grid.tiles = [...]` or call `addTile(...)`.

---

## Install

npm i quilted-grid
# or
pnpm add quilted-grid
# or
yarn add quilted-grid

---

## Quick start (DOM-driven)

<!-- HTML -->
```html
<div id="grid">
  <div rows="2" cols="3"><img src="/a.jpg"></div>
  <div rows="1" cols="2"><img src="/b.jpg"></div>
</div>
```

<!-- JS/TS -->
```javascript
import { QuiltedGrid } from 'quilted-grid';

const el = document.getElementById('grid')!;
const grid = new QuiltedGrid(el, {
  cols: 4,
  rowHeight: 121,
  gap: 4,
  injectDefaultCSS: true
});

// Update a tile’s span (with FLIP animation)
grid.updateTileAt(0, { rows: 1, cols: 1 }, { animate: true });
```

NOTE: Attributes are `rows` and `cols` (not `data-rows` / `data-cols`).
---

## Quick start (Data-driven)

```javascript
import { QuiltedGrid, type QuiltedTile } from 'quilted-grid';

const data: QuiltedTile[] = [
  { rows: 2, cols: 3 },
  { rows: 1, cols: 2 },
];

const el = document.getElementById('grid')!;
const grid = new QuiltedGrid(el, { cols: 4, rowHeight: 121, gap: 4 });

// Populate via the tiles setter (creates wrappers and renders)
grid.tiles = data;

// Add more later (with enter transition)
grid.addTile({ rows: 1, cols: 1 }, { index: 1, animate: true });
```
---

## API

### Constructor
- el — container element (required)
- options — see QuiltedOptions

### QuiltedOptions

type QuiltedOptions = {
  cols: number | ((containerWidth: number) => number);
  rowHeight: number;
  gap: number;
  autoResize: boolean;
  injectDefaultCSS: boolean;
  classNames: { root: string; tile: string };
  onTileClick?: (e: { tile: QuiltedGridTile; index: number; event: MouseEvent }) => void;
  onTileRemove?: (e: { index: number; tile: QuiltedGridTile }) => void;
};

### Tile model

type QuiltedTile = {
  rows?: number;  // default 1
  cols?: number;  // default 1
  // ...custom fields are fine; only rows/cols affect layout
};

### Properties

- tiles: QuiltedGridTile[] — getter for current tile instances.
- tiles = QuiltedTile[] — setter that replaces the grid from models (clears container, rebuilds, then renders).

### Methods

- patchOptions(patch: Partial<QuiltedOptions>): void  
  Merge options and re-render.

- render(): void  
  Applies grid styles, reconciles child order, and updates spans.

- destroy(): void  
  Disconnects observers, clears DOM and tiles.

- addTile(tile: QuiltedTile, opts?: { index?: number; animate?: boolean }): QuiltedGridTile  
  Create + insert a new tile wrapper at `index` (default end). Enter transition when `animate !== false`.

- addTileElement(el: HTMLElement, opts?: { index?: number; animate?: boolean }): QuiltedGridTile  
  Adopt an existing element as a tile (reads its `rows` / `cols`), inserts at `index`.

- updateTileAt(index: number, patch: Partial<QuiltedTile>, opts?: { reflow?: boolean; animate?: boolean }): void  
  Updates a tile’s model and spans. If `animate` (default `true`), uses FLIP. If `reflow`, calls `render()` after.

- Advanced: createTileAt(index: number, data: QuiltedTile, opts?: { animate?: boolean }): QuiltedGridTile  
  Low-level constructor + insert. (Typically you want `addTile`.)

- removeTileAt(index: number, opts?: { animate?: boolean }): void  
  Removes a tile. If `animate` (default `true`), uses FLIP for the reflow.

- refresh(): void  
  Rebuilds from the current in-memory `_tiles`. Recreates wrappers from each tile’s model while preserving inner content by moving child nodes back into the new wrappers, then re-renders.

- animate(mutator: () => void, opts?: { duration?: number; easing?: string }): void  
  FLIP-animates any synchronous DOM mutation.

### Events

Callbacks (options):
- onTileClick({ tile, index, event })
- onTileRemove({ index, tile })

DOM CustomEvents (emitted):
- tileClick — dispatched from the tile wrapper on click.
- tileRemoved — dispatched from the grid when a tile is removed.

Command event (listened by the grid):
- Dispatch `new CustomEvent('removeTile', { detail: { index, animate } })` on the grid element to remove a tile imperatively.

### Default CSS classes

- qg-root — container
- qg-tile — tile wrapper
- Enter transition hooks used by inserts:
  - qg-enter
  - qg-enter-active

With `injectDefaultCSS: true`, minimal defaults (including the enter transition) are injected automatically.

---

## Notes

- Responsive columns: pass a function to `cols` to compute based on container width.
- DOM-driven adoption: the grid reads `rows` / `cols` attributes from your existing children and turns them into tiles.
- Attributes kept in sync: when a tile updates, its `rows` and `cols` attributes are updated on the wrapper for observability/debugging.
