# Quilted Grid — React

Ergonomic React bindings for the core grid.

- DOM-driven when you provide children.
- Data-driven when you pass a `data` array.
- Ref exposes the live core instance.

## Install
`npm i quilted-grid`

## Quick start (DOM-driven)

```javascript
import { useRef } from 'react';
import { QuiltedGrid, QuiltedTile, type QuiltedGridRef } from 'quilted-grid/react';

export default function Demo() {
  const ref = useRef<QuiltedGridRef>(null);

  return (
    <QuiltedGrid
      ref={ref}
      options={{ cols: 4, rowHeight: 121, gap: 4, injectDefaultCSS: true }}
      style={{ width: '100%' }}
    >
      <QuiltedTile rows={2} cols={3}>
        <img src="/a.jpg" />
      </QuiltedTile>
      <QuiltedTile rows={1} cols={2}>
        <img src="/b.jpg" />
      </QuiltedTile>
    </QuiltedGrid>
  );
}
```

## Quick start (Data-driven)

```javascript
import { QuiltedGrid } from 'quilted-grid/react';
import type { QuiltedTile as QT } from 'quilted-grid';

const data: QT[] = [{ rows: 2, cols: 3 }, { rows: 1, cols: 2 }];

<QuiltedGrid
  data={data}
  options={{ cols: 4, rowHeight: 121, gap: 4 }}
/>;
```

## API

<QuiltedGrid />
Props:
- data?: QT[]
- options?: Partial<Options>
- className, style, etc.

Ref:
type QuiltedGridRef = { readonly grid: QG | null }

Props:
- rows?: number
- cols?: number
- Any DOM props (className, onClick, etc.)

## Imperative usage
```javascript
const ref = useRef<QuiltedGridRef>(null);
ref.current?.grid?.addTile({ rows: 1, cols: 2 });
```

## Events

Use core callbacks:
```javascript
<QuiltedGrid options={{ onTileClick: ({ index }) => console.log(index) }} />
```

Or attach React onClick to `<QuiltedTile />` nodes.
