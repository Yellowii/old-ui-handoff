# Mature Wardrobe UI Handoff

This directory is a portable extraction of the implemented `product/web` appearance wardrobe. It preserves the existing page layout, category navigation, resource cards, search/quality/sort filtering, incremental catalog rendering, favorites, published dye variants, outfit state, socket attachments, fragment/fashion-part assembly, motion playback controls, Idle restoration, thumbnails, camera framing, zoom and user gesture handling.

## Run

```bash
npm install
npm test
npm run check
npm run build
npm run dev
```

Open `http://127.0.0.1:4331/appearance.html`. The default entry uses `src/handoff/bootstrap.js` and a small catalog fixture. It intentionally shows an unavailable-resource state: no GLB, textures, sounds, unpacked files, parsed catalog, or historical cache is included. The fixture validates the UI/catalog state boundary; it does not claim that 3D rendering works without a host runtime.

## Host integration

Before importing `src/appearance/demo.js`, configure the service boundary:

```js
import { configureHandoffServices } from './src/handoff/services.js';
configureHandoffServices({
  catalogProvider: async ({ url, ...options }) => hostCatalog.request(url, options),
  assetResolver: (resourceRef, context) => hostAssets.resolve(resourceRef, context),
  runtimePolicy: {
    sharedMotionCatalogPath: hostMotion.sharedCatalogPath,
    sourceCubeMatcher: (url, context) => hostAssets.isPublishedCube(url, context),
    // Optional fail-closed source contracts are supplied only when used.
    sceneLight: { sunDirection: [0.4, -1, 0.2], sunColor: [1, 0.9, 0.8] },
  },
  catalogExtras: { metadata, social, voiceCatalogs },
});
await import('./src/appearance/demo.js');
```

`catalogProvider` must return a Fetch-like response (`ok`, `status`, `json()`, and `arrayBuffer()` where binary bytes are requested) or plain JSON/bytes. `requestJSON` keeps the old request URL contract while making the provider replaceable; it also carries source skeleton JSON, raw composite texture bytes and DDS cube bytes, not just catalogs. `assetResolver` receives a string normalized to `{url}` or an existing resource reference. The installed loader wrappers pass `{kind, runtimePolicy}` for explicit GLTF, texture and image loads; audio callers pass `{kind: 'audio'}`. This is not universal interception: DOM image URLs and GLTF-internal buffers/images are not guaranteed to pass through it. See `docs/ISOLATION-CHANGES.md` for exact coverage and limits.

The host must provide these legacy catalog contracts when the relevant feature is enabled: `/data/wardrobe.json`, `/data/fashion-parts.json`, `/data/fragment-wardrobe.json`, `/data/models/{modelId}.json`, `/data/motion-index.json`, `/data/model-animation-maps.json`, `/data/action-extras.json`, `/data/multi-person-actions.json`, `/data/vehicle-socket-assemblies.json`, and `/data/face-animations.json`. See `docs/API.md` for fields and failure behavior.

## Module boundaries

- `src/appearance/demo.js`, `main.js`, `style.css`, templates, controls, details, favorites: mature workbench UI and interaction state.
- `src/appearance/wardrobe.js`, `session-viewer.js`, `fragment-wardrobe.js`, `source-fashion-assembly.js`, `source-fragment-assembly.js`: outfit/session behavior, fragment and fashion-part assembly, preview versus saved outfit semantics.
- `src/viewer.js`, `src/handoff/asset-loaders.js`, material adapters, assembly/motion/effects modules: Three.js runtime and loader consumption contracts. These remain included for faithful behavior but require a host asset resolver and compatible Three.js runtime.
- `src/appearance/social-adapter.js`, `src/appearance/runtime/`, `src/social.js`: social/action catalog, playback, pause/seek/rate/stop, extra-model and Idle lifecycle.
- `src/handoff/services.js`, `src/handoff/demo-catalog.js`: replaceable data, asset, event and fixture boundary.

## Dynamic catalog behavior

The original UI consumes an item catalog and derives cards by category, search text, quality, sort order, favorites and published variants. Resources included when the host `WardrobeCatalog` is initially loaded can appear in existing categories using a known `businessCategoryId`, `equipSlot`, variant records and capability flags. This is catalog-driven projection, not live updating: the primary items and several capability catalogs are retained or promise-memoized per instance, and there is no wired reload/invalidation API. Reconfiguring services or emitting an event does not replace loaded catalogs. New category/capability kinds still need an adapter/renderer dispatch path. See `docs/CATALOG-UPDATES.md`.

The same workbench keeps one `AppearanceWardrobe` session and one `SessionViewer`; selecting, previewing, wearing, removing, restoring, changing fragments, changing fashion parts and playing social resources operate through that session. Verified state semantics and inherited limitations are recorded in `docs/WARDROBE-CONTRACT.md`.

Dye controls use published `variants`/`dyeGroup` values. The extraction does not invent arbitrary RGB dye behavior. Socket attachments use item socket candidates and host-provided descriptor source bones/named nodes. Motion extras use the action-extra catalog and host loader; independent skeletons remain a runtime requirement.

## What is not standalone

- 3D model, texture, audio, skeleton and motion playback cannot succeed with the fixture because no game assets are shipped.
- The legacy service server, `/data` files, `/assets/game` files and generated `catalog.json` are excluded. The integrating host must provide delivery through `catalogProvider`, `assetResolver` and browser-usable URLs where the current DOM/GLTF paths bypass that resolver.
- The old shared motion catalog path, vehicle special-case ID, DongDong character whitelist and other source-specific ownership checks are not migration inputs. They are host policies/capabilities documented in `docs/ISOLATION-CHANGES.md`.
- Existing Three.js loaders must not be run beside a second incompatible runtime. Use one compatible Three.js instance; explicit wrapper loads use the resolver, while internal GLTF dependencies and DOM media delivery need separate host URL handling.

## Source and exclusion audit

The extraction is centered on the import closure beginning at `product/web/src/appearance/demo.js`, with handoff bootstrap/fixture modules and retained inactive UI helpers. The exact JavaScript inventory and dependency boundaries are documented in `docs/MODULE-DEPENDENCIES.md`. `src/appearance/catalog.json`, `public`, `dist*`, `node_modules`, game assets, GLB/gltf/bin files, textures, unpacked directories, reports, and historical conversion caches are excluded from the source handoff baseline. UI SVG icons are retained because they are interface assets, not game resources. Installed dependencies and generated build output in this working directory are not original game assets. During this documentation task, `D:/Proj/NeoX23Js` was accessed read-only. This statement does not assert a hash baseline taken before the original extraction.
