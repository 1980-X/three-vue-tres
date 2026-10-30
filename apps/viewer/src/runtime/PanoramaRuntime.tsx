import { useEffect, useRef } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';

export function PanoramaRuntime({ imageUrl }: { imageUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const viewer = new Viewer({
      container: ref.current,
      panorama: imageUrl,
      navbar: ['zoom', 'move', 'fullscreen'],
    });
    return () => {
      viewer.destroy();
    };
  }, [imageUrl]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}
