import React, {
  forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef
} from "react";
import { QuiltedGrid as QG } from "quilted-grid";
import type { QuiltedOptions } from "quilted-grid";

export type QuiltedGridRef = { readonly grid: QG | null };
export type QuiltedGridProps = React.HTMLAttributes<HTMLDivElement> & {
  options?: QuiltedOptions;
};
export type QuiltedTileProps = React.HTMLAttributes<HTMLDivElement> & {
  rows?: number; cols?: number;
};

export const QuiltedGrid = forwardRef<QuiltedGridRef, QuiltedGridProps>(
  ({ options, className, style, children, ...rest }, ref) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<QG | null>(null);
    const inited = useRef(false);

    // init core once
    useLayoutEffect(() => {
      if (inited.current) return;
      inited.current = true;
      const host = hostRef.current!;
      gridRef.current = new QG(host, options ?? {});
      return () => {
        gridRef.current?.destroy();
        gridRef.current = null;
      };
    }, []);

    // keep options hot
    useEffect(() => {
      if (options) gridRef.current?.patchOptions(options);
    }, [options]);

    // *** KEY PART: reconcile after every render that changes children ***
    useLayoutEffect(() => {
      const host = hostRef.current;
      const grid = gridRef.current;
      if (!host || !grid) return;

      const els = Array.from(host.children) as HTMLElement[];

      // 1) Adopt any new child (not yet owned) in visual order
      els.forEach((node, visualIndex) => {
        const ownedIdx =
          ((grid as any).tiles?.findIndex((t: any) => t?.el === node) ?? -1);
        if (ownedIdx === -1) {
          grid.addTileElement(node, { index: visualIndex, animate: true });
        } else if (ownedIdx !== visualIndex) {
          // 2) Keep tile order in sync with DOM order
          const tiles = (grid as any).tiles as any[];
          const [tile] = tiles.splice(ownedIdx, 1);
          tiles.splice(visualIndex, 0, tile);
          tiles.forEach((t, i) => t.setIndex(i));
        }
      });

      // 3) Remove tiles whose element is no longer a direct child
      const tiles = ((grid as any).tiles as any[]) || [];
      for (let i = tiles.length - 1; i >= 0; i--) {
        if (tiles[i].el.parentElement !== host) {
          grid.removeTileAt(i, { animate: false });
        }
      }

      // ⚠️ NEW: 4) PATCH SPANS when rows/cols change later
      const patches: Array<{ i: number; rows: number; cols: number }> = [];
      els.forEach((el, i) => {
        const rows =
          parseInt(el.getAttribute("data-rows") || "1", 10) || 1;
        const cols =
          parseInt(el.getAttribute("data-cols") || "1", 10) || 1;
        const d = tiles[i]?.getData?.();
        if (!tiles[i] || !d) return;
        if (d.rows !== rows || d.cols !== cols) {
          patches.push({ i, rows, cols });
        }
      });

      if (patches.length) {
        // Batch into ONE FLIP animation
        grid.animate(() => {
          patches.forEach(({ i, rows, cols }) =>
            grid.updateTileAt(i, { rows, cols }, { animate: false })
          );
        });
      }
    }, [children]);

    useImperativeHandle(ref, () => ({ get grid() { return gridRef.current; } }), []);

    return (
      <div ref={hostRef} className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }
);

export default QuiltedGrid;

// Simple DOM-friendly tile: make sure data-* are present (core reads them)
export const QuiltedTile: React.FC<QuiltedTileProps> = ({ rows = 1, cols = 1, children, ...rest }) => (
  <div data-rows={rows} data-cols={cols} {...rest}>
    {children}
  </div>
);
