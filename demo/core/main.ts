import {planQuiltSpans, QuiltedGrid} from '../../src/index'
import type {QuiltedTile} from '../../src/index'
import images from '../dummy.json'
// import '../src/lib/style.css';
// const images = planQuiltSpans(itemsWithDims, 3)

const el = document.getElementById('gallery')!;
const btn = document.getElementById('btn')!;
const btn2 = document.getElementById('btn2')!;
const btn3 = document.getElementById('btn3')!;
const btn4 = document.getElementById('btn4')!;
const g = new QuiltedGrid(el, {
  cols: 3,
  rowHeight: 140,
  gap: 4,
  onTileClick: ({ tile, index, event }) => {
    console.log('clicked via callback', tile, index, event);
  }
});

btn.addEventListener('click', () => {
  g.animate(() => {
    g.tiles[0].update({ rows: 1, cols: 1 });
  });
});

btn2.addEventListener('click', () => {
  // g.addTile({
  //     src: 'https://images.unsplash.com/photo-1589118949245-7d38baf380d6',
  //     title: 'Bike',
  //     cols: 2,
  //   }, {index: 0, animate: true})

  // --- Option A: build a tile using data-* attributes only ---
  function createQuiltTile({ src = '', alt = '', title = '', rows = 1, cols = 1, srcset = '' } = {}) {
    const div = document.createElement('div');
    // set spans
    div.dataset.rows = String(rows > 0 ? rows : 1);
    div.dataset.cols = String(cols > 0 ? cols : 1);
    // set image data (your gallery will read these)
    if (src) div.dataset.src = src;
    if (srcset) div.dataset.srcset = srcset;
    if (alt) div.dataset.alt = alt;
    if (title) div.dataset.title = title;
    // (optional) if you want the class early; constructor also ensures it
    // div.classList.add('qg-item');
    return div;
  }

  // --- Option B: build a tile with an <img> inside ---
  function createQuiltImgTile({ src = '', alt = '', title = '', rows = 1, cols = 1, srcset = '' } = {}) {
    const div = document.createElement('div');
    div.dataset.rows = String(rows > 0 ? rows : 1);
    div.dataset.cols = String(cols > 0 ? cols : 1);

    const img = document.createElement('img');
    if (src) img.src = src;
    if (srcset) img.setAttribute('srcset', srcset);
    img.alt = alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    if (title) div.dataset.title = title;

    div.appendChild(img);
    return div;
  }

  // --- Example usage with your gallery instance ---
  /*
    Assuming:
      const gallery = new QuiltedGrid(document.getElementById('gallery'));
  */

  // A) Using data-attributes only
  const tileA = createQuiltTile({
    src: '/images/photo-a.jpg',
    alt: 'Photo A',
    rows: 2,
    cols: 3
  });
  // g.addTileElement(tileA, { index: 0, animate: true });

  // B) Using an inner <img>
  const tileB = createQuiltImgTile({
    src: 'https://images.unsplash.com/photo-1589118949245-7d38baf380d6',
    alt: 'Photo B',
    rows: 1,
    cols: 2,
    // srcset: '/images/photo-b@2x.jpg 2x'
  });
  g.addTileElement(tileB, { index: 1, animate: true });

});

btn3.addEventListener('click', () => {
  g.refresh()
});

btn4.addEventListener('click', () => {
  g.removeTileAt(4)
});

(window as any).g = g; // for quick tinkering in console
