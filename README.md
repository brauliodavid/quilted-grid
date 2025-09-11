# Quilted Grid — Core

A tiny JavaScript grid that lays out variable-span tiles in a dense CSS Grid.
Use it two ways:

- DOM-driven: author tiles in HTML and let the grid adopt them.
- Data-driven: pass an array of tile models.

## Install

npm i quilted-grid
# or pnpm add quilted-grid / yarn add quilted-grid

## Quick start (DOM-driven)

<div id="grid">
  <div data-rows="2" data-cols="3"><img src="/a.jpg"></div>
  <div data-rows="1" data-cols="2"><img src="/b.jpg"></div>
</div>

import { QuiltedGrid } from 'quilted-grid';

const el = document.getElementById('grid')!;
const grid = new QuiltedGrid(el, [], {
  cols: 4,
  rowHeight: 121,
  gap: 4,
  injectDefaultCSS: true
});

## Quick start (Data-driven)

import { QuiltedGrid, type QuiltedTile } from 'quilted-grid';

const data: QuiltedTile[] = [
  { rows: 2, cols: 3 },
  { rows: 1, cols: 2 },
];

const el = document.getElementById('grid')!;
const grid = new QuiltedGrid(el, data, { cols: 4, rowHeight: 121, gap: 4 });

## API

new QuiltedGrid(el, data?, options?)

- el: HTMLElement (required)
- data?: QuiltedTile[]
- options?: QuiltedOptions

BaseOptions:
- cols: number | (width:number)=>number
- rowHeight: number
- gap: number
- autoResize: boolean
- injectDefaultCSS: boolean
- classNames: { root: string; tile: string }
- onTileClick?: (e: { tile: QuiltedTile; index: number; event: MouseEvent })
- onTileRemove?: (e: { index: number; tile: QuiltedTile })

Tile model:
type QuiltedTile = { rows?: number; cols?: number; ... }

Methods:
- setData(data)
- patchOptions(patch)
- render()
- destroy()
- addTile(tile, opts)
- addTileElement(el, opts)
- updateTileAt(index, patch, opts)
- removeTileAt(index, opts)
- animate(mutator, opts)

Events:
- tileClick (CustomEvent)
- tileRemoved (CustomEvent)

Default CSS classes:
- qg-root (container)
- qg-tile (tile)
