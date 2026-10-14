# Appearance Workbench API

This document describes the bounded browser workbench implemented by the appearance entry point, demo renderer, wardrobe adapter, social adapter and viewer. Catalog and asset delivery is host-provided; no legacy `server.mjs` is included. It records current behavior first. The reload behavior in [CATALOG-UPDATES.md](CATALOG-UPDATES.md) is a proposal and is not part of the current API. See [WARDROBE-CONTRACT.md](WARDROBE-CONTRACT.md) for state semantics and verified inherited limitations.

## Scope

The workbench covers appearance selection, wardrobe equipment, model previews, thumbnails, scenes, voices, social actions, expressions, motion companions, and the in-process social runtime bridge. Map and play integration are outside this handoff.

The frontend consumes normalized catalog records and model descriptors. It does not require a particular game resource path or a concrete legacy identifier as an integration contract. A deployment supplies the catalog records and the referenced delivery URLs.

## Main appearance adapter

`appearance/main.js` owns the selection state and coordinates the viewport, wardrobe, social adapter, scenes, voices, controls, thumbnails, and local persistence.

Public operations:

```js
appearance.resources(category, query, quality, sort, favoriteNames)
appearance.select(resource)
appearance.variant(value)
appearance.mode(value)
appearance.category(value)
appearance.favorite(name, value)
appearance.zoom(value)
```

`appearance.resources(...)` is the workbench projection. It combines the loaded wardrobe items with local scene records and the enabled social/resource projections. Search, quality, sort, and favorites are applied in the UI-facing projection. New catalog capabilities reach the existing workbench by becoming normalized records in this projection; the demo does not need a second renderer for each catalog family.

Selection changes use the adapter's busy operation guard; operations arriving while busy are rejected, not queued. Sequence/request tokens, category versions and preview restoration state protect specific asynchronous paths. A failed operation reports an error and retains usable state where possible, but selection may already be recorded and actor/outfit changes are not transactional.

Startup is effectively:

```js
const response = await requestJSON('/data/wardrobe.json');
if (!response.ok) throw new Error(`目录请求失败 ${response.status}`);
const catalog = await response.json();
if (!Array.isArray(catalog.items)) throw new Error('资源目录格式错误');
items = catalog.items;
loaded = true;
initialEntry = defaultActorEntry(await wardrobe.loadFashionParts(), role);
await operation(() => wardrobe.wear(initialEntry));
voices?.modelChanged(initialEntry.item);
updateInfo();
try {
  await social?.load();
  await scenes?.load();
} catch (error) {
  message(`目录读取不完整：${error.message}`, true);
}
```

This sketch describes non-fixture startup. The fixture-mode branch skips default-actor wear and social/scene initialization (`appearance/main.js:537`). The initial wardrobe catalog is fetched once for the adapter instance. Model descriptors are fetched on demand when a selected resource needs them. There is no WebSocket, SSE, polling loop, automatic server-push catalog merge, or wired `appearance.reload()` method. `catalogExtras` is captured when main.js is imported, so configure services before importing the UI.

## Demo/workbench renderer

`appearance/demo.js` renders the normalized resource projection. It requests data through:

```js
appearance.resources(
  state.category,
  state.search,
  state.quality,
  state.sort,
  favoriteResources,
)
```

The list is rendered in batches of 18. Scroll and `IntersectionObserver` append additional records that are already in the client projection. Search, category, quality, sort, and favorite changes reset or refresh the visible list. This is viewport pagination, not a backend page request and not a catalog refresh.

The renderer listens for local UI events:

```js
document.addEventListener('appearance:selection', syncSelection);
document.addEventListener('appearance:resources', resetResourceList);
document.addEventListener('appearance:resize', () => requestAnimationFrame(loadWhenNearBottom));
```

These events coordinate browser rendering only. `appearance:resources` means that the local projection changed; it does not mean the server changed.

## Wardrobe API

`AppearanceWardrobe` in `appearance/wardrobe.js` owns actor and outfit state.

