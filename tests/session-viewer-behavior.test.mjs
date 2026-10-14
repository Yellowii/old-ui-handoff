import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Mesh, Vector3 } from 'three';
import { SessionViewer } from '../src/appearance/session-viewer.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

// Skip WebGL/DOM construction, but use actual exported prototype methods and
// inherited distance/fit/resize behavior with vector-backed camera mocks.
function fixture() {
  const viewer = Object.create(SessionViewer.prototype);
  const calls = { controls: 0, projection: 0, size: [] };
  Object.assign(viewer, {
    radius: 2, height: 4, actor: {}, sessionZoom: null, userGesture: false,
    camera: {
      position: new Vector3(0, 0, 10), aspect: 1,
      updateProjectionMatrix() { calls.projection++; },
    },
    controls: { target: new Vector3(), update() { calls.controls++; } },
    grid: { scale: new Vector3(1, 1, 1) },
    host: { getBoundingClientRect: () => ({ width: 100, height: 200 }) },
    renderer: { setSize: (...args) => calls.size.push(args) },
  });
  return { viewer, calls };
}

test('depth range protects near limbs and includes large environments and distant camera', () => {
  const { viewer, calls } = fixture();
  viewer.updateDepthRange();
  close(viewer.camera.near, 0.0002);
  assert.equal(viewer.camera.far, 1000);
  viewer.environmentRadius = 800;
  viewer.updateDepthRange();
  assert.equal(viewer.camera.far, 1610);
  viewer.radius = 1000;
  viewer.updateDepthRange();
  close(viewer.camera.near, 0.01);
  assert.equal(viewer.camera.far, 200010);
  viewer.radius = 0.001;
  viewer.updateDepthRange();
  close(viewer.camera.near, 0.0001);
  assert.equal(calls.projection, 4);
});

test('user zoom stores the clamped actual factor and ignores non-finite inputs', () => {
  const { viewer, calls } = fixture();
  viewer.controls.target.set(1, 2, 3);
  viewer.camera.position.set(1, 2, 13);
  close(viewer.zoomFactor(), 5);
  viewer.setUserZoom(3);
  close(viewer.zoomFactor(), 3);
  close(viewer.sessionZoom, 3);
  assert.deepEqual(viewer.camera.position.toArray(), [1, 2, 9]);
  viewer.setUserZoom(-1);
  close(viewer.sessionZoom, 0.02);
  viewer.setUserZoom(1000);
  close(viewer.sessionZoom, 200);
  const position = viewer.camera.position.clone();
  const count = calls.controls;
  for (const value of [NaN, Infinity, '2']) viewer.setUserZoom(value);
  assert.equal(viewer.camera.position.equals(position), true);
  assert.equal(calls.controls, count);
});

test('adjustCamera restores nesting and gesture zoom even when callback throws', () => {
  const { viewer } = fixture();
  viewer.userGesture = true;
  viewer.adjustingCamera = 2;
  assert.throws(() => viewer.adjustCamera(() => {
    assert.equal(viewer.adjustingCamera, 3);
    viewer.camera.position.set(0, 0, 6);
    throw new Error('fixture camera failure');
  }), /fixture camera failure/);
  assert.equal(viewer.adjustingCamera, 2);
  assert.equal(viewer.gestureZoom, 3);
  assert.equal(viewer.adjustCamera(() => 'fixture-result'), 'fixture-result');
  assert.equal(viewer.adjustingCamera, 2);
});

test('restoreSessionZoom is inert without a saved value and reapplies it after fitting', () => {
  const { viewer, calls } = fixture();
  viewer.restoreSessionZoom();
  assert.equal(calls.controls, 0);
  viewer.sessionZoom = 1.5;
  viewer.fit();
  close(viewer.zoomFactor(), 1.5);
  assert.equal(viewer.sessionZoom, 1.5);
  assert.equal(viewer.adjustingCamera, 0);
  assert.deepEqual(viewer.controls.target.toArray(), [0, 2, 0]);
  viewer.resetCamera();
  assert.equal(viewer.sessionZoom, null);
  close(viewer.zoomFactor(), Math.hypot(0.3, 0.18, 3.3));
});

test('frameVisible and resize preserve saved zoom across bounds and aspect changes', () => {
  const { viewer, calls } = fixture();
  viewer.sessionZoom = 2.5;
  viewer.world = { updateMatrixWorld() {} };
  const actor = new Mesh(new BoxGeometry(2, 4, 2));
  viewer.actor = actor;
  viewer.companions = new Map();
  viewer.frameVisible(180);
  close(viewer.zoomFactor(), 2.5);
  close(viewer.radius, Math.sqrt(24) / 2);
  viewer.resize();
  assert.equal(viewer.camera.aspect, 0.5);
  close(viewer.zoomFactor(), 2.5);
  assert.deepEqual(calls.size, [[100, 200, false]]);
});

test('resetCamera forces pair reframing and clears manual and saved zoom state', () => {
  const { viewer } = fixture();
  viewer.sessionZoom = 2;
  viewer.multiActorTransform = {};
  viewer.pairFraming = { manual: true };
  let forced;
  viewer.updatePreviewFraming = force => {
    forced = force;
    assert.equal(viewer.pairFraming, null);
  };
  viewer.resetCamera();
  assert.equal(forced, true);
  assert.equal(viewer.sessionZoom, null);
});

test('return-idle framing waits for restored idle rather than framing the stale pose', () => {
  const { viewer } = fixture();
  const previous = { actor: viewer.actor };
  viewer.pairFraming = previous;
  viewer.playingIdle = false;
  viewer.world = { updateMatrixWorld() { assert.fail('must wait for idle'); } };
  viewer.updatePreviewFraming();
  assert.equal(viewer.pairFraming, previous);
});
