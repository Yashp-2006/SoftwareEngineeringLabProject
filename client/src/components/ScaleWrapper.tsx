import React, { useEffect, useState, useRef } from 'react';

export default function ScaleWrapper({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement || document.body;
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        
        setScale({
          x: width / 1920,
          y: height / 1080
        });
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', background: '#000' }} ref={containerRef}>
      <div
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale.x}, ${scale.y})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}