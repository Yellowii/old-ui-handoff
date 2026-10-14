import test from 'node:test';
import assert from 'node:assert/strict';
import { configureHandoffServices, requestJSON, legacyDataContract } from '../src/handoff/services.js';
import { catalogResource, createDemoCatalogProvider, demoCatalog, resourceRef } from '../src/handoff/demo-catalog.js';

test('ResourceRef stays data-driven and has no legacy path requirement', () => {
  const ref = resourceRef({ id: 'fixture', capabilities: { socket: true } });
  assert.deepEqual(ref, { id: 'fixture', kind: 'model', url: null, descriptorUrl: null, status: 'unavailable', capabilities: { socket: true } });
});

test('catalog provider resolves legacy contracts without global fetch patching', async () => {
  configureHandoffServices({ catalogProvider: createDemoCatalogProvider() });
  const response = await requestJSON('/data/wardrobe.json');
  assert.equal(response.ok, true);
  assert.deepEqual((await response.json()).items, demoCatalog.items);
  const missing = await requestJSON('/data/not-in-fixture.json');
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
});

test('catalog resource exposes capabilities and keeps unavailable fixture explicit', () => {
  const resource = catalogResource(demoCatalog.items[1]);
  assert.equal(resource.id, 'demo-headwear');
  assert.equal(resource.ref.status, 'unavailable');
  assert.equal(resource.ref.capabilities.socket, true);
  assert.equal('url' in resource.ref, true);
});

test('legacy data contract names are explicit', () => {
  assert.equal(legacyDataContract['/data/models/{modelId}.json'], 'ModelDescriptor');
  assert.equal(legacyDataContract['/data/action-extras.json'], 'ActionExtras');
});
