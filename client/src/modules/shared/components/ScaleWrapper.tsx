import React, { useEffect, useState, useRef } from 'react';

export default function ScaleWrapper({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        const pWidth = parent ? parent.clientWidth : 0;
        const pHeight = parent ? parent.clientHeight : 0;

        // Use parent dimensions if set and non-zero, otherwise fall back to window viewport
        const isFS = Boolean(document.fullscreenElement);
        const width = isFS || pWidth < 50 ? window.innerWidth : pWidth;
        const height = isFS || pHeight < 50 ? window.innerHeight : pHeight;

        // Uniform scaling to fit perfectly without cuts (maintaining 16:9 aspect ratio)
        const scaleW = width / 1920;
        const scaleH = height / 1080;
        const calculated = Math.min(scaleW, scaleH);
        setScale(Number.isFinite(calculated) && calculated > 0 ? calculated : 1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    document.addEventListener('fullscreenchange', updateScale);
    document.addEventListener('webkitfullscreenchange', updateScale);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current?.parentElement) {
      ro = new ResizeObserver(() => updateScale());
      ro.observe(containerRef.current.parentElement);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      document.removeEventListener('fullscreenchange', updateScale);
      document.removeEventListener('webkitfullscreenchange', updateScale);
      if (ro) ro.disconnect();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }} ref={containerRef}>
      <div
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}