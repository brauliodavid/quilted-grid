import { injectCSS } from "./css";
import type { BaseOptions, QuiltedOptions, QuiltedTile } from "./types";
import { readInt } from "./utils";

// src/lib/quilted.ts
export class QuiltedGrid {
  private el: HTMLElement;
  private opts: BaseOptions;
  private data: QuiltedTile[];
  private ro?: ResizeObserver;
  private mounted = false;

  // keep and reuse tile instances
  public tiles: QuiltedGridTile[] = [];

  constructor(el: HTMLElement, data: QuiltedTile[] = [], opts: Partial<BaseOptions> = {}) {
    if (!el) throw new Error('container element required');

    this.opts = {
      cols: 4,
      rowHeight: 121,
      gap: 4,
      autoResize: true,
      injectDefaultCSS: true,
      classNames: { root: 'qg-root', tile: 'qg-tile' },
      ...opts
    } as BaseOptions;

    this.el = el;

    // Choose data source:
    // 1) If caller provided data OR container has no children -> use provided tiles
    // 2) If container already has children -> bootstrap from DOM
    if (data && data.length) {
      this.data = data;
    } else if (this.el.children.length > 0) {
      this.data = [];
      this.bootstrapFromDOM(); // fills tiles + tiles using existing children
    } else {
      this.data = [];
    }

    if (this.opts.injectDefaultCSS) injectCSS();
    this.mount();
    this.render();
  }

  /** Build this.tiles and this.tiles by inspecting existing child elements. */
  private bootstrapFromDOM() {
    const kids = Array.from(this.el.children) as HTMLElement[];
    this.tiles  = kids.map((child, index) => QuiltedGridTile.fromElement(child, index, this.opts));
    this.data = this.tiles.map(it => it.getModel());
  }

  setData(data: QuiltedTile[]) { this.data = data || []; this.render(); return this; }
  patchOptions(patch: Partial<QuiltedOptions>) { Object.assign(this.opts, patch); this.render(); return this; }

  destroy() {
    this.ro?.disconnect();
    for (const c of this.tiles) c.destroy();
    this.el.innerHTML = '';
    this.tiles = [];
    this.mounted = false;
  }

  private mount() {
    if (this.mounted) return;
    this.el.classList.add(this.opts.classNames.tile ? this.opts.classNames.root : 'qg-root');

    if (this.opts.autoResize) {
      this.ro = new ResizeObserver(() => this.render());
      this.ro.observe(this.el);
    }

    // Listen for a command-style event to remove by index
    this.el.addEventListener('removeTile', (ev: Event) => {
      const e = ev as CustomEvent<{ index: number; animate?: boolean }>;
      const idx = e?.detail?.index;
      if (typeof idx === 'number') {
        this.removeTileAt(idx, { animate: e.detail?.animate });
      }
    });

    this.mounted = true;
  }

  private resolveCols() {
    const c = this.opts.cols;
    if (typeof c === 'function') {
      const w = this.el.clientWidth || window.innerWidth || 1024;
      return Math.max(1, Math.floor(c(w)));
    }
    return Math.max(1, Math.floor(c));
  }

  private applyGridStyle(cols: number) {
    this.el.style.display = 'grid';
    this.el.style.gridAutoFlow = 'dense';
    this.el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.el.style.gridAutoRows = `${this.opts.rowHeight}px`;
    this.el.style.gap = `${this.opts.gap}px`;
  }

  render() {
    const cols = this.resolveCols();
    this.applyGridStyle(cols);

    const targetLen = this.data.length;

    // Add missing tiles (if caller passed tiles but there were no DOM children)
    while (this.tiles.length < targetLen) {
      const idx = this.tiles.length;
      this.createTileAt(idx, { animate: false });
    }

    // Remove extra tiles
    while (this.tiles.length > targetLen) {
      const tile = this.tiles.pop()!;
      tile.destroy();
      if (tile.el.parentNode === this.el) this.el.removeChild(tile.el);
    }

    // Sync content/spans
    for (let i = 0; i < targetLen; i++) {
      const it = this.data[i];
      const tile = this.tiles[i];
      tile.setIndex(i).applyTile(it);
    }
  }

  addTile(tile: QuiltedTile, opts: { index?: number, animate?: boolean } = {}) {
    const index = Math.max(0, Math.min(opts.index ?? this.data.length, this.data.length));

    // model
    this.data.splice(index, 0, tile);

    // tile (no full re-render needed)
    return this.createTileAt(index, { animate: opts.animate !== false });
  }

