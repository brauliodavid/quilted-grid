import { injectCSS } from "./css";
import type { BaseOptions, QuiltedOptions, QuiltedTile } from "./types";
import { readInt } from "./utils";

// src/lib/quilted.ts
export class QuiltedGrid {
  private el: HTMLElement;
  private opts: BaseOptions;
  private ro?: ResizeObserver;
  private mounted = false;
  private _tiles: QuiltedGridTile[];

  // keep and reuse tile instances
  public set tiles(data: QuiltedTile[]) {
    // destroy old instances and clear DOM
    if (this._tiles?.length) {
      for (const t of this._tiles) t.destroy();
      this.el.innerHTML = '';
    }

    this._tiles = (data || []).map((tile, i) =>
      QuiltedGridTile.fromModel(tile, i, this.opts)
    );

    if (this.mounted) this.render();
  }

  public get tiles(): QuiltedGridTile[]{
    return this._tiles;
  }

  constructor(el: HTMLElement, opts: Partial<QuiltedOptions> = {}) {
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

    this.bootstrapFromDOM();

    if (this.opts.injectDefaultCSS) injectCSS();
    this.mount();
    this.render();
  }

  /** Build this.tiles and this.tiles by inspecting existing child elements. */
  private bootstrapFromDOM() {
    const kids = Array.from(this.el.children) as HTMLElement[];
    // adopt elements; do not call the setter and do not call getData()
    this._tiles = kids.map((child, index) =>
      QuiltedGridTile.fromElement(child, index, this.opts)
    );
  }

  patchOptions(patch: Partial<QuiltedOptions>) { 
    Object.assign(this.opts, patch); 
    this.render();
  }

  destroy() {
    this.ro?.disconnect();
    for (const c of this.tiles) c.destroy();
    this.el.innerHTML = '';
    this.tiles = [];
    this.mounted = false;
  }