```js
loadFragments()
loadFashionParts()
changeFashionParts(selected, role)
fragmentConfig(entry)
changeFragments(selected)
show(entry)
preview(entry)
restore()
wear(entry)
remove(slot)
clear()
```

Fashion and fragment catalogs are memoized promises. A successful load is reused by later calls; either failed load clears its own promise, allowing a later explicit retry. `wear()` commits an actor or accessory entry, while `restore()` re-shows the saved actor and attempts saved outfit slots only when not already in outfit mode. Partial restoration is not transactional and subsequent restore calls in outfit mode do not retry missing slots.

Character skins use exact role model resolution. Accessory models may use role fallback resolution. Generic hair, upper-body, or lower-body replacement is blocked unless the fashion assembly rules are available; the adapter does not silently approximate an incomplete assembly.

A character change attempts to re-equip the saved outfit and preserves selection state when a partial outfit operation fails. Unsupported or incomplete categories are blocked by the wardrobe's `wearBlock(item)` decision.

## Viewer API

`WardrobeViewer` in `viewer.js` is the model, assembly, animation, companion, and camera boundary. `SessionViewer` extends it for the primary appearance viewport and retains user zoom while thumbnails and other viewers use the base class.

Loader signatures:

```js
async loadModel(id, overrides = {}, compositeCache = new Map())
async loadAssembly(id, overrides = {}, assembly = null, poseOffsets = assembly?.poseOffsets)
async show(id, overrides = {}, options = {})
async equip(slot, item, variant)
async showCompanion(key, id, options = {})
async showMotionCompanion(key, id, item, rows, options = {})
async playMotion(entry, {rememberIdle = false} = {})
async playMotionItem(item, rows, catalogPath)
async loadMotionExtras(item, actor)
```

`loadModel()` fetches a model descriptor, requires a geometry URL, loads the GLTF, binds materials and source-aware effects, adds optional source skeleton sockets, and attaches model/sprite/particle effects. Its successful result is:

```js
{ root, desc, warnings }
```

The loader disposes roots on specific effect-attachment, assembly, companion and superseded-load paths, but does not wrap all material construction/face-frame awaits in a cleanup guard. Do not treat failure disposal as universal; see the verified inherited limitation in [WARDROBE-CONTRACT.md](WARDROBE-CONTRACT.md). Per-load composite texture promises are stored in the supplied `compositeCache`. Failed texture promises remove themselves from the viewer texture cache so a later explicit attempt can retry.

`loadAssembly()` builds the base model plus additions, submodels, vehicle socket models, pose clips, and effects. If an assembly step fails, already-created roots are disposed before the error is propagated.

`show()` increments a generation token before loading. If another show supersedes the request, the completed root is disposed and `null` is returned rather than replacing the newer model:

```js
const token = ++this.generation;
const model = await this.loadAssembly(...);
if (token !== this.generation) {
  this.dispose(model.root);
  return null;
}
```

## Socket and accessory contract

`equip()` loads an accessory and first looks for a configured candidate in the `item.socket` array. If candidates are configured but not found, the operation throws. Shared-name skeletal binding is allowed only when no candidates are configured and every skinned bone has a matching target bone. Otherwise the accessory is disposed and the operation throws. A partial bone match is not promoted to a successful attachment.

Source skeleton data can add explicit source sockets and omitted parent bones. Only the source's explicit root socket form is attached to the model root; unsupported auxiliary-node forms are skipped and reported by the source-rig helper.

The word socket in this contract means a model/skeleton attachment point. It is not a network socket.

## Social adapter API

`AppearanceSocial` in `appearance/social-adapter.js` owns action catalogs, expressions, vehicle previews, abilities, multi-person actions, action extras, playback state, and idle restoration.

```js
load()
loadCatalogs()
modelChanged(entry, descriptor)
play(resource)
playVehicle(resource, variant)
playAbility(resource)
playMulti(resource)
stop(resume = true)
finish()
returnIdle()
clearExpression()
clearAbility()
```

`load()` is promise-memoized for the adapter instance:

```js
async load() {
  if (this.loaded) return;
  if (!this.loading) {
    this.loading = this.loadCatalogs()
      .then(() => { this.loaded = true; })
      .finally(() => { this.loading = null; });
  }
  return this.loading;
}
```

