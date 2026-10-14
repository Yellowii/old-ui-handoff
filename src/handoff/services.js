/**
 * Portable data boundary for the extracted wardrobe runtime.
 *
 * The legacy UI used fetch('/data/...') directly. The handoff keeps that
 * request shape as a compatibility contract, but routes it through an
 * injected provider so a new project owns catalog/resource resolution.
 */

const state = {
  catalogProvider: null,
  assetResolver: null,
  eventTarget: typeof EventTarget === 'function' ? new EventTarget() : null,
  runtimePolicy: {},
  fixtureMode: false,
  catalogExtras: { metadata: {}, social: [], voiceCatalogs: [] },
};

const asResponse = async (value, url) => {
  if (value && typeof value.ok === 'boolean' && typeof value.json === 'function') return value;
  if (value === undefined) throw new Error(`Catalog provider returned no data for ${url}`);
  return {
    ok: true,
    status: 200,
    async json() { return value; },
    async arrayBuffer() {
      if (value instanceof ArrayBuffer) return value;
      if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      throw new Error(`Binary data unavailable for ${url}`);
    },
  };
};

export function configureHandoffServices({ catalogProvider, assetResolver, eventTarget, runtimePolicy, fixtureMode, catalogExtras } = {}) {
  if (catalogProvider !== undefined && typeof catalogProvider !== 'function') {
    throw new TypeError('catalogProvider must be a function');
  }
  if (assetResolver !== undefined && typeof assetResolver !== 'function') {
    throw new TypeError('assetResolver must be a function');
  }
  state.catalogProvider = catalogProvider ?? null;
  state.assetResolver = assetResolver ?? null;
  if (eventTarget !== undefined) state.eventTarget = eventTarget;
  if (runtimePolicy !== undefined) state.runtimePolicy = runtimePolicy;
  if (fixtureMode !== undefined) state.fixtureMode = Boolean(fixtureMode);
  if (catalogExtras !== undefined) state.catalogExtras = catalogExtras;
  return getHandoffServices();
}

export function getHandoffServices() {
  return {
    catalogProvider: state.catalogProvider,
    assetResolver: state.assetResolver,
    eventTarget: state.eventTarget,
    runtimePolicy: state.runtimePolicy,
    fixtureMode: state.fixtureMode,
    catalogExtras: state.catalogExtras,
  };
}

/** Resolve a legacy /data URL to a provider response. */
export async function requestJSON(url, options = {}) {
  if (state.catalogProvider) {
    const result = await state.catalogProvider({ url, ...options });
    return asResponse(result, url);
  }
  throw new Error(`No catalogProvider configured for ${url}`);
}

/** Resolve a model/texture/audio/socket URL without prescribing a storage backend. */
export async function resolveAsset(ref, context = {}) {
  if (!ref) return null;
  const resourceRef = typeof ref === 'string' ? { url: ref } : ref;
  if (state.assetResolver) return state.assetResolver(resourceRef, context);
  if (/^(?:data:|blob:)/.test(resourceRef.url || '')) return resourceRef.url;
  throw new Error(`No assetResolver configured for ${resourceRef.id || resourceRef.url}`);
}

export function publishHandoffEvent(type, detail) {
  const target = state.eventTarget;
  if (!target?.dispatchEvent) return false;
  target.dispatchEvent(typeof CustomEvent === 'function'
    ? new CustomEvent(type, { detail })
    : Object.assign(new Event(type), { detail }));
  return true;
}

export function subscribeHandoffEvent(type, listener, options) {
  state.eventTarget?.addEventListener?.(type, listener, options);
  return () => state.eventTarget?.removeEventListener?.(type, listener, options);
}

export const legacyDataContract = Object.freeze({
  '/data/wardrobe.json': 'WardrobeCatalog',
  '/data/fashion-parts.json': 'FashionPartsCatalog',
  '/data/fragment-wardrobe.json': 'FragmentWardrobeCatalog',
  '/data/models/{modelId}.json': 'ModelDescriptor',
  '/data/motion-index.json': 'MotionIndex',
  '/data/model-animation-maps.json': 'ModelAnimationMaps',
  '/data/action-extras.json': 'ActionExtras',
  '/data/multi-person-actions.json': 'MultiPersonActions',
  '/data/vehicle-socket-assemblies.json': 'VehicleSocketAssemblies',
  '/data/face-animations.json': 'FaceAnimations',
});
