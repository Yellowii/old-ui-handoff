# Events And State

## Startup sequence

The appearance workbench is catalog-driven and starts from a single initial wardrobe fetch:

1. `appearance/main.js` fetches `/data/wardrobe.json`.
2. It validates `response.ok` and requires `catalog.items` to be an array.
3. The catalog is assigned to the adapter's in-memory item projection and marked loaded.
4. Fashion parts are loaded through `AppearanceWardrobe.loadFashionParts()`.
5. A default actor entry is resolved for the active role and worn through the serialized operation path.
6. Voices are notified of the selected model.
7. The UI information and selection state are rendered.
8. Social catalogs and local scene records are loaded. Their failures are reported as incomplete catalog reads rather than treated as a live update.

Model descriptors are requested on demand by model ID. Motion, expression, voice, vehicle, fashion, fragment, and action-extra catalogs are requested through `requestJSON` by their owning adapter. In fixture mode, default-actor wear, social/scene load and from-play outfit restoration are skipped; the initial fixture catalog still loads. Main.js captures `catalogExtras` at import time, so configure services first (`appearance/main.js:14`, `:537`).

## Current refresh semantics

There are three distinct kinds of refresh:

| Refresh kind | Trigger | What changes | Network behavior |
| --- | --- | --- | --- |
| Initial catalog load | Adapter startup | In-memory wardrobe item projection | One provider request for `/data/wardrobe.json` |
| Capability/model load | Selection, panel open, or model change | Adapter-specific in-memory catalog or descriptor state | Provider request on demand; many catalogs memoize the resulting promise/data |
| UI projection refresh | Search, filter, sort, favorites, scroll, local scene save, selection event | Visible DOM and current normalized projection | No catalog re-fetch |

The current implementation has no polling, WebSocket, SSE, server push, or automatic live merge. The handoff supplies no legacy HTTP server or fixed cache headers. Host cache policy may affect a future request but cannot invalidate adapter memoization or trigger a request by itself.

A later explicit reload proposal is documented in [CATALOG-UPDATES.md](CATALOG-UPDATES.md). It must be opt-in and versioned; it must not be described as existing behavior.

## In-memory caches and retry behavior

| Owner | Data | Current behavior |
| --- | --- | --- |
| Main appearance adapter | `wardrobe.json` items | Loaded once per adapter instance |
| `AppearanceWardrobe` | `fashion-parts.json` | Memoized loading promise; failed fashion load clears the promise for explicit retry |
| `AppearanceWardrobe` | `fragment-wardrobe.json` | Memoized loading promise; failure clears the promise for explicit retry |
| `AppearanceSocial` | Social catalog group | `loaded` plus an in-flight `loading` promise; concurrent callers share the promise; completion clears `loading` |
| `SocialPanel` | Motion index, animation maps, action extras | Cached on the panel instance after first successful fetch |
| `ResourceVoices` | Voice rows by language URL | Cached by URL; failed request removes that URL from the cache |
| `WardrobeViewer` | Model texture promises | Shared viewer cache; failed texture promises remove themselves |
| `WardrobeViewer` | Composite source textures | Per-load `Map` passed to `loadModel()` to avoid duplicate composition within an operation |
| `ModelThumbnails` | Screenshot URL by item ID | Bounded local cache; failed IDs are held in a failed set for the current thumbnail manager |
| Main UI | Favorites, usage, looks, social combinations | `localStorage`; local client state only |
| Scenes | Saved scene records and thumbnails | Local scene store; saving emits a local `appearance:resources` event |

The cache table is intentionally scoped to the existing adapter instances. There is no common catalog cache invalidation bus in the original implementation.

## Event vocabulary

The workbench dispatches local DOM events:

```js
document.dispatchEvent(new Event('appearance:selection'));
document.dispatchEvent(new Event('appearance:resources'));
document.dispatchEvent(new Event('appearance:thumbnail'));
document.dispatchEvent(new CustomEvent('appearance:panel-open', {detail: 'scene'}));
document.dispatchEvent(new Event('appearance:resize'));
```

Meaning:

