# Isolation Changes

This documents what the extraction deliberately changed or added relative to the legacy UI, and what remains delivery/host responsibility. It records current adapter behavior in `D:/Proj/old-ui-handoff`. It does not claim asset-backed visual acceptance and does not assert that a pre-extraction hash baseline existed. The legacy project at `D:/Proj/NeoX23Js` was accessed read-only during this documentation task.

## Runtime Policy Surface

`src/handoff/services.js` stores `runtimePolicy` verbatim and `getHandoffServices().runtimePolicy` is the only supported read path. It is a plain object: there is no live reconfiguration event, no versioning and no schema validation beyond each reader's own checks.

Fields read by current adapter code (verified against final source, all fail-closed with no extracted defaults):

| Field | Consumer | Contract at call site |
| --- | --- | --- |
| `sharedMotionCatalogPath` | `viewer.js` (`playMotionItem`), `social.js`, `social-adapter.js`, `animation-resource-map.js` | Exactly-matching catalog path enables shared shop-graph behavior; other catalog paths are rejected in `playMotionItem` |
| `materialContracts` | `src/handoff/runtime-contracts.js` `runtimeContract(name)` | Lazy proxy; keys include `surface-defaults.json`, `nfx-grass-defaults.json`, `outline-soul-defaults.json`, `rainbow-default-textures.json`, `splendor-programs.json`, `water-wings-source.json`, `wing-obj-defaults.json`, `rainbow-star-texture-defaults` (Tex4 `{path,url}`), `qingshe-cloth-texture-defaults` (Tex4 `{url}`); missing contract throws at first read |
| `reviewedEffects` | `src/fashion-particle-effects.js`, `src/headwear-particle-effects.js`, `src/headwear-sprite-effects.js`, `src/headwear-model-effects.js` | `reviewedEffects[profile]` is an array of `{path, sha256}` (lowercase 64-hex); profiles: `champion-belt-particle-poly-v1`, `source-headwear-cone-particles-v1`, `source-headwear-nested-sprites-v1`, `source-headwear-model-curves-v1`; unreviewed effects throw and descriptor source hashes must still match |
| `splendorSpecializationFingerprints` | `src/splendor-specialization.js` | `splendorSpecializationFingerprints[number]` is a string array of `len:fnv64hex` fingerprints computed over GLSL plus `JSON.stringify(expressions)` for families 3/4/5/6/7/u5_rampdistort; a missing approval returns the original unspecialized program |
| `sceneLight.sunDirection`, `sceneLight.sunColor` | `src/source-scene-light.js` (lazy `sourceSceneSunDirection()`/`sourceSceneSunColor()`) | Each must be 3 finite numbers; direction additionally requires a nonzero norm; color is pre-multiplied source Diffuse*Intensity; missing or invalid values throw at use |
| `qqtbnSurfaces` | `src/materials.js` | array `includes(surface)` |
| `nstbRsqrtTable` | `src/source-nstb-rsqrt.js` | required 512 integer values |
| `sfxRsqrtTable` | `src/source-sfx-vector.js` | required 2 x 256 finite values |
| `sceneFogMatcher` | `src/source-scene-fog.js` | matcher for fog selection |
| `sourceCubeMatcher` | `viewer.js` (`texture`) | optional function `(url, {kind: 'cube-texture'}) => boolean`; when it returns `true`, the URL is delivered to the preserved DDS `loadSourceCube` path; without it, cube URLs use the ordinary texture loader and no legacy `/assets/game/cubes/` ownership prefix is assumed |

This table matches the coordinator-confirmed final field list and the readers found in source. If isolation work later changes names, update both together.

Example wiring using representative fields:

