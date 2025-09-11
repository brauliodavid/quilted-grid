export type QuiltedTile<T = unknown> = {
  rows?: number;
  cols?: number;
  data?: T;
};

export type ItemClickPayload = {
  tile: QuiltedTile;
  index: number;
  event: MouseEvent;
};

export type QuiltedOptions = Partial<BaseOptions>;

export type BaseOptions = {
  cols: number | ((containerWidth: number) => number);
  rowHeight: number;
  gap: number;
  autoResize: boolean;
  injectDefaultCSS: boolean;
  onTileRemove?: (ev: {index: number, tile: QuiltedTile}) => void;
  classNames: { root: string; tile: string };
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