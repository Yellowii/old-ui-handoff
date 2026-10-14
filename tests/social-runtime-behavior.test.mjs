import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SocialRuntimeBridge, DISTANCE_CONTRACT_VERSION, RUNTIME_CONTRACT_FAMILIES,
} from '../src/appearance/runtime/social-runtime.js';

const actors = { senderId: 'fixture-sender', receiverId: 'fixture-receiver' };
const action = (overrides = {}) => ({
  id: 'fixture-action', send_motion: 'fixture-send', receive_motion: 'fixture-receive',
  max_time_duration: 4, ...overrides,
});
// These small integers are synthetic effect values, not catalog/game IDs.
const effectAction = () => action({
  send_animation_before_real_start: 'fixture-intro', is_force_special_status: true,
  send_buff_conf_in_motion: 11, send_buff_conf_after_motion: [12], receive_buff_conf_after_motion: [13],
});

function fixture(options = {}) {
  const calls = [];
  const runtime = new SocialRuntimeBridge({
    clock: { now: () => 1234 },
    effects: {
      emit: event => calls.push({ operation: 'emit', ...event }),
      apply: effect => calls.push({ operation: 'apply', ...effect }),
      remove: effect => calls.push({ operation: 'remove', ...effect }),
    },
    ...options,
  });
  return { runtime, calls };
}
const types = runtime => runtime.snapshot().events.map(event => event.type);

test('prepare resolves catalog action, normalizes timing, and start is idempotent', () => {
  const row = effectAction();
  const { runtime, calls } = fixture({ catalog: { get: id => id === row.id ? row : undefined } });
  assert.equal(runtime.snapshot().state, 'idle');
  assert.throws(() => runtime.start(), /not prepared/);
  const prepared = runtime.prepare(row.id, actors);
  assert.equal(prepared.state, 'prepared');
  assert.equal(prepared.sessionId, 'fixture-action:1');
  assert.equal(prepared.durationSeconds, 4);
  assert.equal(prepared.timing.mode, 'hard-stop-seconds');
  assert.deepEqual(prepared.contractGaps, []);
  assert.deepEqual(calls.map(call => call.type), ['prepare']);
  row.send_motion = 'fixture-mutated-after-prepare';
  const running = runtime.start();
  assert.equal(running.state, 'running');
  assert.equal(running.appliedEffects.length, 3);
  assert.deepEqual(types(runtime), ['prepare', 'pre-start', 'effect-apply', 'effect-apply', 'effect-apply', 'start', 'motion-start', 'motion-start']);
  const motion = calls.find(call => call.type === 'motion-start');
  assert.equal(motion.motion, 'fixture-send');
  assert.equal(motion.actorId, actors.senderId);
  assert.equal(motion.at, 1234);
  const count = calls.length;
  runtime.start();
  assert.equal(calls.length, count);
});

test('pause freezes elapsed time and resume does not reapply starting effects', () => {
  const { runtime, calls } = fixture();
  runtime.prepare(effectAction(), actors);
  runtime.start();
  runtime.update(0.5);
  assert.equal(runtime.pause().state, 'paused');
  const count = calls.length;
  assert.equal(runtime.tick(2).elapsed, 0.5);
  runtime.pause();
  assert.equal(calls.length, count);
  runtime.resume();
  assert.equal(types(runtime).at(-1), 'resume');
  assert.equal(calls.filter(call => call.operation === 'apply').length, 3);
  assert.equal(runtime.tick(0.25).elapsed, 0.75);
  assert.equal(runtime.tick(-10).elapsed, 0.75);
  assert.equal(runtime.tick(NaN).elapsed, 0.75);
});

test('characterization: tick ignores stored playback rate, including zero', () => {
  const { runtime } = fixture();
  runtime.prepare(action({ max_time_duration: 20 }), actors);
  runtime.start();
  runtime.setRate(2);
  // Inherited behavior: rate is metadata; tick does not multiply delta by it.
  assert.equal(runtime.tick(1).elapsed, 1);
  runtime.setRate(0);
  assert.equal(runtime.tick(1).elapsed, 2);
  assert.equal(runtime.snapshot().playbackRate, 0);
});

test('rate normalization clamps and defaults invalid values, emitting only on changes', () => {
  const { runtime } = fixture();
  runtime.prepare(action(), actors);
  assert.equal(runtime.setRate('2').normalizedRate, 2);
  assert.equal(runtime.setRate(100).playbackRate, 4);
  assert.equal(runtime.setRate(-1).playbackRate, 0);
  assert.equal(runtime.setRate(NaN).playbackRate, 1);
  const count = types(runtime).filter(type => type === 'rate-change').length;
  runtime.setRate(1);
  assert.equal(types(runtime).filter(type => type === 'rate-change').length, count);
});

test('seek to end applies post-motion effects once; rewind removes only that phase', () => {
  const { runtime, calls } = fixture();
  runtime.prepare(effectAction(), actors);
  runtime.start();
  assert.equal(runtime.seek(2, { unit: 'fraction' }).elapsed, 4);
  assert.equal(runtime.snapshot().state, 'paused');
  assert.equal(runtime.snapshot().appliedEffects.length, 5);
  const count = calls.filter(call => call.operation === 'apply').length;
  runtime.seek(4);
  assert.equal(calls.filter(call => call.operation === 'apply').length, count);
  runtime.seek(0.25, { unit: 'fraction' });
  assert.equal(runtime.snapshot().elapsed, 1);
  assert.equal(runtime.snapshot().state, 'paused');
  assert.equal(runtime.snapshot().appliedEffects.length, 3);
  assert.deepEqual(calls.filter(call => call.operation === 'remove').map(call => call.phase), ['after-motion', 'after-motion']);
  runtime.resume();
  runtime.tick(100);
  assert.equal(runtime.snapshot().elapsed, 4);
  assert.equal(runtime.snapshot().state, 'paused');
  assert.equal(runtime.snapshot().appliedEffects.length, 5);
  assert.equal(runtime.seek(-1).elapsed, 0);
});