```js
configureHandoffServices({
  catalogProvider: async ({url, ...options}) => hostCatalog.request(url, options),
  assetResolver: (ref, context) => hostAssets.resolve(ref, context),
  runtimePolicy: {
    sharedMotionCatalogPath: '/data/motion/shop-shared.json',
    sceneLight: {sunDirection: [0.4, -1, 0.2], sunColor: [1.0, 0.9, 0.8]},
    sourceCubeMatcher: (url, context) => hostAssets.isPublishedCube(url, context),
    reviewedEffects: {
      'source-headwear-cone-particles-v1': [
        {path: 'assets/game/effect/...', sha256: '0123abcd...64 hex'},
      ],
    },
    // materialContracts, splendorSpecializationFingerprints, nstbRsqrtTable,
    // sfxRsqrtTable, qqtbnSurfaces and sceneFogMatcher are required by the
    // corresponding feature branches and fail closed when absent.
  },
});
```

`configureHandoffServices` accepts all six option keys (`catalogProvider`, `assetResolver`, `eventTarget`, `runtimePolicy`, `fixtureMode`, `catalogExtras`) and may be called once before importing the UI; unknown keys are ignored by destructuring, not validated. It does not hot-swap policy semantics after modules have captured references.

## Asset Resolver Coverage

The legacy UI fetched game resources with absolute `/assets/game/...` URLs. The extraction routes resource identity through `src/handoff/services.js` `resolveAsset`, but coverage is partial by design.

Covered paths:

- Explicit wrapper loads (`src/handoff/asset-loaders.js`) resolve before Three.js loaders run:
  - `gltf` top-level geometry files (`loadModel` descriptor `desc.url`),
  - `texture` loads issued by the viewer's wrapper,
  - `image` loads for source mip levels,
  - `cube-texture` wrapper loads; array URLs are resolved face-by-face with `context.faceIndex` (`asset-loaders.js:15`). This covers cube face URL resolution for the wrapper path.
- Audio clips call `resolveAsset(clip.url, {kind: 'audio'})` with a raw URL string fallback (`src/appearance/resource-voices.js:53`, `src/skin-voices.js:118`).
- The custom DDS cube path (`src/cube-texture.js`) obtains bytes through `requestJSON` (catalog provider), not the asset resolver.
- Skeleton JSON, source composite texture bytes, motion clips and other `/data` references use `requestJSON`.
- `data:` and `blob:` URLs return unchanged when no resolver is configured (`services.js:74`).

Not guaranteed to pass through the resolver:

- DOM `new Image()`/`img.src` assignments (UI thumbnails, expression bubbles, scene backgrounds, voice panel bitmaps) use whatever URL the catalog supplied; the host must publish those URLs so the browser can fetch them directly.
- Internal GLTF dependencies. `GLTFLoader` resolves buffers, embedded images and external textures itself; only the top-level GLTF URL goes through the wrapper. A host that cannot serve such relative references must preprocess or inline them.
- Legacy preview URLs such as `row.url` in expression rows are assigned directly to DOM media.

Consequently `assetResolver` is a load-path adapter for explicit wrapper loads, not a universal sandbox. The fixture resolver deliberately throws to prove no silent fallback exists.

## Audio Coverage

Audio playback uses a single `<audio>` element per panel. Sources resolve through the resolver when provided; a resolver returning a non-string result is assigned as-is, so hosts must return a playable URL. `stop()` removes the `src` attribute and calls `load()`.

## Catalog Memoization

- The primary `/data/wardrobe.json` projection is read once per adapter instance (`appearance/main.js:537`).
- `AppearanceWardrobe` memoizes fashion-parts and fragment-wardrobe promises; failed promises are cleared for retry.
- `AppearanceSocial.load()` memoizes its settled catalog group.
- `ResourceVoices` caches per language URL and evicts a failed URL.
- `viewer.motionExtraCatalog` memoizes `/data/action-extras.json`.
- `SocialPanel`-style panels (`src/social.js`) cache motion index/maps per instance.

There is no live update mechanism. Changing `runtimePolicy`, calling `configureHandoffServices` again, or dispatching DOM events does not replace these caches. A host that changes catalogs after first load must restart the workbench or implement the explicit reload boundary proposed in `docs/CATALOG-UPDATES.md` (not implemented).

