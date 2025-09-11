import { useEffect, useRef, useState } from 'react';
import { QuiltedGrid, QuiltedTile, type QuiltedGridRef } from 'quilted-grid/react';
import { QuiltedGrid as QG, QuiltedTile as QT } from 'quilted-grid';
import items from '../../dummy.json'

const images: QT[] = items

export default function App() {
  const ref = useRef<QuiltedGridRef>(null);
  const [gallery, setGallery] = useState<QG>(null);

  useEffect(() => {
    if(ref?.current){
      setGallery(ref.current.grid as any)
    }
  }, [ref])

  const add = () => {
    gallery?.addTile(images[2])
  };

  const relayout = () => {
    gallery?.destroy()
    gallery?.render()
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
        <QuiltedTile rows={2} cols={3} onClick={onClick}>
           <img src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d"/>
        </QuiltedTile>
        <QuiltedTile rows={1} cols={1}>
           <img src="https://images.unsplash.com/photo-1551963831-b3b1ca40c98e"/>
        </QuiltedTile>
        <QuiltedTile rows={2} cols={3}>
           <img src="https://images.unsplash.com/photo-1551963831-b3b1ca40c98e"/>
        </QuiltedTile>
      </QuiltedGrid>
    </div>
  );
}
