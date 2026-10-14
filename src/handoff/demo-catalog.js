/**
 * ResourceRef and capability shapes used by the portable handoff.
 * These are intentionally resource-neutral: no legacy IDs, model paths or
 * ownership mappings are required to use the UI state and interaction layer.
 */

export function resourceRef({ id, kind = 'model', url = null, descriptorUrl = null, status = 'unavailable', capabilities = {} } = {}) {
  if (!id) throw new TypeError('ResourceRef.id is required');
  return Object.freeze({ id: String(id), kind, url, descriptorUrl, status, capabilities: { ...capabilities } });
}

export const demoCatalog = Object.freeze({
  version: 1,
  items: [
    {
      id: 'demo-character', itemId: 'demo-character', name: '演示角色',
      businessCategoryId: 'skin', equipSlot: 'skin', quality: 0, available: false,
      variants: [{ id: 'default', name: '默认', isDefault: true, preview: null, runtime: null, resourceStatus: 'demo-only' }],
      capabilities: { character: true, variants: true, dye: false },
      thumbnail: null,
    },
    {
      id: 'demo-headwear', itemId: 'demo-headwear', name: '演示头饰',
      businessCategoryId: 'headwear', equipSlot: 'head', quality: 0, available: false,
      variants: [{ id: 'default', name: '默认', isDefault: true, preview: null, runtime: null, resourceStatus: 'demo-only' }],
      capabilities: { socket: true, dye: false },
      thumbnail: null,
    },
    {
      id: 'demo-action', itemId: 'demo-action', name: '演示动作',
      businessCategoryId: 'action', quality: 0, available: false,
      variants: [], capabilities: { motion: true, idleRestore: true }, thumbnail: null,
    },
  ],
  metadata: { 'demo-character': { description: '无游戏资源的交互演示数据', tags: ['fixture'] } },
});

export function createDemoCatalogProvider(catalog = demoCatalog) {
  const table = new Map([
    ['/data/wardrobe.json', { items: catalog.items }],
    ['/data/models/demo-character.json', { id: 'demo-character', url: null, capabilities: { demoOnly: true } }],
  ]);
  return async ({ url }) => {
    if (!table.has(url)) return { ok: false, status: 404, async json() { return { error: 'fixture-not-found', url }; } };
    return table.get(url);
  };
}

export function catalogResource(item, variant = null) {
  const selected = variant ?? item?.variants?.find(row => row.isDefault) ?? item?.variants?.[0] ?? null;
  return {
    id: String(item.id), name: item.name, type: item.businessCategoryId,
    item, variant: selected,
    ref: resourceRef({ id: item.id, kind: item.businessCategoryId === 'skin' ? 'character' : 'attachment', status: item.available ? 'ready' : 'unavailable', capabilities: item.capabilities }),
  };
}
