import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Group, Object3D, Vector3 } from 'three';
import { addSourceSockets } from '../src/source-rig.js';

const bone = (name, parent, translation = [0, 0, 0]) => ({
  name, parent, translation, rotation_xyzw: [0, 0, 0, 1], scale: [1, 1, 1],
});
const socket = (name, parent, raw_flag = 2) => ({
  name, parent, raw_flag, raw_trs: [1, 2, 3, 0, 0, 0, 1, 2, 3, 4],
});

test('source sockets reconstruct omitted parents and reuse palette bones by source name', () => {
  const root = new Group();
  const palette = new Bone();
  palette.name = 'fixture-renamed-palette';
  palette.userData.sourceBone = 'fixture-child';
  root.add(palette);
  const source = {
    bones: [bone('fixture-parent', -1, [10, 0, 0]), bone('fixture-child', 0, [0, 5, 0])],
    auxiliary_nodes: [socket('fixture-hand-socket', 1), socket('fixture-root-socket', -2)],
  };
  assert.deepEqual(addSourceSockets(root, source), {
    added: ['fixture-hand-socket', 'fixture-root-socket'], skipped: [],
  });
  const parent = root.getObjectByName('fixture-parent');
  assert.equal(parent.isBone, true);
  assert.equal(palette.parent, parent);
  assert.equal(palette.name, 'fixture-renamed-palette');
  assert.deepEqual(palette.position.toArray(), [0, 5, 0]);
  const hand = root.getObjectByName('fixture-hand-socket');
  const rootSocket = root.getObjectByName('fixture-root-socket');
  assert.equal(hand.parent, palette);
  assert.equal(rootSocket.parent, root);
  assert.deepEqual(hand.userData, {
    sourceSocket: true, sourceParent: 'fixture-child', sourceFlag: 2, sourceRoot: false,
  });
  assert.deepEqual(rootSocket.userData, {
    sourceSocket: true, sourceParent: null, sourceFlag: 2, sourceRoot: true,
  });
  assert.deepEqual(hand.position.toArray(), [1, 2, 3]);
  assert.deepEqual(hand.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(hand.scale.toArray(), [2, 3, 4]);
  root.updateMatrixWorld(true);
  assert.deepEqual(hand.getWorldPosition(new Vector3()).toArray(), [11, 7, 3]);
  assert.deepEqual(addSourceSockets(root, source), {
    added: [], skipped: ['fixture-hand-socket', 'fixture-root-socket'],
  });
  const bones = [];
  root.traverse(node => { if (node.isBone) bones.push(node); });
  assert.deepEqual(bones, [parent, palette]);
});

test('only explicit root sockets are accepted and invalid or duplicate auxiliary nodes are reported', () => {
  const root = new Group();
  const existing = new Object3D();
  existing.name = 'fixture-existing';
  root.add(existing);
  const skipped = [
    socket('fixture-negative-one', -1), socket('fixture-negative-three', -3),
    socket('fixture-wrong-root-flag', -2, 1), socket('fixture-wrong-bone-flag', 0, 1),
    socket('fixture-missing-parent', 42), socket('fixture-existing', 0),
  ];
  const result = addSourceSockets(root, {
    bones: [bone('fixture-bone', -1)],
    auxiliary_nodes: [...skipped, socket('fixture-valid-root', -2)],
  });
  assert.deepEqual(result, { added: ['fixture-valid-root'], skipped: skipped.map(row => row.name) });
  assert.equal(root.getObjectByName('fixture-existing'), existing);
  assert.equal(existing.parent, root);
  for (const row of skipped.slice(0, -1)) assert.equal(root.getObjectByName(row.name), undefined);
});
