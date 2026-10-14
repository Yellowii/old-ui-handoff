# Catalog Updates And Invalidation

## Current implementation

The existing workbench reads static catalogs and model descriptors. It has no live catalog synchronization.

The initial appearance catalog is fetched from `/data/wardrobe.json` during adapter startup. Fashion, fragments, social catalogs, voices, motion indexes, animation maps, action extras, model descriptors, and face data are fetched by their owning module either on startup or when the capability is first used. Several modules memoize successful data or in-flight promises for the lifetime of the adapter/viewer instance.

There is no polling loop, WebSocket, SSE stream, mutation endpoint, or automatic merge of a changed catalog into an already running workbench. No legacy delivery server or HTTP cache policy is included. A host's cache headers may affect a later request, but cannot make memoized adapters issue that request. `configureHandoffServices` does not invalidate existing caches; main.js captures `catalogExtras` at import time.

## Endpoint registry

These are the current frontend-visible delivery endpoints and their ownership. URLs are catalog contracts, not dependencies on any particular legacy resource identifier.

| Endpoint | Consumer | Purpose | Current refresh behavior |
| --- | --- | --- | --- |
| `/data/wardrobe.json` | `appearance/main.js` | Primary resource/item catalog | Initial provider request; retained in adapter memory |
| `/data/fashion-parts.json` | `AppearanceWardrobe`, `ModelThumbnails` | Outfit/fashion assembly rules | Memoized by wardrobe; thumbnail manager has its own lazy copy |
| `/data/fragment-wardrobe.json` | `AppearanceWardrobe` | Fragment wardrobe rules | Memoized by wardrobe |
| `/data/models/{id}.json` | `appearance/main.js`, `WardrobeViewer` | Model descriptor and dependency metadata | On demand per model; viewer cache/state controls reuse |
| `/data/face-animations.json` | `WardrobeViewer` | Optional face animation data | Promise created by viewer; failure resolves to unavailable face data |
| `/data/motion-index.json` | `SocialPanel` | Maps model animation catalogs to URLs | Lazy per panel |
| model animation catalog URL from the index | `SocialPanel` | Parsed motion rows and source items | Loaded on model change; stale requests are ignored |
| `/data/model-animation-maps.json` | `SocialPanel` | Source animation replacement map | Lazy per panel |
| `/data/action-extras.json` | `SocialPanel`, `WardrobeViewer`, `AppearanceSocial` | Extra models/effects and runtime action support | Lazy or memoized by owning instance |
| `/data/expressions.json` | `SocialPanel` | Expression rows and preview URLs | Loaded by panel construction |
| social catalog URLs | `AppearanceSocial` | Motion, expressions, vehicles, abilities, multi-actions, parts, sockets, and related rows | Loaded as a memoized catalog group with `Promise.allSettled` |
| voice catalog URL selected by language | `ResourceVoices` | Voice rows and clips | Cached by URL; failed URL is evicted |
| local scene store | `PreviewScenes` | Saved scene configurations and thumbnails | Local read/write; no server request |
| `/assets/game/...` or host references | Viewer/media loaders | Binary/image/audio/model assets referenced by descriptors | Host/provider delivery; no handoff HTTP cache guarantee |
| `/appearance.html` | Browser | UI entrypoint and static UI files | Vite or host delivery |

`requestJSON` is a provider call, not necessarily an HTTP GET. It accepts the legacy URL as a lookup key and has no included server fallback. Host implementations own path validation, authorization, cache headers, conditional responses and ranges. See [ISOLATION-CHANGES.md](ISOLATION-CHANGES.md) for loader coverage, including DDS cubes/raw bytes using the catalog provider and DOM image/GLTF dependency bypasses.

## How new capability reaches the existing workbench

A new catalog-backed capability should be delivered as normalized records compatible with the appearance projection. The integration path is:

1. Backend publishes a catalog file and any descriptor/media references.
2. An adapter loads and validates the file when the capability is needed.
3. The adapter maps each valid row to the shared resource shape used by `appearance.resources(...)`.
4. The row carries a capability kind and explicit availability/readiness state.
5. `appearance.resources(...)` returns it through the existing category/search/quality/sort/favorite projection.
6. `appearance/demo.js` renders the row using the existing batched list and selection event path.
7. `appearance.select(resource)` dispatches to the owning adapter, which either performs the supported operation or reports the blocked/partial state.
8. Existing local scene/look additions emit `appearance:resources` so the same workbench list refreshes. A host catalog change is not loaded by emitting this event; it must be available before initial load or handled by a future explicit reload implementation.

