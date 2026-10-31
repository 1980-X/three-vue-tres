import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSceneGraph } from '../src/threejs/scene-graph.js';
import { exportSceneGraphToGlb } from '../src/threejs/sandbox.js';

describe('threejs-sandbox', () => {
  it('exports glb magic', async () => {
    const buf = await exportSceneGraphToGlb({
      version: 1,
      nodes: [
        {
          id: 'a',
          primitive: 'box',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: '#ff0000',
        },
      ],
    });
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'glTF');
  });

  it('rejects too many nodes', () => {
    assert.throws(() =>
      parseSceneGraph({
        version: 1,
        nodes: Array.from({ length: 40 }, (_, i) => ({
          id: String(i),
          primitive: 'box',
        })),
      }),
    );
  });
});
