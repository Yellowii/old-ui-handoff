import test from 'node:test';
import assert from 'node:assert/strict';
import { WardrobeViewer } from '../src/viewer.js';
import { configureHandoffServices } from '../src/handoff/services.js';

function fixture(runtimePolicy = {}) {
  const calls = [];
  const texture = {};
  const viewer = Object.create(WardrobeViewer.prototype);
  Object.assign(viewer, {
    runtimePolicy, textureCache: new Map(),
    textures: { async loadAsync(url) { calls.push(url); return texture; } },
    renderer: { capabilities: { getMaxAnisotropy: () => 4 } },
  });
  return { viewer, calls, texture };
}

function cubeBytes() {
  const buffer = new ArrayBuffer(128 + 6 * 8);
  const view = new DataView(buffer);
  const header = { 0: 0x20534444, 1: 124, 2: 8, 3: 1, 4: 1, 5: 8, 19: 32, 20: 4, 21: 113, 28: 0xfe00 };
  for (const [index, value] of Object.entries(header)) view.setUint32(Number(index) * 4, value, true);
  return buffer;
}

test('legacy cube prefix has no automatic DDS ownership without a host matcher', async () => {
  const { viewer, calls, texture } = fixture();
  configureHandoffServices({ catalogProvider: () => { assert.fail('must not request cube bytes'); } });
  assert.equal(await viewer.texture('/assets/game/cubes/synthetic'), texture);
  assert.deepEqual(calls, ['/assets/game/cubes/synthetic']);
});

test('host-approved cube uses DDS provider bytes at a resource-neutral URL and caches the result', async () => {
  const matched = [], requested = [];
  const { viewer, calls } = fixture({ sourceCubeMatcher: (url, context) => {
    matched.push({ url, context });
    return url === 'fixture:cube';
  } });
  configureHandoffServices({ catalogProvider: ({ url }) => { requested.push(url); return cubeBytes(); } });
  const cube = await viewer.texture('fixture:cube');
  assert.equal(cube.isCubeTexture, true);
  assert.equal(cube.images.length, 6);
  assert.equal(await viewer.texture('fixture:cube'), cube);
  assert.deepEqual(requested, ['fixture:cube']);
  assert.deepEqual(calls, []);
  assert.deepEqual(matched[0], { url: 'fixture:cube', context: { kind: 'cube-texture' } });
  cube.dispose();
});

test('failed approved cube bytes evict the promise so an explicit retry can succeed', async () => {
  const { viewer } = fixture({ sourceCubeMatcher: () => true });
  let attempts = 0;
  configureHandoffServices({ catalogProvider: () => ++attempts === 1 ? new ArrayBuffer(4) : cubeBytes() });
  await assert.rejects(viewer.texture('fixture:retry'), /Truncated cube DDS header/);
  assert.equal(viewer.textureCache.size, 0);
  const cube = await viewer.texture('fixture:retry');
  assert.equal(attempts, 2);
  assert.equal(cube.isCubeTexture, true);
  cube.dispose();
});
