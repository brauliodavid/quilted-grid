import React, {
  forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef,
} from "react";
import { QuiltedGrid as QG } from "../index";
import type { QuiltedTile as QT, QuiltedOptions } from "../index";

export type QuiltedGridRef = { readonly grid: QG | null };
export type QuiltedGridProps = React.HTMLAttributes<HTMLDivElement> & {
  data?: QT[];
  options?: Partial<QuiltedOptions>;
};
export type QuiltedTileProps = React.HTMLAttributes<HTMLDivElement> & {
  rows?: number;
  cols?: number;
};

export const QuiltedGrid = forwardRef<QuiltedGridRef, QuiltedGridProps>(
  ({ data, options, className, style, children, ...rest }, ref) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<QG | null>(null);
    const moRef = useRef<MutationObserver | null>(null);

    // 1) Create core once (mount). If children exist at that moment → DOM-driven; else data-driven.
    useLayoutEffect(() => {
      const el = mountRef.current;
      if (!el) return;

      const domDrivenNow = el.childElementCount > 0;
      gridRef.current = new QG(el, domDrivenNow ? [] : (data ?? []), options ?? {});

      return () => {
        moRef.current?.disconnect();
        moRef.current = null;
        gridRef.current?.destroy?.();
        gridRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2) If we started data-driven, keep data in sync
    useEffect(() => {
      const el = mountRef.current;
      const grid = gridRef.current;
      if (!el || !grid) return;
      if (el.childElementCount === 0) {
        grid.setData(data ?? []);
      }
    }, [data]);

    // 3) Patch options without recreating
    useEffect(() => {
      if (options) gridRef.current?.patchOptions(options);
    }, [options]);

    // 4) Adopt children that show up after mount (DOM-driven late)
    useLayoutEffect(() => {
      const host = mountRef.current;
      if (!host) return;

      // Create core once. If there are children now → DOM-driven (constructor bootstraps from DOM).
      const domDrivenAtStart = host.childElementCount > 0;
      const grid = new QG(host, domDrivenAtStart ? [] : (data ?? []), options ?? {});
      gridRef.current = grid;

      const DUR = 300; // keep in sync with your core animation duration
      let paused = false;

      // Observe only direct child adds/removes. We’ll ignore our own mutations.
      const mo = new MutationObserver((mutations) => {
        if (paused) return;
        const g = gridRef.current;
        const el = mountRef.current;
        if (!g || !el) return;

        const adds: Array<{ node: HTMLElement; index: number }> = [];
        const removeIdx: number[] = [];

        for (const m of mutations) {
          // Collect additions (direct children only)
          m.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            if (n.parentElement !== el) return; // only direct children of host
            // Skip if grid already owns this element
            const owned = (g as any)?.tiles?.some((t: any) => t?.el === n);
            if (owned) return;

            // Hide immediately so it doesn't affect FIRST; we’ll show after adoption
            (n as HTMLElement).style.display = 'none';

            const index = Array.prototype.indexOf.call(el.children, n);
            adds.push({ node: n as HTMLElement, index });
          });

          // Collect removals: map element -> tile index
          m.removedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            const idx = (g as any)?.tiles?.findIndex((t: any) => t?.el === n) ?? -1;
            if (idx >= 0) removeIdx.push(idx);
          });
        }

        if (adds.length === 0 && removeIdx.length === 0) return;

        // Prevent re-entrancy while we mutate.
        paused = true;
        mo.disconnect();

        // Batch in a single FLIP animation
        g.animate(() => {
          // Remove from highest index to keep indices valid
          removeIdx.sort((a, b) => b - a).forEach((idx) => g.removeTileAt(idx, { animate: false }));

          // Adopt new nodes at their intended indices; reveal them after adoption
          adds.forEach(({ node, index }) => {
            g.addTileElement(node, { index, animate: true });
            (node as HTMLElement).style.display = '';
          });
        }, { duration: DUR });

        // Reattach observer after animation so we don't capture our own inserts
        setTimeout(() => {
          if (!host.isConnected) return;
          mo.observe(host, { childList: true });
          paused = false;
        }, DUR + 40);
      });

      // Start observing future changes only (constructor already bootstrapped initial children)
      mo.observe(host, { childList: true });

      return () => {
        paused = true;
        mo.disconnect();
        grid.destroy?.();
        gridRef.current = null;
      };
      // IMPORTANT: empty deps — create once; MO handles children changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({ get grid() { return gridRef.current; } }), []);

    return (
      <div ref={mountRef} className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }
);

export default QuiltedGrid;

/* --------------------- DOM-friendly tile --------------------- */

export const QuiltedTile: React.FC<QuiltedTileProps> = ({
  rows = 1,
  cols = 1,
  children,
  ...rest
}) => {
  return (
    <div
      // Write BOTH plain attrs and data-* so your readInt() always finds them
      data-rows={rows}
      data-cols={cols}
      {...rest}
    >
      {children}
    </div>
  );
};
