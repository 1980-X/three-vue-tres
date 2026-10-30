import { useEffect, useState } from 'react';

export function useWebXr() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const xr = navigator.xr;
    if (!xr?.isSessionSupported) {
      setSupported(false);
      return;
    }
    xr.isSessionSupported('immersive-vr')
      .then((ok) => {
        if (!cancelled) setSupported(ok);
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return supported;
}
