import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, NumberKeyframeTrack, Object3D } from 'three';
import { SourceMotionExtra, applySourceExtraAngle, motionExtrasReady } from '../src/source-motion-extras.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const clip = (name, duration, start, end) => new AnimationClip(name, duration, [
  new NumberKeyframeTrack('.position[x]', [0, duration], [start, end]),
]);
function appearFixture(t, playback = 'appear-loop') {
  const root = new Object3D();
  const extra = new SourceMotionExtra(root, [clip('fixture-appear', 2, 0, 20), clip('fixture-idle', 4, 100, 140)], playback);
  t.after(() => extra.stop());
  return { root, extra };
}

test('appear-loop seeks into intro, switches exactly at boundary, loops, and can rewind', t => {
  const { root, extra } = appearFixture(t);
  assert.equal(extra.phase, 'intro');
  extra.seek(1);
  close(root.position.x, 10);
  extra.seek(2);
  assert.equal(extra.phase, 'loop');
  close(root.position.x, 100);
  assert.equal(extra.actions[0].isRunning(), false);
  assert.equal(extra.actions[1].isRunning(), true);
  extra.seek(7);
  close(extra.actions[1].time, 1);
  close(root.position.x, 110);
  extra.seek(0.5);
  assert.equal(extra.phase, 'intro');
  close(root.position.x, 5);
  assert.equal(extra.actions[1].isRunning(), false);
  extra.seek(-3);
  assert.equal(extra.elapsed, 0);
  close(root.position.x, 0);
});

test('independent roots have independent mixers, elapsed times, pause and rate', t => {
  const first = appearFixture(t);
  const second = appearFixture(t);
  assert.notEqual(first.extra.mixer, second.extra.mixer);
  first.extra.update(0.5, 2);
  close(first.extra.elapsed, 1);
  close(first.root.position.x, 10);
  close(second.extra.elapsed, 0);
  close(second.root.position.x, 0);
  first.extra.update(10, 4, true);
  close(first.extra.elapsed, 1);
  close(first.root.position.x, 10);
  first.extra.update(10, 0);
  close(first.extra.elapsed, 1);
  second.extra.update(0.5, 0.5);
  close(second.extra.elapsed, 0.25);
  close(second.root.position.x, 2.5);
  first.extra.seek(3);
  close(first.root.position.x, 110);
  close(second.root.position.x, 2.5);
});

test('loop wraps and single clamps sample time without clamping elapsed time', t => {
  for (const [playback, expected] of [['loop', 5], ['single', 20]]) {
    const root = new Object3D();
    const extra = new SourceMotionExtra(root, [clip(`fixture-${playback}`, 2, 0, 20)], playback);
    t.after(() => extra.stop());
    extra.seek(4.5);
    assert.equal(extra.elapsed, 4.5);
    assert.equal(extra.phase, playback);
    close(root.position.x, expected);
    extra.seek(0.25);
    close(root.position.x, 2.5);
  }
});

test('graph-open-idle uses its independent 0.2-second weighted transition', t => {
  const { extra, root } = appearFixture(t, 'graph-open-idle');
  extra.seek(1);
  assert.equal(extra.phase, 'intro');
  close(root.position.x, 10);
  extra.seek(2.09);
  assert.equal(extra.phase, 'transition');
  close(extra.actions[0].getEffectiveWeight(), 0.5);
  close(extra.actions[1].getEffectiveWeight(), 0.5);
  close(root.position.x, 60.5);
  extra.seek(2.2);
  assert.equal(extra.phase, 'loop');
  close(root.position.x, 102.1);
  extra.seek(0.5);
  assert.equal(extra.phase, 'intro');
  close(root.position.x, 5);
});

test('stop uncaches the root and stops actions without affecting another mixer', t => {
  const first = appearFixture(t);
  const second = appearFixture(t);
  first.extra.seek(1);
  second.extra.seek(1);
  const originalClip = first.extra.clips[0];
  first.extra.stop();
  assert.equal(first.extra.actions.every(action => !action.isRunning()), true);
  assert.equal(first.extra.mixer.existingAction(originalClip, first.root), null);
  second.extra.update(0.5);
  close(second.root.position.x, 15);
  close(second.extra.elapsed, 1.5);
});

test('empty extras remain static and unsupported animation shapes reject', () => {
  const root = new Object3D();
  const extra = new SourceMotionExtra(root, []);
  extra.seek(5);
  extra.update(3);
  extra.stop();
  assert.equal(extra.phase, 'static');
  assert.equal(extra.elapsed, 5);
  assert.equal(extra.mixer, undefined);
  assert.throws(() => new SourceMotionExtra(root, [clip('fixture-one', 1, 0, 1)]), /./);
  assert.throws(() => new SourceMotionExtra(root, [clip('fixture-one', 1, 0, 1)], 'unsupported'), /./);
});

test('readiness is role-specific and source angles use validated ZXY degrees', () => {
  const item = { id: 'fixture-extra', animKey: 'fixture-role', rule: { extra_model_infos: [{}] } };
  assert.equal(motionExtrasReady({}, {}), true);
  assert.equal(motionExtrasReady(item, {}), false);
  assert.equal(motionExtrasReady(item, { items: { 'fixture-extra': { roles: { 'fixture-role': { status: 'ready' } } } } }), true);
  assert.equal(motionExtrasReady(item, { items: { 'fixture-extra': { animKey: 'fixture-other-role', status: 'ready' } } }), false);
  const root = new Object3D();
  applySourceExtraAngle(root, [90, '180', -90]);
  assert.equal(root.rotation.order, 'ZXY');
  close(root.rotation.x, Math.PI / 2);
  close(root.rotation.y, Math.PI);
  close(root.rotation.z, -Math.PI / 2);
  for (const angle of [null, [0, 0], [0, 0, Infinity]]) assert.throws(() => applySourceExtraAngle(root, angle), /./);
});