- `appearance:selection` tells the demo and controls to synchronize the current selection.
- `appearance:resources` tells the demo to rebuild its visible resource list from the current local projection.
- `appearance:thumbnail` tells thumbnail consumers to re-evaluate displayed thumbnail state.
- `appearance:panel-open` records that an inline scene, voice, admin, or related panel became active. Its detail is a local panel name.
- `appearance:resize` schedules layout and visible-list work.

These events do not encode catalog versions and do not imply a backend change.

## Selection and render state

The main adapter maintains the current category, selected resource, selected variant, display mode, busy state, operation sequence, category version, preview restoration state, and local favorite/usage state. A newer selection increments the relevant sequence/token before asynchronous work begins. Completion handlers compare their captured token before mutating the viewer or UI.

The demo maintains a filtered resource projection and a batch cursor. It renders 18 items at a time and uses scroll plus `IntersectionObserver` to append already-known items. A filter or `appearance:resources` event resets the cursor and visible list. It does not ask the server for the next page.

`SessionViewer` adds primary-workbench camera state:

- user zoom is retained across framing changes;
- automatic framing yields to a user gesture or explicit zoom;
- pair framing follows posed bounds and retains the largest observed pose radius;
- reset clears session zoom and returns to automatic framing;
- near/far depth range is updated so animated limbs and props are not clipped.

Thumbnail viewers deliberately use `WardrobeViewer` without session camera state.

## Async race protection

The viewer uses separate generation counters for the displayed model, companions, animations, and motion extras. `show()` captures a model generation token and disposes a loaded root if a newer request has superseded it. Social model changes and playback capture request tokens. Voice and expression panels likewise invalidate their previous request before a new model, language, or playback operation.

This is important for the workbench's refresh semantics: a UI refresh may happen while an earlier descriptor or catalog request is still in flight, but stale completion must not overwrite newer state.

## Social and runtime lifecycle

A model change clears expression state, invalidates playback, loads model-specific action rows, resolves idle and entrance clips, and only then allows the matching result to update the panel. Action playback may create companions, extras, vehicle parts, ability timers, expression timers, and runtime state.

`finish()` performs the end-of-action boundary:

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

`stop(resume = true)` increments the request, clears ability timers, stops viewer motion, clears multi-motion and runtime state, hides playback UI, and optionally awaits `returnIdle()`.

`returnIdle()` is asynchronous because it may need to resolve the selected model's idle animation and restore the actor after the active motion or companion roots are gone. The idle dependency is therefore explicit: cleanup must happen before idle restoration, and a stale return-idle request must not replace a newer selection or action.

The runtime bridge is in-process. Its states are `prepared`, `running`, `paused`, `stopping`, and `idle`; it is not a network socket and has no server connection.

## Capability states

The workbench distinguishes appearance availability from runtime readiness. A record may be visible in the resource projection while its runtime action is `partial` or blocked. Examples include a vehicle that can be previewed but has no complete runtime contract, an action whose skeleton clip is present but SFX or extra models are not integrated, and an expression or voice row whose source identity exists but whose media URL is not located.

The social panel renders disabled action entries with an incomplete-restoration status. When skeleton playback succeeds but effects are unavailable, it reports a warning instead of promoting the action to full fidelity. This preserves the mature motion algorithms while making blocked visuals explicit.

## One runtime rule

Pair minimum separation is validated independently from authored motion distance. Authored motion data may describe travel, but runtime safety still rejects a pair configuration that violates the minimum separation rule. The rule is fail-closed when the required contract values cannot be resolved.

Other runtime invariants include frozen elapsed time while paused, reset playback rate on stop, and removal of after-motion effects on rewind.

## Frontend and backend responsibility

Frontend responsibilities:

- fetch catalogs and descriptors when the owning capability needs them;
- normalize records into the appearance resource projection;
- filter, sort, paginate visible DOM, and persist local state;
- load and dispose models, companions, textures, animation actions, and effects;
- expose `ready`, `partial`, and blocked capability states;
- invalidate stale asynchronous work.

Host responsibilities:

- deliver coherent catalogs, descriptors and browser-usable media URLs;
- provide any required method/path validation, authorization, ETags, ranges and cache headers;
- keep game data and historical extraction reports outside the source handoff.

No legacy backend is included. No current frontend provider contract includes catalog version broadcast or client push; `publishHandoffEvent` is not wired to catalog invalidation.
