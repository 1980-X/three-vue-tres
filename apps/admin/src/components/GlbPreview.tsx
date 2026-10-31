import { useEffect, useRef } from 'react';

/** 简易 iframe 预览：用 model-viewer CDN（管理端预览足够） */
export function GlbPreview({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const mv = document.createElement('model-viewer') as HTMLElement & {
      src: string;
      setAttribute: (k: string, v: string) => void;
    };
    mv.setAttribute('src', url);
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('style', 'width:100%;height:360px;background:#111');
    el.appendChild(mv);

    if (!customElements.get('model-viewer')) {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
      document.head.appendChild(s);
    }
  }, [url]);

  return <div ref={ref} />;
}