  /** Public: add a DOM element as a new tile */
  addTileElement(elm: HTMLElement, opts: { index?: number; animate?: boolean } = {}) {
    const index = Math.max(0, Math.min(opts.index ?? this.data.length, this.data.length));

    const tile = QuiltedGridTile.fromElement(elm, index, this.opts);
    this.data.splice(index, 0, tile.getModel());
    this.tiles.splice(index, 0, tile);

    const ref = this.el.children[index] || null;
    this.el.insertBefore(tile.el, ref);

    for (let i = index; i < this.tiles.length; i++) this.tiles[i].setIndex(i);

    if (opts.animate !== false) {
      tile.el.classList.add('qg-enter');
      void tile.el.offsetWidth;
      tile.el.classList.add('qg-enter-active');
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== tile.el) return;
        tile.el.classList.remove('qg-enter', 'qg-enter-active');
        tile.el.removeEventListener('transitionend', onEnd);
      };
      tile.el.addEventListener('transitionend', onEnd, { once: true });
    }

    tile.applyTile(tile.getModel());
    return tile;
  }

  updateTileAt(index: number, patch: Partial<QuiltedTile>, opts: { reflow?: boolean } = {}) {
    const { reflow = false } = opts;
    const model = this.data[index];
    if (!model) return this;

    Object.assign(model, patch); // update model
    const tile = this.tiles[index];
    if (tile) tile.applyTile(model); // update tile view

    if (reflow) this.render(); // optional full reflow
    return this;
  }

  /** Remove one tile/tile by index. Optionally animates the reflow of remaining tiles. */
  removeTileAt(index: number, opts: { animate?: boolean } = {}) {
    const { animate = true } = opts;

    const model = this.data[index];
    const cell  = this.tiles[index];
    if (!model || !cell) return this;

    const doRemove = () => {
      // 1) Update model
      this.data.splice(index, 1);

      // 2) Remove DOM + view instance
      cell.destroy();
      if (cell.el.parentNode === this.el) this.el.removeChild(cell.el);

      // 3) Update tiles array and reindex following cells
      this.tiles.splice(index, 1);
      for (let i = index; i < this.tiles.length; i++) {
        this.tiles[i].setIndex(i);
      }
    };

    if (animate) {
      this.animate(doRemove);
    } else {
      doRemove();
    }

    // Notify via callback and DOM event
    this.opts.onTileRemove?.({ index, tile: model });
    this.el.dispatchEvent(new CustomEvent('tileRemoved', {
      detail: { index, tile: model },
      bubbles: true, cancelable: true, composed: true
    }));

    return this;
  }

  /** Animate any synchronous DOM mutation that changes layout */
  animate(mutator: () => void, opts: { duration?: number; easing?: string } = {}) {
    const dur  = opts.duration ?? 300;
    const ease = opts.easing  ?? 'cubic-bezier(.2,.7,.1,1)';

    const els = this.tiles.map(c => c.el);

    // Clear transforms / transitions, and temporarily remove enter classes
    const removedEnter = new Map<HTMLElement, string[]>();
    for (const el of els) {
      const toRemove: string[] = [];
      if (el.classList.contains('qg-enter')) toRemove.push('qg-enter');
      if (el.classList.contains('qg-enter-active')) toRemove.push('qg-enter-active');
      if (toRemove.length) {
        removedEnter.set(el, toRemove);
        el.classList.remove(...toRemove);
      }
      el.style.transition = 'none';
      el.style.transform  = '';
    }

    const first = new Map<HTMLElement, DOMRect>();
    for (const el of els) first.set(el, el.getBoundingClientRect());

    // MUTATE
    mutator();

    // Force reflow so LAST reflects the mutation
    this.el.getBoundingClientRect();

    // LAST + INVERT
    const toAnimate: HTMLElement[] = [];
    for (const el of els) {
      const f = first.get(el)!;
      const l = el.getBoundingClientRect();
      const dx = f.left - l.left;
      const dy = f.top  - l.top;
      const sx = f.width  / (l.width  || 1);
      const sy = f.height / (l.height || 1);

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 &&
          Math.abs(1 - sx) < 0.01 && Math.abs(1 - sy) < 0.01) {
        el.style.transition = '';
        continue;
      }

      el.style.transformOrigin = '0 0';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      toAnimate.push(el);
    }

    // PLAY
    requestAnimationFrame(() => {
      for (const el of toAnimate) {
        void el.offsetWidth; // commit start
        el.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
        el.style.transform  = '';
      }
      // restore transitions/classes after
      setTimeout(() => {
        for (const el of els) el.style.transition = '';
        for (const [el, classes] of removedEnter) el.classList.add(...classes);
      }, dur + 40);
    });
  }

  private createTileAt(index: number, opts: { animate?: boolean } = {}) {
    const model = this.data[index];
    const tile  = QuiltedGridTile.fromModel(model, index, this.opts);

    const ref = this.el.children[index] || null;
    this.el.insertBefore(tile.el, ref);

    this.tiles.splice(index, 0, tile);
    for (let i = index; i < this.tiles.length; i++) this.tiles[i].setIndex(i);

    if (opts.animate !== false) {
      tile.el.classList.add('qg-enter');
      void tile.el.offsetWidth;
      tile.el.classList.add('qg-enter-active');
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== tile.el) return;
        tile.el.classList.remove('qg-enter', 'qg-enter-active');
        tile.el.removeEventListener('transitionend', onEnd);
      };
      tile.el.addEventListener('transitionend', onEnd, { once: true });
    }
    return tile;
  }
}

