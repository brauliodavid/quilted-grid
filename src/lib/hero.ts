// src/lib/hero.ts
import type { QuiltedInput, QuiltedOutput } from './types';

export type HeroPlanOptions = {
  heroRatio?: number;          // fraction to promote as heroes (default 0.25)
  heroMinCols?: number;        // NEW: min columns for a hero (default 2)
  heroMaxCols?: number;        // NEW: max columns for a hero (default 3)
  maxRows?: number;            // hard cap for rows on any item (default 4)
  portraitThreshold?: number;  // h/w above this = portrait (default 1.2)
  landscapeThreshold?: number; // h/w below this = landscape (default 0.85)
  baseRowsLandscape?: number;  // default rows for landscape heroes (default 2)
  baseRowsSquare?: number;     // default rows for square-ish heroes (default 2)
  baseRowsPortrait?: number;   // default rows for portrait heroes (default 3)
  seed?: number;               // optional seed for deterministic selection
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// Simple LCG for deterministic randomness if seed provided
function makeRng(seed?: number) {
  if (seed == null) return Math.random;
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xffffffff) / 0x100000000;
  };
}

function classify(h: number, w: number, portraitTh: number, landscapeTh: number): 'portrait'|'landscape'|'square' {
  const r = h / w;
  if (r >= portraitTh) return 'portrait';
  if (r <= landscapeTh) return 'landscape';
  return 'square';
}

/** Keep heroes’ orientation consistent:
 *  - portrait  → rows >= cols (never horizontal)
 *  - landscape → rows <= cols (never vertical)
 *  - square-ish → prefer rows <= cols (compact)
 */
function enforceHeroOrientation(
  orient: 'portrait'|'landscape'|'square',
  cols: number,
  rows: number,
  numCols: number,
  maxRows: number
) {
  cols = clamp(cols, 1, numCols);
  rows = clamp(rows, 1, maxRows);

  if (orient === 'portrait') {
    if (cols > rows) rows = cols;                 // raise rows to keep portrait
  } else if (orient === 'landscape') {
    if (rows > cols) rows = cols;                 // cap rows to keep landscape
  } else {
    // square-ish: avoid tall slivers
    if (rows > cols) rows = cols;
  }
  return { cols, rows };
}

/** Interleave heroes among normals so no two heroes are consecutive.
 *  If heroes > normals + 1, demote extras to normals (1x1) to satisfy the rule.
 */
function interleaveNoConsecutive<T extends { _hero: boolean }>(
  arr: T[],
  rng: () => number
): T[] {
  const H = arr.filter(x => x._hero);
  const N = arr.filter(x => !x._hero);

  // If too many heroes, demote some (random) until H ≤ N + 1
  while (H.length > N.length + 1) {
    const idx = Math.floor(rng() * H.length);
    H[idx]._hero = false;
    N.push(H.splice(idx, 1)[0]);
  }

  // Shuffle both groups
  const shuf = <U>(a: U[]) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const HS = shuf(H);
  const NS = shuf(N);

  // Distribute heroes across N+1 slots
  const slots: T[][] = Array.from({ length: NS.length + 1 }, () => [] as any);
  for (let i = 0; i < HS.length; i++) {
    const slotIndex = Math.floor((i * (NS.length + 1)) / HS.length);
    slots[Math.min(slotIndex, slots.length - 1)].push(HS[i]);
  }

  const out: T[] = [];
  for (let i = 0; i < NS.length; i++) {
    out.push(...slots[i], NS[i]);
  }
  out.push(...slots[NS.length]);
  return out;
}

/** Skyline packer (gap-free).
 *  Respects incoming order; if a width can’t fit without gaps, it shrinks width
 *  (and re-enforces orientation) until it does. Always places something (1×1 fallback).
 */