## Fixture Mode

`src/handoff/bootstrap.js` configures a demo catalog provider, a resolver that throws for every game asset, and `fixtureMode: true` unless `window.oldUiHandoffServices` is provided. In fixture mode `appearance/main.js` skips default-actor wear, social/scene loading, and the `from=play` outfit restoration branch (`main.js:543-556`). The `from=play` branch runs only in non-fixture mode and resolves saved outfit snapshots against the live catalog; it is a host-provided navigation result, not a fixture feature.

The demo intentionally shows an unavailable-resource state. It validates the UI/catalog boundary only. It does not demonstrate 3D rendering, audio, thumbnails of game assets, or any host policy behavior.

## Navigation Boundary

The brand-logo handler preserves the legacy contract `location.assign('/play.html')` after writing the current outfit snapshot (`appearance/main.js:274`). `appearance.html` marks that link `aria-disabled` with a host-navigation title. The extraction has no `/play.html` route and cannot complete this navigation standalone. A host must provide either that route or its own navigation adapter; the handoff exposes no configuration point to replace the handler, so integration requires host-side interception or a source change.

Map and other legacy links are similarly host-owned and marked unavailable in markup.

## UI Assets

The `src/appearance/assets/` SVG files are interface icons (category icons, expand arrows, title, return glyph), not game resources. The title (`标题.svg`) and return (`返回.svg`) SVGs were verified hash-identical to their `UIDemo/web` and `product/web/src/appearance/assets` originals; they contain embedded base64 bitmap UI imagery whose bitmap licensing is not cleared by this handoff. The check script (`scripts/check-handoff.mjs`) permits exactly those two reviewed embedded-UI-image exceptions and rejects any other SVG containing `<image>`/`base64,` content; it also blocks standalone image/audio/video asset files outright.

## Excluded From The Extraction

- The legacy static server and its route/cache policy.
- All `/data` catalog files, generated `catalog.json`, historical conversion caches and extraction reports.
- Game assets: GLB/GLTF/bin geometry, textures, audio, unpacked directories.
- `node_modules`, `dist` outputs and generated build artifacts.
- Any credential, account, or backend mutation surface.

The host must reproduce delivery semantics for anything the UI requests.

## Inherited Behavior, Not Isolation Changes

The following are source-inspected legacy behaviors preserved verbatim, not new isolation work; each is documented in `docs/WARDROBE-CONTRACT.md` with evidence:

- Partial outfit restoration is not automatically retried after mode is set to outfit.
- Fashion/fragment rebuild loops stop at the first accessory equip failure and commit the new actor first.
- `loadModel` lacks an encompassing disposal guard around material construction and face-frame awaits.

These behaviors were not fixed by the extraction; they are documented inherited limitations.

## Validation Numbers

Recorded from commands explicitly targeting `D:/Proj/old-ui-handoff` after the final cube policy, regression tests and validation document were added. Earlier intermediate counts are superseded.

- `npm test`: 51/51 tests pass, 0 failures (node --test, exit 0).
- `npm run check`: `allowedFiles: 354`, `syntaxModules: 316` (includes `.mjs` scripts), `relativeImports: 623`, `reviewedEmbeddedUiImages: 2`, `forbiddenEntries: 0`.
- `docs/FILE-MANIFEST.json` is regenerated via `node scripts/manifest.mjs D:/Proj/NeoX23Js/product/web` against the read-only original: 353 entries (the manifest excludes itself), of which 287 `unchanged-copy`, 37 `adapted-copy`, 29 `new`. Original hashes are observations at final validation, not a pre-extraction baseline.
- `npm run build`: passed with 1867 transformed modules and a 2075.67 kB main minified chunk; the chunk-size warning remains.
- Fixture DOM behavior was checked, but asset-backed rendering, playback, audio and visual parity were not accepted. See `VALIDATION.md` for exact scope and execution deviations.
