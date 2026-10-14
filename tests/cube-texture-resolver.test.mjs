import test from 'node:test';
import assert from 'node:assert/strict';
import { configureHandoffServices } from '../src/handoff/services.js';
import { installAssetLoaders } from '../src/handoff/asset-loaders.js';

test('cubeTexture resolver resolves all six faces with cube-face context in order', async t => {
  const calls = [];
  configureHandoffServices({
    assetResolver: async (ref, context) => {
      calls.push({ ref, context });
      return `resolved:${ref.url}`;
    },
  });
  t.after(() => configureHandoffServices());
  const faces = ['fixture-right', 'fixture-left', 'fixture-top', 'fixture-bottom', 'fixture-front', 'fixture-back'];
  const resolved = await installAssetLoaders({ source: 'fixture-policy' }).cubeTexture.resolve(faces, { modelId: 'fixture-model' });
  assert.deepEqual(resolved, faces.map(face => `resolved:${face}`));
  assert.deepEqual(calls, faces.map((face, faceIndex) => ({
    ref: { url: face },
    context: { kind: 'cube-texture', runtimePolicy: { source: 'fixture-policy' }, modelId: 'fixture-model', faceIndex },
  })));
});

test('cubeTexture resolver rejects the whole face set when one face is unavailable', async t => {
  let calls = 0;
  configureHandoffServices({
    assetResolver: async (ref, context) => {
      calls++;
      if (context.faceIndex === 4) return null;
      return `resolved:${ref.url}`;
    },
  });
  t.after(() => configureHandoffServices());
  const faces = Array.from({ length: 6 }, (_, index) => `fixture-face-${index}`);
  await assert.rejects(
    installAssetLoaders().cubeTexture.resolve(faces),
    /Asset URL unavailable for cube-texture/,
  );
  assert.equal(calls, 6);
});
