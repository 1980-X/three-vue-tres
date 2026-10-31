import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { SceneGraph } from './scene-graph.js';
import { AppError } from '../lib/errors.js';

function geometryFor(
  primitive: SceneGraph['nodes'][number]['primitive'],
): BufferGeometry {
  switch (primitive) {
    case 'box':
      return new BoxGeometry(1, 1, 1);
    case 'sphere':
      return new SphereGeometry(0.5, 24, 16);
    case 'cylinder':
      return new CylinderGeometry(0.5, 0.5, 1, 24);
    case 'plane':
      return new PlaneGeometry(1, 1);
    default:
      return new BoxGeometry(1, 1, 1);
  }
}

export async function exportSceneGraphToGlb(graph: SceneGraph): Promise<Buffer> {
  const scene = new Scene();
  for (const node of graph.nodes) {
    const mat = new MeshStandardMaterial({ color: node.color });
    const mesh = new Mesh(geometryFor(node.primitive), mat);
    mesh.name = node.id;
    mesh.position.set(...node.position);
    mesh.rotation.set(...node.rotation);
    mesh.scale.set(...node.scale);
    scene.add(mesh);
  }

  const exporter = new GLTFExporter();
  const timeoutMs = 5_000;

  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError('timeout', 'Three.js 导出超时', 504));
    }, timeoutMs);
    exporter.parse(
      scene,
      (result) => {
        clearTimeout(timer);
        if (result instanceof ArrayBuffer) resolve(result);
        else {
          reject(new AppError('internal_error', 'GLB 导出结果异常', 500));
        }
      },
      (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
      { binary: true },
    );
  });

  return Buffer.from(arrayBuffer);
}
