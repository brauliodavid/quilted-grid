# Quilted Grid — Web Components

Custom elements for declarative authoring:

- <quilted-grid>
- <quilted-tile rows="2" cols="3">

## Install

`npm i quilted-grid`

## Register

import { register } from 'quilted-grid/element';
register();

## Usage
```html
<quilted-grid style="width:100%">
  <quilted-tile rows="2" cols="3">
    <img src="/a.jpg">
  </quilted-tile>
  <quilted-tile rows="1" cols="2">
    <img src="/b.jpg">
  </quilted-tile>
</quilted-grid>
```

## Tile attributes

- rows="N" (default 1)
- cols="N" (default 1)

Changing attributes dispatches tile-attrs-changed.

## Grid element API

```javascript
const grid = document.querySelector('quilted-grid');

grid.appendTile(tileEl);
grid.appendTileAt(tileEl, 1);
grid.removeTile(tileEl);
grid.removeTileAt(0);

grid.setData([{ rows:2, cols:3 }]);
grid.updateAt(0, { rows:1, cols:1 });
grid.removeAt(0);

grid.patchOptions({ gap: 8 });
grid.relayout();
grid.refresh();
```

## Events

- tile-click
- tile-removed

grid.addEventListener('tile-click', e => console.log(e.detail));

## Styling

Default classes:
- qg-root
- qg-tile

Override via patchOptions({ classNames: ... }) or your CSS.