  private mount() {
    if (this.mounted) return;

    const rootClass = this.opts.classNames?.root || 'qg-root';
    this.el.classList.add(rootClass);

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

    // Remove any children that aren't our tile elements
    const tileEls = new Set(this.tiles.map(t => t.el));
    Array.from(this.el.children).forEach((child) => {
      if (!tileEls.has(child as HTMLElement)) this.el.removeChild(child);
    });

    // Ensure order + update spans
    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      tile.setIndex(i).update(); // no args; uses current model

      const ref = this.el.children[i] || null;
      if (tile.el.parentNode !== this.el) {
        this.el.insertBefore(tile.el, ref);
      } else if (this.el.children[i] !== tile.el) {
        this.el.insertBefore(tile.el, ref);
      }
    }
  }

  addTile(data: QuiltedTile, opts: { index?: number, animate?: boolean } = {}) {
    const index = Math.max(0, Math.min(opts.index ?? this.tiles.length, this.tiles.length));
    const tile  = QuiltedGridTile.fromModel(data, index, this.opts);
    return this.insertTileAt(index, tile, { animate: opts.animate !== false });
  }

  /** Public: add a DOM element as a new tile */
  addTileElement(elm: HTMLElement, opts: { index?: number; animate?: boolean } = {}) {
    const index = Math.max(0, Math.min(opts.index ?? this.tiles.length, this.tiles.length));

    const tile = QuiltedGridTile.fromElement(elm, index, this.opts);
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

    tile.update(tile.getData());
    return tile;
  }

  updateTileAt(index: number, patch: Partial<QuiltedTile>, opts: { reflow?: boolean, animate?: boolean } = {}): void {
    const { reflow = false, animate = true } = opts;
    const tile = this.tiles[index];
    if (!tile) return;

    const apply = () => tile.update(patch);
    animate ? this.animate(apply) : apply();

    if (reflow) this.render();
  }

  createTileAt(index: number, data: QuiltedTile, opts: { animate?: boolean } = {}): QuiltedGridTile {
    const tile  = QuiltedGridTile.fromModel(data, index, this.opts);
    return this.insertTileAt(index, tile, opts)
  }

  private insertTileAt(index: number, tile: QuiltedGridTile, opts: { animate?: boolean } = {}){
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

  /** Remove one tile/tile by index. Optionally animates the reflow of remaining tiles. */
  removeTileAt(index: number, opts: { animate?: boolean } = {}): void {
    const { animate = true } = opts;
    const tile = this.tiles[index];
    if (!tile) return;

    const doRemove = () => {
      const [removed] = this.tiles.splice(index, 1); // remove once
      removed?.destroy();
      if (removed?.el.parentNode === this.el) this.el.removeChild(removed.el);
      for (let i = index; i < this.tiles.length; i++) this.tiles[i].setIndex(i);
    };

    if (animate) this.animate(doRemove); else doRemove();

    this.opts.onTileRemove?.({ index, tile });
    this.el.dispatchEvent(new CustomEvent('tileRemoved', {
      detail: { index, tile }, bubbles: true, cancelable: true, composed: true
    }));
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

  /**
   * Rebuild everything from the current in-memory tiles.
   * - Preserves each tile's inner content by moving child nodes.
   * - Recreates wrapper elements and tile instances from their models.
   */
  refresh() {
    // Ensure mounted so render() will apply grid styles
    if (!this.mounted) this.mount();

    // 1) Snapshot models + extract content from existing wrappers
    const snapshots = (this._tiles || []).map(t => {
      // Move children out so we can reuse them (preserves listeners on child nodes)
      const content = document.createDocumentFragment();
      while (t.el.firstChild) content.appendChild(t.el.firstChild);

      // Copy the current model (rows/cols/whatever QuiltedTile holds)
      const model = { ...t.getData() };

      return { model, content };
    });

    // 2) Remove old wrappers from the DOM and drop instances
    for (const t of this._tiles || []) {
      if (t.el.parentNode === this.el) this.el.removeChild(t.el);
      // t.destroy() only clears children (already moved), so skipping is fine
    }
    this._tiles = [];

    // 3) Recreate tiles from models, reattach preserved content, and append in order
    snapshots.forEach(({ model, content }, i) => {
      const tile = QuiltedGridTile.fromModel(model, i, this.opts);
      tile.el.appendChild(content); // move back original children
      this.el.appendChild(tile.el);
      this._tiles.push(tile);
    });

    // 4) Re-apply grid styling and spans
    this.render();
  }
}

export class QuiltedGridTile {
  el: HTMLElement;

  private opts: BaseOptions;
  private data: QuiltedTile;
  private index: number;

  /** Use factories below */
  private constructor(el: HTMLElement, model: QuiltedTile, index: number, opts: BaseOptions) {
    this.opts = opts;
    this.el = el;
    this.data = model;
    this.index = index;

    // Ensure class on wrapper
    if (!this.el.classList.contains(this.opts.classNames.tile)) {
      this.el.classList.add(this.opts.classNames.tile);
    }
    // Wire click once
    this.el.addEventListener('click', (ev) => {
      const payload = { tile: this, index: this.index, event: ev };
      this.opts.onTileClick?.(payload);
      this.el.dispatchEvent(new CustomEvent('tileClick', {
        detail: payload, bubbles: true, cancelable: true, composed: true
      }));
    });

    this.update(this.data);
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
    const model = QuiltedGridTile.elementToModel(el);
    return new QuiltedGridTile(el, model, index, opts);
  }

  /** Read-only access to current model */
  getData(): QuiltedTile { return this.data; }

  setIndex(i: number) {
    this.index = i;
    this.el.dataset.index = String(i);
    return this;
  }

  update(patch?: Partial<QuiltedTile>): void {
    // 1) Merge patch (optional)
    if (patch && typeof patch === 'object') Object.assign(this.data, patch);

    // 2) Normalize rows/cols
    const rows = Math.max(1, this.data.rows || 1);
    const cols = Math.max(1, this.data.cols || 1);

    // 3) Reflect rows/cols as attributes on the wrapper (useful for debugging/observers)
    if (this.el.getAttribute('rows') !== String(rows)) this.el.setAttribute('rows', String(rows));
    if (this.el.getAttribute('cols') !== String(cols)) this.el.setAttribute('cols', String(cols));

    // 4) Ensure styles reflect current spans
    // (applyTile already called updateGridSpan; this keeps things in sync if update() is called directly)
    this.updateGridSpan(rows, cols)
  }

  destroy() {
    this.el.replaceChildren();
  }

  private updateGridSpan(rows: number, cols: number) {
    const r = Math.max(1, rows || 1);
    const c = Math.max(1, cols || 1);
    this.el.style.gridRow = `span ${r}`;
    this.el.style.gridColumn = `span ${c}`;
    return this;
  }

  static elementToModel(el: HTMLElement): QuiltedTile {
    const rows   = readInt(el, 'rows', 1);
    const cols   = readInt(el, 'cols', 1);
    return { rows, cols };
  }
}


export default QuiltedGrid;
