import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 一期最小 3D 漫游壳：OrbitControls + 可选入口贴图。
 * 完整 TvT 引擎别名加载可在后续迭代替换本组件，禁止 iframe 案例壳。
 */
export function Scene3dRuntime({
  entryUrl,
  enableXr,
}: {
  entryUrl?: string;
  enableXr: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startXrRef = useRef<null | (() => Promise<void>)>(null);
  const [xrBusy, setXrBusy] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    const camera = new THREE.PerspectiveCamera(
      60,
      el.clientWidth / Math.max(el.clientHeight, 1),
      0.1,
      1000,
    );
    camera.position.set(2, 1.5, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
    scene.add(light);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x4a90e2 }),
    );
    box.position.y = 0.5;
    scene.add(box);

    if (entryUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(entryUrl, (tex) => {
        const mat = new THREE.MeshBasicMaterial({ map: tex });
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), mat);
        panel.position.set(0, 1.2, -2);
        scene.add(panel);
      });
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      camera.aspect = el.clientWidth / Math.max(el.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let xrSession: XRSession | null = null;
    startXrRef.current = async () => {
      if (!enableXr || !navigator.xr) return;
      setXrBusy(true);
      try {
        xrSession = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor'],
        });
        await renderer.xr.setSession(xrSession);
        renderer.xr.enabled = true;
      } catch {
        /* keep desktop orbit */
      } finally {
        setXrBusy(false);
      }
    };

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      startXrRef.current = null;
      if (renderer.domElement.parentElement === el) {
        el.removeChild(renderer.domElement);
      }
      void xrSession?.end();
    };
  }, [entryUrl, enableXr]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
      {enableXr && (
        <button
          type="button"
          disabled={xrBusy}
          onClick={() => void startXrRef.current?.()}
          style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 3 }}
        >
          进入 VR
        </button>
      )}
    </div>
  );
}
