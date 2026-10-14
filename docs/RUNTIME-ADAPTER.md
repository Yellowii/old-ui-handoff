# Runtime Adapter

## Boundary

The runtime adapter layer covers model loading, assembly, accessory sockets, extra models, animation playback, and the in-process social runtime bridge. It is frontend behavior only. The word socket means a model or skeleton attachment point and never implies a network socket. Map and play integration are out of scope.

## Loader contract

`WardrobeViewer` in `viewer.js` is the loader and playback boundary.

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

### `loadModel(id, overrides, compositeCache)`

Input:

- `id`: model identifier used to request a descriptor and geometry.
- `overrides`: material/texture overrides for this load.
- `compositeCache`: per-load `Map` for composed source textures.

Behavior:

1. Fetch the model descriptor from the model descriptor endpoint.
2. Require a geometry URL; a missing geometry URL fails the load.
3. Load the GLTF geometry.
4. Bind materials with source-aware effects and apply overrides.
5. If the descriptor references a source skeleton, fetch it and add source sockets and omitted parent bones.
6. Attach model, sprite, and particle effects declared by the descriptor.
7. Track warnings such as missing optional parts.

Output on success:

```js
{ root, desc, warnings }
```

Specific effect-attachment failures dispose the created root; material construction and face-frame failures earlier in `loadModel` have no encompassing disposal guard. Assembly/companion paths and superseded completed loads add their own cleanup. This is not universal failure disposal; the inherited gap is documented in [WARDROBE-CONTRACT.md](WARDROBE-CONTRACT.md). Failed texture promises remove themselves from the viewer texture cache so a later explicit load can retry. The per-load composite cache prevents duplicate composition within one operation and is not a global cache.

### `loadAssembly(id, overrides, assembly, poseOffsets)`

Builds the base model plus:

- fashion additions and submodels,
- vehicle socket models,
- pose clips and pose offsets,
- assembly-declared effects.

If any assembly step fails, already-created roots are disposed and the error is reported. The returned assembly root is what `show()` presents.

### `show(id, overrides, options)`

`show()` captures a generation token before awaiting assembly:

```js
const token = ++this.generation;
const model = await this.loadAssembly(...);
if (token !== this.generation) {
  this.dispose(model.root);
  return null;
}
```

A superseded or failed load must never replace a newer model. Returning `null` for a superseded load lets callers skip stale UI updates instead of treating it as an error.

## Socket behavior

`equip(slot, item, variant)` attaches accessories:

1. Load the accessory model.
2. Read candidate names from the `item.socket` array and look for a source bone or named actor node.
3. If a configured candidate resolves, attach there.
4. Shared-name skeletal binding is allowed only when no candidate names are configured and every skinned bone has a matching target bone.
5. Otherwise dispose the accessory and throw, including when configured candidates exist but none resolves.

A partial bone match is never promoted to a successful attachment. This rule preserves mature binding behavior while making incomplete mappings explicitly blocked.

The source-rig helper reconstructs source sockets and omitted parent bones from source skeleton data. Only the source's explicit root-socket form is attached to the model root; other auxiliary forms are skipped and reported as skipped names.

## Extra-model behavior

Extra models include action companions, multi-person second actors, vehicle parts, and action extras.

`showCompanion(key, id, options)` and `showMotionCompanion(key, id, item, rows, options)` load companion roots under a companion generation token and a keyed map so cleanup is deterministic. Motion companions support position, angle, scale, overrides, idle clips, and assembly-driven extras.

`loadMotionExtras(item, actor)` uses the action-extras catalog and resolves independent extra models, sockets and clip bindings. Missing/unready rows or unsupported extra rules return no groups plus warnings; one failed group disposes the other successful groups from that operation. The ordinary `playMotionItem` path can continue skeleton playback with warnings when extras fail (`viewer.js:400`). The motion-companion path additionally checks the required-extra group count and rejects incomplete required extras (`viewer.js:267`). Do not describe all extras as universally fail-closed or fully restored.

Extra-model state is per action. Starting a new action or selecting a new model clears the previous extras before new ones load.

## Idle cleanup dependency

