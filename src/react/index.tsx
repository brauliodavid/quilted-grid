import React, {
  forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef
} from "react";
import { QuiltedGrid as QG } from "../lib/quilted";
import type { QuiltedOptions, QuiltedTile as QT } from "../lib/types";

export type QuiltedGridRef = { readonly grid: QG | null };
export type QuiltedGridProps = React.HTMLAttributes<HTMLDivElement> & {
  data?: QT[];
  options?: QuiltedOptions;
  onReady?: (grid: QG) => void; // optional convenience
};
export type QuiltedTileProps = React.HTMLAttributes<HTMLDivElement> & {
  rows?: number; cols?: number;
};

export const QuiltedGrid = forwardRef<QuiltedGridRef, QuiltedGridProps>(
  ({ data, options, className, style, children, onReady, ...rest }, ref) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<QG | null>(null);

    // init core (StrictMode-safe: each setup has its own cleanup)
    useLayoutEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const grid = new QG(host, options ?? {});
      gridRef.current = grid;
      onReady?.(grid);

      // data-driven mode only when there are no DOM children to adopt
      if (host.childElementCount === 0) {
        grid.tiles = data ?? [];
      }

      return () => {
        grid.destroy();
        gridRef.current = null;
      };
    }, []);

    // keep options hot
    useEffect(() => {
      if (options) gridRef.current?.patchOptions(options);
    }, [options]);

    // data-driven updates only when host has no React child nodes
    useEffect(() => {
      const host = hostRef.current;
      const grid = gridRef.current;
      if (!host || !grid) return;
      if (host.childElementCount === 0) {
        grid.tiles = data ?? [];
      }
    }, [data]);

    // reconcile after each children change
    useLayoutEffect(() => {
      const host = hostRef.current;
      const grid = gridRef.current;
      if (!host || !grid) return;

      const els = Array.from(host.children) as HTMLElement[];

      // 1) adopt new in order
      els.forEach((node, visualIndex) => {
        const ownedIdx = grid.tiles.findIndex((t) => t.el === node);
        if (ownedIdx < 0) {
          grid.addTileElement(node, { index: visualIndex, animate: true });
        }
      });

      // 2) match order
      {
        const tiles = grid.tiles;
        els.forEach((node, visualIndex) => {
          const ownedIdx = tiles.findIndex((t) => t.el === node);
          if (ownedIdx >= 0 && ownedIdx !== visualIndex) {
            const [tile] = tiles.splice(ownedIdx, 1);
            tiles.splice(visualIndex, 0, tile);
          }
        });
        grid.tiles.forEach((tile, i) => tile.setIndex(i));
      }

      // 3) remove missing
      {
        const tiles = grid.tiles;
        for (let i = tiles.length - 1; i >= 0; i--) {
          if (tiles[i].el.parentElement !== host) {
            grid.removeTileAt(i, { animate: false });
          }
        }
      }

      // 4) sync spans from DOM attrs → model (single FLIP)
      grid.animate(() => {
        els.forEach((el, i) => {
          const rows = parseInt(el.getAttribute("data-rows") || "1", 10) || 1;
          const cols = parseInt(el.getAttribute("data-cols") || "1", 10) || 1;
          grid.updateTileAt(i, { rows, cols }, { animate: false });
        });
      });
    }, [children]);

    useImperativeHandle(ref, () => ({
      get grid() { return gridRef.current; } // always reflects latest
    }), []);

    return (
      <div ref={hostRef} className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }
);
QuiltedGrid.displayName = "QuiltedGrid";

export default QuiltedGrid;

export const QuiltedTile: React.FC<QuiltedTileProps> = ({ rows = 1, cols = 1, children, ...rest }) => (
  <div data-rows={rows} data-cols={cols} {...rest}>
    {children}
  </div>
);
