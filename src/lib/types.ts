import type { QuiltedGridTile } from "./quilted";

export type QuiltedTile<T = unknown> = {
  rows?: number;
  cols?: number;
  data?: T;
};

export type ItemClickPayload = {
  tile: QuiltedGridTile;
  index: number;
  event: MouseEvent;
};

// export type QuiltedOptions = Partial<BaseOptions>;

export type QuiltedOptions = {
  cols?: number | ((containerWidth: number) => number);
  rowHeight?: number;
  gap?: number;
  autoResize?: boolean;
  injectDefaultCSS?: boolean;
  onTileRemove?: (ev: {index: number, tile: QuiltedGridTile}) => void;
  classNames?: { root: string; tile: string };
  onTileClick?: (payload: ItemClickPayload) => void;
};

export interface QuiltedInput {
  width: number;
  height: number;
}

export interface QuiltedOutput extends QuiltedTile {
  cols: number;
  rows: number;
  originalIndex: number
}