function packGapFree(
  planned: (Partial<QuiltedOutput> & { _idx: number; _hero: boolean; _orient: 'portrait'|'landscape'|'square' })[],
  numCols: number,
  maxRows: number
): QuiltedOutput[] {
  const heights = Array<number>(numCols).fill(0); // skyline per column
  const placed: { originalIndex: number; cols: number; rows: number }[] = [];

  function findPosition(wCols: number): { x: number; y: number } | null {
    let bestX = -1, bestY = Number.MAX_SAFE_INTEGER;
    for (let x = 0; x <= numCols - wCols; x++) {
      let y = 0;
      for (let c = x; c < x + wCols; c++) y = Math.max(y, heights[c]);
      if (y < bestY || (y === bestY && x < bestX)) { bestY = y; bestX = x; }
    }
    return bestX === -1 ? null : { x: bestX, y: bestY };
  }

  function placeAt(x: number, y: number, wCols: number, hRows: number) {
    const target = y + hRows;                       // IMPORTANT: raise to bestY + rows
    for (let c = x; c < x + wCols; c++) heights[c] = target;
  }

  for (const n of planned) {
    let cols = clamp(n.cols, 1, numCols);
    let rows = clamp(n.rows, 1, maxRows);

    // Try to place; if not, shrink width and re-apply orientation rule
    let done = false;
    while (cols >= 1 && !done) {
      const pos = findPosition(cols);
      if (pos) {
        // Enforce hero orientation strictly so portrait never becomes horizontal and vice-versa
        const fixed = n._hero
          ? enforceHeroOrientation(n._orient, cols, rows, numCols, maxRows)
          : { cols, rows }; // normals are 1x1 already

        cols = fixed.cols;
        rows = fixed.rows;

        // Re-validate with possibly changed cols
        const pos2 = findPosition(cols);
        if (pos2) {
          placeAt(pos2.x, pos2.y, cols, rows);
          placed.push({ originalIndex: n._idx, cols, rows });
          done = true;
          break;
        }
      }
      // Couldn’t place at this width → shrink and keep orientation safe for heroes
      cols -= 1;
      if (n._hero) {
        if (n._orient === 'landscape') rows = Math.min(rows, cols);
        else if (n._orient === 'portrait') rows = clamp(Math.max(rows, cols), 1, maxRows);
        else rows = Math.min(rows, cols);
      } else {
        rows = Math.min(rows, cols);
      }
    }

    // Fallback: guaranteed fit
    if (!done) {
      const pos = findPosition(1)!;
      placeAt(pos.x, pos.y, 1, 1);
      placed.push({ originalIndex: n._idx, cols: 1, rows: 1 });
    }
  }

  return placed.map(p => ({
    ...p,
    cols: p.cols,
    rows: p.rows
  }));
}

export function planQuiltSpans(
  items: QuiltedInput[],
  numCols: number,
  opts: HeroPlanOptions = {}
): QuiltedOutput[] {
  const {
    heroRatio = 0.25,
    heroMinCols = 2,
    heroMaxCols = 3,
    maxRows = 4,
    portraitThreshold = 1.2,
    landscapeThreshold = 0.85,
    baseRowsLandscape = 2,
    baseRowsSquare = 2,
    baseRowsPortrait = 3,
    seed
  } = opts;

  const rng = makeRng(seed);

  // 1) Choose heroes
  const idxs = [...items.keys()];
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  const nHeroes = clamp(Math.round(items.length * heroRatio), 0, items.length);
  const heroSet = new Set(idxs.slice(0, nHeroes));

  // 2) Create initial plan
  const lo = Math.max(1, Math.min(heroMinCols, numCols));
  const hi = Math.max(lo, Math.min(heroMaxCols, numCols));

  const prelim = items.map((it, i) => {
    const orient = classify(it.height, it.width, portraitThreshold, landscapeThreshold);
    const isHero = heroSet.has(i) && numCols >= 2;

    if (!isHero) {
      // normals
      return { _idx: i, _hero: false, _orient: orient, cols: 1, rows: 1 };
    }

    // hero width
    let cols = lo + Math.floor(rng() * (hi - lo + 1));
    cols = clamp(cols, 1, numCols);

    // hero rows by orientation band
    let rows =
      orient === 'portrait'
        ? baseRowsPortrait + (it.height / it.width > portraitThreshold * 1.6 ? 1 : 0)
        : orient === 'landscape'
        ? baseRowsLandscape
        : baseRowsSquare;

    const fixed = enforceHeroOrientation(orient, cols, rows, numCols, maxRows);
    return { _idx: i, _hero: true, _orient: orient, cols: fixed.cols, rows: fixed.rows };
  });

  // 3) Interleave to avoid consecutive heroes (demotes extras if necessary)
  const interleaved = interleaveNoConsecutive(prelim, rng);

  // 4) Gap-free packing that preserves order and keeps hero orientation strict
  return packGapFree(interleaved, numCols, maxRows);
}