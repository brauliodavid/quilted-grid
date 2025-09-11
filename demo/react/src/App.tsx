import { useEffect, useRef, useState } from 'react';
import { QuiltedGrid, QuiltedTile, type QuiltedGridRef } from 'quilted-grid/react';
import { QuiltedGrid as QG, QuiltedTile as QT } from 'quilted-grid';
import items from '../../dummy.json'

const images: QT[] = items

export default function App() {
  const ref = useRef<QuiltedGridRef>(null);
  const [grid, setGrid] = useState<QG>(null);
  const [ordered, setOrdered] = useState<any[]>([])

  useEffect(() => {
    if(ref?.current){
      setGrid(ref.current.grid as any)
    }

    setTimeout(() => {
      setOrdered([
        {rows: 1, cols: 2},
        {rows: 1, cols: 1},
        {rows: 3, cols: 2},
        {rows: 1, cols: 1},
      ])
    }, 1000)

    setTimeout(() => {
      setOrdered([
        {rows: 1, cols: 2},
        {rows: 1, cols: 1},
        {rows: 3, cols: 2},
        {rows: 1, cols: 1},
        {rows: 1, cols: 2},
      ])
    }, 4000)
  }, [ref])

  const add = () => {
    grid?.addTile(images[2])
  };

  const relayout = () => {
    grid.refresh()
  };

  const onClick = (e) => {
    console.log(e)
  }

  return (
    <div style={{'width': '428px'}}>
      <button onClick={add}>Add</button>
      <button onClick={relayout}>Relayout</button>
      <QuiltedGrid
        ref={ref}
        options={{ cols: 4, rowHeight: 121, gap: 2, injectDefaultCSS: true }}
        style={{ width: "100%" }}
      >
        {ordered.map((p: any, i) => 
          <QuiltedTile key={i} rows={p.rows} cols={p.cols} onClick={onClick}>
           <img src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d"/>
          </QuiltedTile>)}
      </QuiltedGrid>
    </div>
  );
}
