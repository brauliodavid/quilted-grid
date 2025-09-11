import { QuiltedGrid as QG } from '../index';
import type { QuiltedTile, QuiltedOptions } from '../index';

export type ElementOptions = Partial<QuiltedOptions>;

/* ---------- helpers (read both plain + data-* attrs) ---------- */
function readStrAttr(el: Element, name: string): string | undefined {
  const ds = (el as HTMLElement).dataset as Record<string, string | undefined>;
  return ds?.[name] ?? el.getAttribute(name) ?? el.getAttribute(`data-${name}`) ?? undefined;
}
function readIntAttr(el: Element, name: string, fallback: number): number {
  const raw = readStrAttr(el, name);
  const n = raw == null ? NaN : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/* ---------- <quilted-tile> child element ---------- */
export class QuiltedTileElement extends HTMLElement {
  static tagName = 'quilted-tile';
  static get observedAttributes() {
    return ['rows', 'cols'];
  }

  constructor() {
    super();
    if (!this.style.display) this.style.display = 'block';
  }

  /* convenient getters/setters */
  get rows() { return readIntAttr(this, 'rows', 1); }
  set rows(v: number) { this.setAttribute('rows', String(v)); }
  get cols() { return readIntAttr(this, 'cols', 1); }
  set cols(v: number) { this.setAttribute('cols', String(v)); }

  connectedCallback() {
    // Nothing special; the parent grid will adopt this as-is
  }

  attributeChangedCallback() {
    // Bubble a single event the grid listens to (keeps the parent lean)
    this.dispatchEvent(new CustomEvent('tile-attrs-changed', {
      detail: {
        rows: this.rows,
        cols: this.cols,
      },
      bubbles: true,
      composed: true
    }));
  }
}

/* ---------- <quilted-grid> parent element ---------- */
export class QuiltedGridElement extends HTMLElement {
  static tagName = 'quilted-grid';

  #grid: QG | null = null;
  #data: QuiltedTile[] = [];
  #options: ElementOptions = { cols: 4, rowHeight: 121, gap: 4, injectDefaultCSS: true, autoResize: true };
  #mo: MutationObserver | null = null;
  #domDriven = false;

  constructor() {
    super();
    if (!this.style.display) this.style.display = 'block';
  }

  connectedCallback() {
    // Handle pre-upgrade property sets
    this.#upgradeProperty('data');
    this.#upgradeProperty('options');

    // If no programmatic data, allow data-json
    if (!this.#data.length) {
      const raw = this.getAttribute('data-json');
      if (raw) {
        try { this.#data = JSON.parse(raw); } catch {}
      }
    }

    // Decide mode: DOM-driven if we already have child tiles
    this.#domDriven = this.#childTiles().length > 0;

    // If width is 0 (hidden tab/accordion), wait a frame
    if (this.offsetWidth === 0) {
      requestAnimationFrame(() => this.#ensure());
    } else {
      this.#ensure();
    }
  }

  disconnectedCallback() {
    this.#mo?.disconnect();
    this.#mo = null;
    this.#grid?.destroy?.();
    this.#grid = null;
  }

  /* ---------- Public properties (React-style) ---------- */
  get data(): QuiltedTile[] { return this.#data; }
  set data(v: QuiltedTile[]) {
    this.#data = Array.isArray(v) ? v : [];
    if (this.#grid && !this.#domDriven) {
      this.#grid.tiles = this.#data;
    }
  }

  get options(): ElementOptions { return this.#options; }
  set options(patch: ElementOptions) {
    this.#options = { ...this.#options, ...(patch || {}) };
    this.#grid ? this.#grid.patchOptions(this.#options) : void 0;
  }

  /* ---------- Convenience API ---------- */
  setData(data: QuiltedTile[]) { this.data = data; }
  addTile(tile: QuiltedTile) { this.#data = [...this.#data, tile]; this.#grid?.addTile?.(tile); }
  updateAt(index: number, patch: Partial<QuiltedTile>) { this.#grid?.updateTileAt?.(index, patch); }
  removeAt(index: number) {
    if (index < 0) return;
    if (!this.#domDriven) {
      if (index >= this.#data.length) return;
      this.#data = this.#data.slice(0, index).concat(this.#data.slice(index + 1));
    }
    this.#grid?.removeTileAt?.(index);
  }

  relayout() { this.#grid?.render?.(); }
  refresh() {
    this.#grid?.destroy?.();
    this.#grid = null;
    this.#ensure();
  }

  patchOptions(patch: Partial<QuiltedOptions>) { this.options = patch; }

  /* ---------- Internals ---------- */
  #ensure() {
    if (this.#grid) return;

    // 1) Create the core grid
    //    If DOM-driven, pass empty data — your QG should bootstrap from children.
    const initialData = this.#domDriven ? [] : this.#data;
    this.#grid = new QG(this, this.#options);
    this.#grid.tiles = initialData

    // 2) Bridge built-in events to dash-case for ergonomics
    this.addEventListener('tileClick' as any, (ev: Event) => {
      this.dispatchEvent(new CustomEvent('tile-click', { detail: (ev as CustomEvent).detail, bubbles: true, composed: true }));
    });
    this.addEventListener('tileRemoved' as any, (ev: Event) => {
      this.dispatchEvent(new CustomEvent('tile-removed', { detail: (ev as CustomEvent).detail, bubbles: true, composed: true }));
    });

    // 3) If DOM-driven, wire live sync (adds/removes + attribute changes)
    if (this.#domDriven) {
      // Attribute changes (child -> parent -> QG.updateAt)
      this.addEventListener('tile-attrs-changed', (e: Event) => {
        const target = e.target as HTMLElement;
        const idx = this.#idxByEl(target);
        if (idx < 0) return;
        const detail = (e as CustomEvent).detail as Partial<QuiltedTile>;
        this.#grid!.updateTileAt(idx, detail);
      });

      // Add/remove tiles via MutationObserver
      this.#mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.removedNodes?.length) {
            for (const n of Array.from(m.removedNodes)) {
              if (!(n instanceof HTMLElement)) continue;
              if (n.tagName.toLowerCase() !== QuiltedTileElement.tagName) continue;
              const idx = this.#idxByEl(n);
              if (idx >= 0) this.#grid!.removeTileAt(idx);
            }
          }
        }
      });

      this.#mo.observe(this, { childList: true, subtree: false });
    }
  }

  #childTiles(): HTMLElement[] {
    return Array.from(this.querySelectorAll(':scope > quilted-tile')) as HTMLElement[];
  }

  #indexOfElementAmongChildren(el: HTMLElement): number {
    const kids = Array.from(this.children) as HTMLElement[];
    return kids.indexOf(el);
  }

  #idxByEl(el: HTMLElement): number {
    // Find the current index by matching the element the core grid uses
    const gridAny = this.#grid as any;
    const items: any[] = gridAny?.items || [];
    return items.findIndex((it) => it?.el === el);
  }

  #upgradeProperty(name: 'data' | 'options') {
    if (Object.prototype.hasOwnProperty.call(this, name)) {
      // @ts-ignore
      const value = this[name];
      // @ts-ignore
      delete this[name];
      // @ts-ignore
      this[name] = value;
    }
  }

  // --- helpers (inside QuiltedGridElement) ---
  private _clampIndex(i: number) {
    return Math.max(0, Math.min(i, this.children.length));
  }
  private _readTileModel(tileEl: HTMLElement): QuiltedTile {
    return {
      src: (tileEl.getAttribute('src') ?? tileEl.getAttribute('data-src') ?? '') as string,
      alt: (tileEl.getAttribute('alt') ?? tileEl.getAttribute('data-alt') ?? '') as string,
      title: (tileEl.getAttribute('title') ?? tileEl.getAttribute('data-title') ?? '') as string,
      rows: parseInt(tileEl.getAttribute('rows') ?? tileEl.getAttribute('data-rows') ?? '1', 10) || 1,
      cols: parseInt(tileEl.getAttribute('cols') ?? tileEl.getAttribute('data-cols') ?? '1', 10) || 1,
    } as QuiltedTile;
  }
  private _assertTile(el: HTMLElement) {
    const tag = (QuiltedTileElement?.tagName ?? 'quilted-tile').toLowerCase();
    if (!(el instanceof HTMLElement) || el.tagName.toLowerCase() !== tag) {
      throw new Error('Expected a <quilted-tile> element');
    }
  }

  // --- add inside QuiltedGridElement ---

  /** Append an existing <quilted-tile ...> element. */
  appendTile(tileEl: HTMLElement): void {
    this.appendTileAt(tileEl, this.children.length);
  }

  /** Insert a <quilted-tile> at a specific index. */
  appendTileAt(tileEl: HTMLElement, index: number): void {
    this._assertTile(tileEl);
    const idx = this._clampIndex(Number.isFinite(index) ? index : this.children.length);

    if (this.#domDriven) {
      // Just place it in the DOM; MutationObserver syncs to QG
      const ref = this.children[idx] || null;
      this.insertBefore(tileEl, ref);
    } else {
      // Let the core grid adopt it, then mirror into #data
      const gridAny = this.#grid as any;
      if (typeof gridAny?.addTileElement === 'function') {
        gridAny.addTileElement(tileEl, { index: idx, animate: true });
      } else if (typeof gridAny?.addItemElement === 'function') {
        gridAny.addItemElement(tileEl, { index: idx, animate: true });
      } else {
        throw new Error('Grid instance is missing addTileElement/addItemElement');
      }
      this.#data.splice(idx, 0, this._readTileModel(tileEl));
    }
  }

  /** Remove a specific <quilted-tile ...> element. Returns the removed element or null. */
  removeTile(tileEl: HTMLElement): void {
    if (!(tileEl instanceof HTMLElement)) return null;

    if (this.#domDriven) {
      // Remove from DOM; MutationObserver will trigger QG.removeAt with animation.
      if (tileEl.parentNode === this) this.removeChild(tileEl);
      else {
        // If it’s not our child but it maps to a grid item, remove by index.
        const idx = this.#idxByEl(tileEl);
        if (idx >= 0) this.#grid?.removeTileAt?.(idx);
        else return null;
      }
    } else {
      // Data-driven: compute index, keep #data in sync, and ask core to remove.
      let idx = this.#idxByEl(tileEl);
      if (idx < 0) idx = this.#indexOfElementAmongChildren(tileEl);
      if (idx < 0) return null;

      if (idx < this.#data.length) this.#data.splice(idx, 1);
      this.#grid?.removeTileAt?.(idx);
    }
  }

  /** Remove tile at a given index. Returns the removed element (if known) or null. */
  removeTileAt(index: number): void {
    if (index < 0) return null;

    let el: HTMLElement | null = null;

    if (this.#domDriven) {
      el = (this.children[index] as HTMLElement) ?? null;
      if (!el) return null;
      // DOM-driven: remove from DOM; MO will call QG.removeAt.
      this.removeChild(el);
    } else {
      // Try to fetch the element from QG items for return value.
      const itemsAny = (this.#grid as any)?.items;
      if (Array.isArray(itemsAny) && itemsAny[index]) el = itemsAny[index].el as HTMLElement;

      if (index < this.#data.length) this.#data.splice(index, 1);
      this.#grid?.removeTileAt?.(index);
    }
  }
}

/* ---------- Tree-shakable registration for BOTH elements ---------- */
declare global { interface Window { __QG_DEFINED__?: boolean; __QT_DEFINED__?: boolean } }

export function register(tagGrid = QuiltedGridElement.tagName, tagTile = QuiltedTileElement.tagName) {
  if (typeof window === 'undefined' || !('customElements' in window)) return;

  const gridName = String(tagGrid).trim().toLowerCase();
  const tileName = String(tagTile).trim().toLowerCase();
  if (!/-/.test(gridName) || !/-/.test(tileName)) return;

  // Avoid duplicate defines (Vite HMR, storybook, etc.)
  if (!window.__QT_DEFINED__ && !customElements.get(tileName)) {
    try { customElements.define(tileName, QuiltedTileElement); window.__QT_DEFINED__ = true; } catch {}
  } else {
    window.__QT_DEFINED__ = true;
  }

  if (!window.__QG_DEFINED__ && !customElements.get(gridName)) {
    try { customElements.define(gridName, QuiltedGridElement); window.__QG_DEFINED__ = true; } catch {}
  } else {
    window.__QG_DEFINED__ = true;
  }
}