test('seek while prepared updates time without starting motions; completion prevents start until rewind', () => {
  const { runtime } = fixture();
  runtime.prepare(effectAction(), actors);
  assert.equal(runtime.seek(1).state, 'prepared');
  assert.equal(types(runtime).includes('motion-start'), false);
  runtime.seek(4);
  assert.equal(runtime.snapshot().appliedEffects.length, 2);
  assert.equal(runtime.start().state, 'prepared');
  runtime.seek(0);
  assert.equal(runtime.snapshot().appliedEffects.length, 0);
  assert.equal(runtime.start().state, 'running');
});

test('stop removes every applied effect before cleanup and return-idle, resets rate, and is idempotent', () => {
  const { runtime, calls } = fixture();
  runtime.prepare(effectAction(), actors);
  runtime.start();
  runtime.seek(4);
  runtime.setRate(3);
  const appliedKeys = calls.filter(call => call.operation === 'apply').map(call => call.key);
  calls.length = 0;
  const stopped = runtime.stop();
  assert.equal(stopped.state, 'idle');
  assert.equal(stopped.playbackRate, 1);
  assert.deepEqual(stopped.appliedEffects, []);
  assert.deepEqual(calls.filter(call => call.operation === 'remove').map(call => call.key), appliedKeys);
  assert.deepEqual(calls.map(call => call.operation === 'emit' ? call.type : call.operation), [
    'stop', 'remove', 'remove', 'remove', 'remove', 'remove', 'cleanup', 'rate-reset', 'return-idle',
  ]);
  const count = calls.length;
  runtime.stop();
  assert.equal(calls.length, count);
});

test('explicit cleanup removes effects once without changing paused session state', () => {
  const { runtime, calls } = fixture();
  runtime.prepare(effectAction(), actors);
  runtime.start();
  runtime.pause();
  const snapshot = runtime.cleanup();
  assert.equal(snapshot.state, 'paused');
  assert.deepEqual(snapshot.appliedEffects, []);
  runtime.cleanup();
  assert.equal(calls.filter(call => call.operation === 'remove').length, 3);
  runtime.stop({ returnIdle: false });
  assert.equal(runtime.snapshot().actionId, null);
  assert.deepEqual(runtime.snapshot().events, []);
});

test('prepare/reselect clean the prior session before publishing the next and never return it idle', () => {
  const { runtime, calls } = fixture();
  runtime.prepare(effectAction(), actors);
  runtime.start();
  const oldId = runtime.snapshot().sessionId;
  calls.length = 0;
  const next = runtime.prepare(action({ id: 'fixture-next' }), actors);
  assert.equal(next.state, 'prepared');
  assert.equal(next.sessionId, 'fixture-next:2');
  assert.deepEqual(calls.map(call => call.operation === 'emit' ? call.type : call.operation), [
    'stop', 'remove', 'remove', 'remove', 'cleanup', 'prepare',
  ]);
  assert.ok(calls.filter(call => call.operation === 'remove').every(call => call.sessionId === oldId));
  const third = runtime.reselect(action({ id: 'fixture-third' }), actors);
  assert.equal(third.sessionId, 'fixture-third:3');
  assert.deepEqual(third.events.map(event => event.type), ['prepare']);
});

test('distance validation rejects below-threshold or missing positions and accepts valid separation', () => {
  const source = action({ motion_min_distance: 2, distance_contract: DISTANCE_CONTRACT_VERSION });
  const { runtime, calls } = fixture();
  runtime.prepare(source, { ...actors, senderPosition: [0, 0, 0], receiverPosition: [1, 0, 0] });
  assert.equal(runtime.snapshot().distanceValidation.status, 'below-threshold');
  assert.throws(() => runtime.start(), /minimum separation/);
  assert.equal(calls.some(call => call.operation === 'apply' || call.type === 'motion-start'), false);
  runtime.prepare(source, actors);
  assert.equal(runtime.snapshot().distanceValidation.status, 'missing-position');
  assert.throws(() => runtime.start(), /minimum separation/);
  runtime.prepare(source, { ...actors, senderPosition: { x: 0, y: 0, z: 0 }, receiverPosition: [2, 0, 0] });
  assert.deepEqual(runtime.snapshot().contractGaps, []);
  assert.equal(types(runtime).at(-1), 'distance-validated');
  assert.equal(runtime.start().state, 'running');
});

test('unresolved camera and modifier contracts block start before motion or effects', () => {
  for (const [overrides, gap, message] of [
    [{ camera_height_offset: 1 }, RUNTIME_CONTRACT_FAMILIES.camera, /camera or SFX/],
    [{ modifier_id: 1 }, RUNTIME_CONTRACT_FAMILIES.modifier, /modifier/],
  ]) {
    const { runtime, calls } = fixture();
    runtime.prepare(effectActionWith(overrides), actors);
    assert.ok(runtime.snapshot().contractGaps.includes(gap));
    assert.throws(() => runtime.start(), message);
    assert.equal(calls.some(call => call.operation === 'apply' || call.type === 'motion-start'), false);
  }
});

function effectActionWith(overrides) { return { ...effectAction(), ...overrides }; }
