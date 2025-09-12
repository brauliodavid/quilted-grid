import React, {
  forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef
} from "react";
import { QuiltedGrid as QG } from "quilted-grid";
import type { QuiltedOptions } from "quilted-grid";

export type QuiltedGridRef = { readonly grid: QG | null };
export type QuiltedGridProps = React.HTMLAttributes<HTMLDivElement> & {
  options?: QuiltedOptions;
  onReady?: (grid: QG) => void; // optional convenience
};
export type QuiltedTileProps = React.HTMLAttributes<HTMLDivElement> & {
  rows?: number; cols?: number;
};

export const QuiltedGrid = forwardRef<QuiltedGridRef, QuiltedGridProps>(
  ({ options, className, style, children, onReady, ...rest }, ref) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<QG | null>(null);

    // init core (idempotent, StrictMode safe)
    useLayoutEffect(() => {
      const host = hostRef.current!;
      if (!gridRef.current) {
        gridRef.current = new QG(host, options ?? {});
        onReady?.(gridRef.current); // fire once per real init
      }
      return () => {
        gridRef.current?.destroy();
        gridRef.current = null;
      };
    }, []); // no inited flag

    // keep options hot
    useEffect(() => {
      if (options) gridRef.current?.patchOptions(options);
    }, [options]);

    // reconcile after each children change
    useLayoutEffect(() => {
      const host = hostRef.current;
      const grid = gridRef.current;
      if (!host || !grid) return;

      const els = Array.from(host.children) as HTMLElement[];

      // 1) adopt new in order
      els.forEach((node, visualIndex) => {
        const ownedIdx =
          ((grid as any).tiles?.findIndex((t: any) => t?.el === node) ?? -1);
        if (ownedIdx === -1) {
          grid.addTileElement(node, { index: visualIndex, animate: true });
        }
      });

      // 2) match order
      {
        const tiles = (grid as any).tiles as any[];
        els.forEach((node, visualIndex) => {
          const ownedIdx = tiles.findIndex((t: any) => t.el === node);
          if (ownedIdx !== visualIndex) {
            const [tile] = tiles.splice(ownedIdx, 1);
            tiles.splice(visualIndex, 0, tile);
          }
        });
        (grid as any).tiles.forEach((t: any, i: number) => t.setIndex(i));
      }

      // 3) remove missing
      {
        const tiles = (grid as any).tiles as any[] || [];
        for (let i = tiles.length - 1; i >= 0; i--) {
          if (tiles[i].el.parentElement !== host) {
            grid.removeTileAt(i, { animate: false });
          }
        }
      }

      // 4) sync spans from DOM attrs → model (single FLIP)
      grid.animate(() => {
        const tiles = (grid as any).tiles as any[];
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

export default QuiltedGrid;

export const QuiltedTile: React.FC<QuiltedTileProps> = ({ rows = 1, cols = 1, children, ...rest }) => (
  <div data-rows={rows} data-cols={cols} {...rest}>
    {children}
  </div>
);