The catalog group starts with `Promise.allSettled` for motion indexes, expressions, animation maps, bags, vehicles, abilities, action extras, multi-person actions, vehicle parts and additional motion rows. Failed entries receive per-capability fallbacks. The shared motion catalog (when indexed) and vehicle socket assemblies are separately awaited and can still reject `loadCatalogs()`. A completed group marks the adapter loaded, including any fallback state; it is not periodically retried.

`modelChanged()` increments a request token, clears expression state, loads model-specific action catalogs, selects idle and entrance animation rows, and ignores stale results. Playback tracks the current request, playing state, runtime timer, ability timers, companions, and idle state.

The base `SocialPanel` provides motion search, selection, play/pause/stop, speed, seek, expression preview, and explicit unavailable states. A motion can be displayed as `ready`, `partial`, or blocked. Skeleton playback can remain available while unintegrated effects are surfaced as warnings; motion-extra handling is path-specific, with required-extra count checks in the motion-companion path. Multi-person actions require complete runtime data and the required actor roles.

Vehicle preview may be appearance-only. Preview availability must not be interpreted as runtime readiness.

## Runtime bridge

`SocialRuntimeBridge` in `appearance/runtime/social-runtime.js` is an in-process runtime adapter. Its lifecycle methods are:

```js
prepare(actionOrId, actors)
start()
tick(deltaSeconds)
update(deltaSeconds)
setRate(value)
seek(value, {unit = 'seconds'})
pause()
resume()
reselect(actionOrId, actors)
stop({returnIdle = true})
cleanup()
snapshot()
```

States are `prepared`, `running`, `paused`, `stopping`, and `idle`. The bridge normalizes timing, distance, modifiers, camera, SFX, and role-specific extra-model contract fields. It fails closed when a required contract cannot be resolved.

The effect sink is:

```js
{ emit(event), apply(effect), remove(effect) }
```

`cleanup()` removes every effect application recorded for the current session. Pause freezes elapsed time. Stop resets playback rate. Rewind removes after-motion effects. Pair minimum separation is validated independently from authored motion distance. These rules are runtime behavior, not network behavior.

## Local persistence and DOM events

The adapter stores favorites, usage counts, saved looks, and social combinations in `localStorage`. Scene records use the local scene store. These values are local client state and are not catalog synchronization.

Current appearance DOM events are:

- `appearance:selection`: selected resource or model state changed.
- `appearance:resources`: the local resource projection changed, including a saved local scene.
- `appearance:thumbnail`: thumbnail state changed.
- `appearance:panel-open`: an inline panel opened; `detail` identifies the panel.
- `appearance:resize`: the workbench should remeasure or continue visible-list work.

No event in this list is a server-side update notification.

## Server boundary

No legacy static delivery server is included. `src/handoff/services.js` routes requests through `catalogProvider` and `assetResolver`; missing providers throw except for the resolver's data/blob URL fallback. The host is responsible for any HTTP methods, path safety, ETags, conditional requests, ranges and cache headers. None of those HTTP guarantees is implemented by the provider boundary itself.

The frontend owns normalization, filtering, capability states, local persistence, model loading, cleanup and rendering. The host owns coherent delivery of catalogs/descriptors/media and safe URLs. The extracted UI has no wired live catalog reconciliation. Resolver coverage and browser URL bypasses are specified in [ISOLATION-CHANGES.md](ISOLATION-CHANGES.md).

## Visual scope boundary

Preserved algorithms include catalog normalization, role resolution, fashion assembly, source socket binding, shared-bone validation, generation-token race protection, per-load texture caching, action timing, pair separation checks, effect cleanup, idle restoration, and explicit partial/blocked capability states.

Blocked or approximate visuals include unsupported legacy material branches, incomplete fashion categories without assembly rules, missing source sockets or incomplete bone mappings, unresolved motion/extra models, unlocated expression or voice media, and unintegrated SFX. These states must remain visible to the user instead of being relabeled as fully ready.
