import test from 'node:test';
import assert from 'node:assert/strict';
import { AppearanceWardrobe, defaultVariant, resolveModel } from '../src/appearance/wardrobe.js';
import { configureHandoffServices } from '../src/handoff/services.js';

function entry(id, category = 'skin', slot = 'skin') {
  return {
    item: { id, itemId: id, name: id, businessCategoryId: category, equipSlot: slot },
    variant: { id: `${id}-variant`, runtime: `${id}-runtime`, preview: `${id}-preview` },
    role: 'runtime',
  };
}

function fixture(t) {
  const calls = [];
  const viewer = {
    equipped: new Map(),
    async show(...args) {
      calls.push(['show', ...args]);
      this.equipped.clear();
      return { warnings: ['base-warning'], desc: { id: args[0] } };
    },
    async equip(slot, item, variant) {
      calls.push(['equip', slot, item, variant]);
      this.equipped.set(slot, { warnings: ['socket-warning'] });
    },
    frameVisible(angle) { calls.push(['frame', angle]); },
    removeSlot(slot) { calls.push(['remove', slot]); this.equipped.delete(slot); },
    clearEquipped() { calls.push(['clear']); this.equipped.clear(); },
  };
  configureHandoffServices({ catalogProvider: ({ url }) => {
    assert.equal(url, '/data/fragment-wardrobe.json');
    return { characters: {} };
  } });
  t.after(() => configureHandoffServices());
  return { wardrobe: new AppearanceWardrobe(viewer), viewer, calls };
}

test('variant defaults prefer usable source defaults and model fallback stays role-specific', () => {
  const unavailable = { id: 'fixture-empty', isDefault: true };
  const available = { id: 'fixture-usable', runtime: 'fixture-runtime' };
  assert.equal(defaultVariant({ variants: [unavailable, available] }), available);
  assert.equal(defaultVariant({ preserveSourceDefault: true, variants: [unavailable, available] }), unavailable);
  assert.equal(defaultVariant({ variants: [unavailable] }), unavailable);
  const both = { runtime: 'fixture-runtime', preview: 'fixture-preview' };
  assert.equal(resolveModel(both, 'preview'), 'fixture-preview');
  assert.equal(resolveModel(both, 'runtime'), 'fixture-runtime');
  assert.equal(resolveModel({ runtime: 'fixture-runtime' }, 'preview'), 'fixture-runtime');
  assert.equal(resolveModel({ preview: 'fixture-preview' }, 'runtime'), 'fixture-preview');
});

test('preview changes shown entry but preserves saved actor and outfit; restore re-equips once', async t => {
  const { wardrobe, calls } = fixture(t);
  const actor = entry('fixture-actor');
  const accessory = entry('fixture-headwear', 'headwear', 'head');
  const preview = entry('fixture-backwear', 'backwear', 'back');
  await wardrobe.wear(actor);
  await wardrobe.wear(accessory);
  const saved = [...wardrobe.outfit];
  await wardrobe.preview(preview);
  assert.equal(wardrobe.mode, 'single');
  assert.equal(wardrobe.shown, preview);
  assert.equal(wardrobe.actor, actor);
  assert.deepEqual([...wardrobe.outfit], saved);
  assert.deepEqual(calls.at(-1), ['frame', 180]);
  assert.deepEqual(wardrobe.warnings, ['fixture-backwear\uff1abase-warning']);
  const before = calls.length;
  await wardrobe.restore();
  assert.equal(wardrobe.mode, 'outfit');
  assert.equal(wardrobe.shown, actor);
  assert.deepEqual(calls.slice(before).map(call => call[0]), ['show', 'equip']);
  assert.deepEqual(wardrobe.warnings, ['fixture-actor\uff1abase-warning', 'fixture-headwear\uff1asocket-warning']);
  await wardrobe.restore();
  assert.equal(calls.length, before + 2);
});

test('wear after preview restores saved outfit before adding the newly worn item', async t => {
  const { wardrobe, calls } = fixture(t);
  const actor = entry('fixture-actor');
  const head = entry('fixture-head', 'headwear', 'head');
  const back = entry('fixture-back', 'backwear', 'back');
  await wardrobe.wear(actor);
  await wardrobe.wear(head);
  await wardrobe.preview(back);
  calls.length = 0;
  await wardrobe.wear(back);
  assert.deepEqual(calls.map(call => call[0]), ['show', 'equip', 'equip', 'frame']);
  assert.deepEqual(calls.filter(call => call[0] === 'equip').map(call => call[1]), ['head', 'back']);
  assert.equal(wardrobe.actor, actor);
  assert.equal(wardrobe.mode, 'outfit');
  assert.equal(wardrobe.outfit.get('back'), back);
});