Idle restoration depends on explicit cleanup order. The relevant sequence is:

1. Stop the active action and clear timers.
2. Stop viewer motion, which stops all mixer actions, clears motion sequence state, and clears motion extras.
3. Clear multi-motion and companion roots.
4. Clear runtime state through the runtime bridge `stop()`/`cleanup()` path, removing recorded effect applications.
5. Only then resolve and play the selected model's idle animation through `returnIdle()`.

`finish()` demonstrates the boundary:

```js
this.playing = false;
this.viewer.stopMotion();
this.viewer.clearMultiMotion?.();
this.#clearRuntime();
const token = this.request;
queueMicrotask(() => {
  if (token === this.request) this.returnIdle();
});
```

`returnIdle()` is asynchronous because idle resolution may require model-specific catalog data. A stale return-idle request must not replace a newer selection or action, so it is token-guarded. Cleanup must always precede idle restoration; idle restoration must never run while motion extras, companions, or runtime effects are still applied.

`destroy()` and the explicit `clearCompanions()`, `stopMotion()`, and `clearMotionExtras()` methods provide teardown for the whole viewer.

## Runtime bridge

`SocialRuntimeBridge` in `appearance/runtime/social-runtime.js` is an in-process adapter for authored action contracts. It has no server connection.

Lifecycle:

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

States: `prepared`, `running`, `paused`, `stopping`, `idle`.

The bridge normalizes contract families:

- timing and duration,
- distance and pair separation,
- modifiers,
- camera,
- SFX,
- role-specific extra layout.

Effects use a sink:

```js
{ emit(event), apply(effect), remove(effect) }
```

`cleanup()` removes every effect application recorded for the current runtime session. `pause()` freezes elapsed time. `stop()` resets playback rate. Seeking backwards removes after-motion effects. Action duration is derived from authored duration fields rather than measured wall time.

## One runtime rule

Pair minimum separation is validated independently from authored motion distance. Authored travel data does not authorize a pair configuration that violates minimum separation, and unresolved contract values fail closed instead of falling back to an unsafe default.

This rule is runtime validation, not a network guarantee, and it applies before an action is allowed to run.

## Multi-person actions

Multi-person playback requires complete runtime data and the required actor roles. If a role, transform, or required contract family cannot be resolved, the action remains blocked. Appearance-only previews of a multi-person configuration do not imply runtime readiness.

## Preserved algorithms versus blocked visuals

Preserved algorithms:

- descriptor-driven model loading with branch-specific failure disposal and the documented material-construction cleanup gap,
- generation-token race protection for model, companion, animation, and extras state,
- source socket reconstruction and shared-bone validation,
- fashion assembly resolution and role resolution,
- per-load composite texture caching and viewer texture cache hygiene,
- explicit cleanup ordering before idle restoration,
- authored timing/duration derivation and pair separation validation,
- fail-closed runtime contract normalization.

Blocked or approximate visuals:

- unsupported legacy material branches,
- fashion categories without available assembly rules,
- missing source sockets or incomplete bone mappings,
- unresolved extra models or missing effect integration,
- unlocated expression, voice, or media references,
- multi-person actions without complete runtime contracts.

Blocked visuals must remain visible to the user as partial or blocked states. They must not be relabeled as fully ready, and they must not silently replace mature algorithms with approximations.

## Frontend/backend division

Frontend owns loader behavior, assembly, socket and extra-model contracts, branch-specific cleanup, runtime lifecycle and blocked-state reporting. The host owns delivery of descriptors, skeletons, catalogs, geometry, textures, audio and related assets, including any path safety, ETags, ranges and cache policy. No legacy backend is included or implied. Catalog/skeleton/raw-composite/DDS bytes use `catalogProvider`; explicit GLTF/texture/image wrappers and audio callers use `assetResolver`. DOM images and internal GLTF dependencies are not guaranteed to use the resolver. See [ISOLATION-CHANGES.md](ISOLATION-CHANGES.md).

## Out of scope

Map and play integration are out of scope. So are game resource path conventions, concrete legacy identifiers, and any server-side runtime execution model.
