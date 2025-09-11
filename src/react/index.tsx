import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { QuiltedGrid as QG } from "../index";
import type { QuiltedTile as QT, QuiltedOptions } from "../index";

export type QuiltedGridRef = { readonly grid: QG | null };

export type QuiltedGridProps = React.HTMLAttributes<HTMLDivElement> & {
  /** If children are provided, DOM-driven mode is used. If not, data-driven. */
  data?: QT[];
  options?: Partial<QuiltedOptions>;
};

export type QuiltedTileProps = React.HTMLAttributes<HTMLDivElement> & {
  rows?: number;
  cols?: number;
};

export const QuiltedGrid = forwardRef<QuiltedGridRef, QuiltedGridProps>(
  ({ data, options, className, style, children }, ref) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<QG | null>(null);
    const domDrivenRef = useRef<boolean>(false);

    // Create once (after children are committed to the DOM)
    useLayoutEffect(() => {
      const el = mountRef.current;
      if (!el) return;

      // Children present? -> DOM-driven
      domDrivenRef.current = el.childElementCount > 0;

      // If DOM-driven, let QG bootstrap from existing children; else use data
      const initialData = domDrivenRef.current ? [] : (data ?? []);
      gridRef.current = new QG(el, initialData, options ?? {});

      return () => {
        // On unmount, clean up. (This may clear the node; that's okay on unmount.)
        gridRef.current?.destroy?.();
        gridRef.current = null;
      };
      // IMPORTANT: create once; do NOT depend on children/options here
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep data in sync only in data-driven mode
    useEffect(() => {
      if (!domDrivenRef.current) gridRef.current?.setData(data ?? []);
    }, [data]);

    // Keep options in sync (patch only, no re-create)
    useEffect(() => {
      if (options) gridRef.current?.patchOptions(options);
    }, [options]);

    useImperativeHandle(
      ref,
      () => ({ get grid() { return gridRef.current; } }),
      []
    );

    return (
      <div ref={mountRef} className={className} style={style}>
        {/* In DOM-driven mode, these are the tiles QG adopts on mount */}
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