test('remove and clear during preview mutate saved choices without disturbing preview', async t => {
  const { wardrobe, calls } = fixture(t);
  await wardrobe.wear(entry('fixture-actor'));
  await wardrobe.wear(entry('fixture-head', 'headwear', 'head'));
  await wardrobe.wear(entry('fixture-waist', 'waistwear', 'waist'));
  const preview = entry('fixture-preview', 'headwear', 'head');
  await wardrobe.preview(preview);
  calls.length = 0;
  await wardrobe.remove('head');
  assert.deepEqual([...wardrobe.outfit.keys()], ['waist']);
  wardrobe.clear();
  assert.equal(wardrobe.outfit.size, 0);
  assert.equal(wardrobe.shown, preview);
  assert.equal(wardrobe.mode, 'single');
  assert.deepEqual(calls, []);
  await wardrobe.restore();
  await wardrobe.wear(entry('fixture-head-again', 'headwear', 'head'));
  calls.length = 0;
  await wardrobe.remove('head');
  wardrobe.clear();
  assert.deepEqual(calls, [['remove', 'head'], ['clear']]);
});

test('failed preview or equip does not overwrite committed wardrobe state', async t => {
  const { wardrobe, viewer } = fixture(t);
  const actor = entry('fixture-actor');
  const saved = entry('fixture-saved', 'headwear', 'head');
  await wardrobe.wear(actor);
  await wardrobe.wear(saved);
  const show = viewer.show;
  viewer.show = async () => null;
  await assert.rejects(wardrobe.preview(entry('fixture-stale')), /./);
  assert.equal(wardrobe.shown, actor);
  assert.equal(wardrobe.actor, actor);
  assert.equal(wardrobe.mode, 'outfit');
  viewer.show = show;
  viewer.equip = async () => { throw new Error('fixture equip rejected'); };
  await assert.rejects(wardrobe.wear(entry('fixture-replacement', 'headwear', 'head')), /fixture equip rejected/);
  assert.equal(wardrobe.outfit.get('head'), saved);
});

test('restore attempts every saved slot and retains choices when one equip fails', async t => {
  const { wardrobe, viewer, calls } = fixture(t);
  await wardrobe.wear(entry('fixture-actor'));
  const head = entry('fixture-head', 'headwear', 'head');
  const back = entry('fixture-back', 'backwear', 'back');
  await wardrobe.wear(head);
  await wardrobe.wear(back);
  await wardrobe.preview(entry('fixture-inspect', 'facewear', 'face'));
  const equip = viewer.equip.bind(viewer);
  viewer.equip = async (...args) => {
    if (args[0] === 'head') throw new Error('fixture missing socket');
    return equip(...args);
  };
  calls.length = 0;
  await assert.rejects(wardrobe.restore(), /fixture missing socket/);
  assert.equal(wardrobe.mode, 'outfit');
  assert.deepEqual([...wardrobe.outfit.values()], [head, back]);
  assert.equal(calls.at(-1)[1], 'back');
});

test('skin roles fail closed while accessory fallback uses the loaded model textures', async t => {
  const { wardrobe, calls } = fixture(t);
  const actor = entry('fixture-actor');
  delete actor.variant.preview;
  actor.role = 'preview';
  await assert.rejects(wardrobe.preview(actor), /./);
  assert.deepEqual(calls, []);
  const accessory = entry('fixture-accessory', 'headwear', 'head');
  accessory.role = 'preview';
  delete accessory.variant.preview;
  accessory.item.textureOverrides = { baseColor: 'fixture-runtime-texture' };
  accessory.item.previewTextureOverrides = { baseColor: 'fixture-preview-texture' };
  await wardrobe.preview(accessory);
  assert.equal(calls[0][1], accessory.variant.runtime);
  assert.equal(calls[0][2], accessory.item.textureOverrides);
});

test('same actor and variant retain fragment selection across role changes, new variant does not', async t => {
  const { wardrobe } = fixture(t);
  const actor = { ...entry('fixture-actor'), fragmentParts: { fixtureSlot: 'fixture-part' } };
  await wardrobe.wear(actor);
  await wardrobe.wear({ ...entry('fixture-actor'), role: 'preview' });
  assert.equal(wardrobe.actor.fragmentParts, actor.fragmentParts);
  const next = entry('fixture-actor');
  next.variant = { ...next.variant, id: 'fixture-other-variant' };
  await wardrobe.wear(next);
  assert.equal(wardrobe.actor.fragmentParts, undefined);
});

test('fashion catalog requests are memoized and a rejected load can be retried', async t => {
  const { wardrobe } = fixture(t);
  let requests = 0;
  let succeed = false;
  const catalog = { parts: {} };
  configureHandoffServices({ catalogProvider: ({ url }) => {
    assert.equal(url, '/data/fashion-parts.json');
    requests++;
    return succeed ? catalog : { ok: false, json: async () => null };
  } });
  const failures = await Promise.allSettled([wardrobe.loadFashionParts(), wardrobe.loadFashionParts()]);
  assert.deepEqual(failures.map(result => result.status), ['rejected', 'rejected']);
  assert.equal(requests, 1);
  succeed = true;
  const results = await Promise.all([wardrobe.loadFashionParts(), wardrobe.loadFashionParts()]);
  assert.deepEqual(results, [catalog, catalog]);
  assert.equal(requests, 2);
});