This preserves one workbench projection and one selection path. It does not require the demo to know the legacy source of the capability. A capability can be appearance-only while its runtime action remains disabled until the runtime contract is complete.

## Proposed explicit versioning contract

The appearance workbench has no wired invalidation protocol. `appearance/runtime/social-runtime.js` exports a `VersionedResourceCatalog` helper, but `appearance/main.js` does not connect it to the primary item projection or expose `appearance.reload`. A compatible future addition could introduce an optional versioned manifest, for example `/data/catalog-manifest.json`, containing only logical catalog names, versions and URLs. The manifest would be an explicit reload source, not a push channel. Everything below is a proposal, not implemented behavior.

A suitable conceptual shape is:

```js
{
  "schema": 1,
  "version": "deployment-version",
  "catalogs": {
    "wardrobe": {"version": "...", "url": "/data/wardrobe.json"},
    "fashion": {"version": "...", "url": "/data/fashion-parts.json"},
    "social": {"version": "...", "url": "/data/social-index.json"}
  }
}
```

The exact version value is deployment-owned. It must not be a hard-coded legacy asset ID. The manifest is useful only if each catalog's version changes whenever its contents or referenced capability contract changes.

The adapter should expose an explicit reload/invalidation boundary, conceptually:

```js
await appearance.reload({scope: 'all'});
await appearance.reload({scope: 'wardrobe'});
```

A reload should:

- fetch the manifest or requested catalog explicitly;
- compare versions before replacing a memoized value;
- invalidate only the affected adapter caches;
- increment category/request generations;
- stop or mark stale active actions before replacing their model/catalog inputs;
- dispose superseded viewer roots, companions, textures, and motion extras;
- re-resolve the current selection against the new normalized projection;
- restore the actor/outfit or report a blocked selection without corrupting local state;
- emit `appearance:resources` and `appearance:selection` after the replacement is coherent;
- preserve favorites, usage, looks, and social combinations unless their referenced records are no longer valid.

The original implementation's cache fields should not be mutated in place while a request is using them. Replace a completed cache entry atomically, and use generation/request tokens to prevent an older in-flight request from repopulating a newer cache.

## Adapter-specific invalidation

Suggested invalidation scopes:

- `wardrobe`: primary item projection, category versions, fashion and fragment catalogs, dependent thumbnails.
- `model`: selected model descriptor, viewer model generation, dependent outfit assembly, face data where model-specific.
- `social`: social catalog group, model-specific motion rows, action extras, vehicle/ability/multi-action availability.
- `voice`: language catalog cache and current voice rows.
- `scene`: local scene records only; server catalog invalidation should not erase local scenes.
- `all`: stop active runtime work, invalidate all provider-backed adapter caches, then rehydrate in dependency order.

The dependency order should remain explicit: load the primary item projection, resolve the selected actor, load fashion/assembly rules, apply the actor and outfit, notify voices, load model-specific social data, and finally restore idle. A partial reload must not call `returnIdle()` before viewer motion/extras and runtime state have been cleaned.

## Why no automatic live merge is proposed

The current UI has local selection, local persistence, and asynchronous viewer state. Automatically merging a changed catalog would create races with selected resources, saved outfit slots, active actions, thumbnail work, and model descriptors. An explicit version check and reload gives the caller a clear boundary at which active work is stopped, stale roots are disposed, and the normalized projection is rebuilt.

Under this proposal, the host could serve static files with ETags and conditional requests. A future application shell would choose when to request the manifest; that decision remains outside the current workbench and must be documented as a caller action rather than implied background synchronization.

## Proposed Frontend/Host Boundary

The following responsibilities apply to the proposed reload implementation, not existing API methods.

Frontend would own:

- manifest/catalog requests and version comparison;
- cache invalidation and generation tokens;
- normalization into `appearance.resources()`;
- local state preservation and stale-selection handling;
- viewer and runtime cleanup;
- readiness and blocked-state presentation.

Host would own:

- publishing coherent files and manifest versions;
- static catalog delivery, path safety, ETags, ranges, and cache headers;
- keeping catalog and descriptor references internally consistent for a published version.

Host does not need a WebSocket or mutation API for this proposal. A deployment can publish a new version and the caller can explicitly request reload.

## Out of scope

Map and play integration are out of scope. This document also does not prescribe game resource paths, concrete legacy IDs, or a host delivery server.