export class QuiltedGridTile {
  el: HTMLElement;

  private opts: BaseOptions;
  private tile: QuiltedTile;
  private index: number;

  /** Use factories below */
  private constructor(el: HTMLElement, model: QuiltedTile, index: number, opts: BaseOptions) {
    this.opts = opts;
    this.el = el;
    this.tile = model;
    this.index = index;

    // Ensure class on wrapper
    if (!this.el.classList.contains(this.opts.classNames.tile)) {
      this.el.classList.add(this.opts.classNames.tile);
    }
    // Wire click once
    this.el.addEventListener('click', (ev) => {
      const payload = { tile: this.tile, index: this.index, event: ev };
      this.opts.onTileClick?.(payload);
      this.el.dispatchEvent(new CustomEvent('tileClick', {
        detail: payload, bubbles: true, cancelable: true, composed: true
      }));
    });

    this.applyTile(this.tile);
    this.setIndex(this.index);
  }

  /** Create from a data model (no existing node) */
  static fromModel(model: QuiltedTile, index: number, opts: BaseOptions) {
    const el = document.createElement('div');
    el.className = opts.classNames.tile;
    return new QuiltedGridTile(el, model, index, opts);
  }

  /** Adopt an existing element */
  static fromElement(wrapper: HTMLElement, index: number, opts: BaseOptions) {
    const el = wrapper as HTMLElement;
    const { model } = QuiltedGridTile.elementToModel(el);
    return new QuiltedGridTile(el, model, index, opts);
  }

  /** Read-only access to current model */
  getModel(): QuiltedTile { return this.tile; }

  setIndex(i: number) {
    this.index = i;
    this.el.dataset.index = String(i);
    return this;
  }

  applyTile(patch: Partial<QuiltedTile>) {
    Object.assign(this.tile, patch);
    this.updateGridSpan(this.tile.rows ?? 1, this.tile.cols ?? 1);
    return this;
  }

  updateGridSpan(rows: number, cols: number) {
    const r = Math.max(1, rows || 1);
    const c = Math.max(1, cols || 1);
    this.el.style.gridRow = `span ${r}`;
    this.el.style.gridColumn = `span ${c}`;
    return this;
  }

  update(patch?: Partial<QuiltedTile>): void {
    // 1) Merge patch (optional)
    if (patch && typeof patch === 'object') Object.assign(this.tile, patch);

    // 2) Normalize rows/cols
    const rows = Math.max(1, this.tile.rows || 1);
    const cols = Math.max(1, this.tile.cols || 1);

    // 3) Reflect rows/cols as attributes on the wrapper (useful for debugging/observers)
    if (this.el.getAttribute('rows') !== String(rows)) this.el.setAttribute('rows', String(rows));
    if (this.el.getAttribute('cols') !== String(cols)) this.el.setAttribute('cols', String(cols));

    // 4) Ensure styles reflect current spans
    // (applyTile already called updateGridSpan; this keeps things in sync if update() is called directly)
    this.el.style.gridRow = `span ${rows}`;
    this.el.style.gridColumn = `span ${cols}`;
  }

  destroy() {
    this.el.replaceChildren();
  }

  static elementToModel(el: HTMLElement) {
    const rows   = readInt(el, 'rows', 1);
    const cols   = readInt(el, 'cols', 1);
    return { model: { rows, cols } as QuiltedTile};
  }
}


export default QuiltedGrid;
