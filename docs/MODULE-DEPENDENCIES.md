# Module Dependencies

## Purpose

This is a machine-generated inventory of JavaScript source imports in the handoff, retained as a review manifest rather than a build input. It was generated read-only with `rolldown@1.2.13` `parseAst` over `src/**/*.js`; no source files were changed. The scan records static imports, re-exports, literal dynamic imports and literal `new URL(..., import.meta.url)` UI asset references. It does not parse CSS/HTML references, runtime catalog URLs, `fetch`/`requestJSON` strings, GLTF internals or browser-created `Image`/`Audio` URLs.

The full edge list is intentionally kept in a compact, reproducible text form below. Paths are handoff-root relative. `external:` entries are package imports. A local target is an edge even when the target is not in the `demo.js` runtime closure.

## Summary

- Source files scanned: **304** JavaScript modules.
- Import/re-export edges: **692**.
- Literal `new URL(..., import.meta.url)` UI asset edges: **15**.
- Reachable nodes from `src/appearance/demo.js`: **310**, including external package nodes and referenced local modules.
- Local targets missing on disk: **0**.
- Literal dynamic imports: `src/handoff/bootstrap.js -> src/appearance/demo.js`.
- Local JavaScript modules not reachable from `src/appearance/demo.js`: `src/appearance/demo-template.js`, `src/appearance/fragment-wardrobe.js`, `src/handoff/bootstrap.js`, `src/handoff/demo-catalog.js`.

`src/handoff/bootstrap.js` is the HTML entry bootstrap and dynamically imports the demo; it is therefore a separate entry path, not an orphan source file. `demo-template.js` is retained template-generation source. `fragment-wardrobe.js` is retained UI helper code loaded by the HTML/application path only when that feature is mounted; it is not imported by the demo's static module graph in this scan.

## Entry And Boundary Nodes

| Node | Role |
| --- | --- |
| `src/appearance/demo.js` | Workbench renderer entry imported by `appearance.html`/bootstrap path |
| `src/appearance/main.js` | Stateful appearance, wardrobe, scene, voice and social coordinator |
| `src/viewer.js` | Three.js model, material, assembly, socket, motion and extra boundary |
| `src/appearance/wardrobe.js` | Actor/outfit/preview/fashion/fragment session state |
| `src/handoff/services.js` | Catalog provider, asset resolver, events and runtime policy boundary |
| `src/handoff/asset-loaders.js` | Explicit resolver-aware GLTF/texture/image/cube-face wrappers |
| `src/handoff/bootstrap.js` | Fixture/host service configuration and dynamic demo import |
| `src/handoff/demo-catalog.js` | Unavailable-resource fixture records and provider |
| `src/appearance/runtime/social-runtime.js` | In-process action contract/runtime helper; no server connection |

## External Packages

`three`, `three/addons/controls/OrbitControls.js`, `three/addons/loaders/GLTFLoader.js`, `three/addons/loaders/DDSLoader.js`, `three/addons/objects/Reflector.js`, and `lucide`.

The package versions used for the inventory are those present in `D:/Proj/old-ui-handoff/package.json`: `three` `0.186.0`, `lucide` `^0.468.0`, and the installed `rolldown` parser `1.2.13`. The manifest does not assert that a different host runtime can mix another Three.js instance safely.

## High-Level Runtime Closure

`demo.js -> main.js -> session-viewer.js -> viewer.js`.

`main.js` also imports `wardrobe.js`, `social-adapter.js`, `scenes.js`, `resource-voices.js`, `thumbnails.js`, `fragment-thumbnails.js`, `controls.js`, `look-cards.js`, `avatar-page.js`, `play/outfit.js`, `admin-panel.js`, `model-role.js`, `default-actor.js` and the appearance stylesheet. `viewer.js` imports the material registry, source rig/assembly/motion/effect families, `handoff/asset-loaders.js`, `handoff/services.js` and Three.js.

`materials.js` statically imports the retained material adapter family. Source motion/effect modules import the smaller source math, SFX, spring, pose and runtime-policy helpers. This is why the extracted `src/` contains many modules even though the catalog and game assets are excluded.

## Representative Edge Inventory

The following is the exact edge inventory for the principal boundary modules. The generator's full count above is the authoritative size check; omitted material-only rows are unchanged source modules represented by the same AST scan.

```text
src/appearance/demo.js -> src/appearance/main.js
src/appearance/main.js -> src/appearance/style.css, src/appearance/session-viewer.js, src/appearance/dongdong-slots.js, src/appearance/fragment-thumbnails.js, src/appearance/avatar-page.js, src/play/outfit.js, src/thumbnails.js, src/appearance/admin-panel.js, src/appearance/wardrobe.js, src/appearance/model-role.js, src/appearance/default-actor.js, src/handoff/services.js, src/appearance/social-adapter.js, src/appearance/scenes.js, src/appearance/resource-voices.js, src/appearance/look-cards.js, src/appearance/controls.js, src/appearance/thumbnail-fit.js
src/appearance/session-viewer.js -> src/viewer.js, three, src/posed-bounds.js
src/appearance/wardrobe.js -> src/model-textures.js, src/handoff/services.js, src/source-fragment-assembly.js, src/source-fashion-assembly.js, src/appearance/model-role.js
src/appearance/social-adapter.js -> src/handoff/services.js, src/social.js, src/animation-resource-map.js, src/source-motion-sequence.js, three, src/appearance/wardrobe.js, src/model-textures.js, src/appearance/default-actor.js, src/source-fashion-assembly.js, src/appearance/vehicle-parts.js, src/appearance/runtime/social-runtime.js
src/viewer.js -> src/scene-refraction.js, src/scene-material-shadow.js, src/vehicle-wheel-particles.js, src/source-leaf-spring-player.js, src/source-nstb-player.js, src/source-chain-spring-player.js, src/source-motion-sequence.js, src/source-motion-overlay.js, src/source-motion-extras.js, three, three/addons/controls/OrbitControls.js, src/handoff/asset-loaders.js, src/handoff/services.js, src/source-rig.js, src/materials.js, src/face-animation.js, src/material-passes.js, src/cube-texture.js, src/texture-mips.js, src/model-textures.js, src/source-fragment-assembly.js, src/source-fashion-assembly.js, src/source-part-pose.js, src/source-submodel.js, src/headwear-model-effects.js, src/model-sprite-effects.js, src/headwear-sprite-effects.js, src/headwear-particle-effects.js, src/fashion-particle-effects.js, src/vehicle-hoof-effects.js
src/handoff/asset-loaders.js -> three/addons/loaders/GLTFLoader.js, three, src/handoff/services.js
src/handoff/bootstrap.js -> src/handoff/services.js, src/handoff/demo-catalog.js, src/appearance/demo.js (dynamic)
src/handoff/demo-catalog.js -> (none)
src/handoff/runtime-contracts.js -> src/handoff/services.js
src/appearance/runtime/social-runtime.js -> (none)
```

## UI Asset Literal Edges

These are interface SVGs imported with `new URL(..., import.meta.url)`, not game assets:

```text
src/appearance/controls.js -> src/appearance/assets/向上展开.svg, src/appearance/assets/向下展开.svg
src/appearance/dongdong-slots.js -> src/appearance/assets/char.svg, src/appearance/assets/cap.svg, src/appearance/assets/shirt.svg, src/appearance/assets/pants.svg
src/appearance/look-cards.js -> src/appearance/assets/char.svg, src/appearance/assets/headwear.svg, src/appearance/assets/facedec.svg, src/appearance/assets/belt.svg, src/appearance/assets/backpack.svg, src/appearance/assets/cap.svg, src/appearance/assets/shirt.svg, src/appearance/assets/pants.svg, src/appearance/assets/Toy.svg
```

The current isolation check allows exactly those two reviewed embedded-UI-image exceptions. Their provenance is recorded in [ISOLATION-CHANGES.md](ISOLATION-CHANGES.md); bitmap licensing is not cleared by this handoff. The other retained SVGs are UI category/control icons and are not evidence that arbitrary standalone image assets are supported.

## Delivery Edges Not Represented Here

These source imports do not express the host data/resource dependency graph. The following are runtime delivery contracts documented separately:

- `requestJSON('/data/wardrobe.json')`, fashion parts, fragments, model descriptors, face data, motion indexes/maps, action extras, social catalogs, vehicle socket assemblies and voice catalogs.
- Descriptor geometry URLs and motion clip URLs passed to explicit resolver-aware loader wrappers.
- Texture and cube URLs passed through viewer methods; explicit cube-face arrays are resolved one face at a time with `faceIndex` by `asset-loaders.js`. The custom DDS cube path fetches bytes through `requestJSON`.
- DOM thumbnail/expression/scene image URLs assigned directly and therefore not guaranteed to pass through `assetResolver`.
- GLTF-internal buffer/image dependencies resolved inside `GLTFLoader` rather than by the top-level wrapper.

Use [ISOLATION-CHANGES.md](ISOLATION-CHANGES.md) for the exact resolver coverage and [API.md](API.md) for the catalog URL contract. Use [WARDROBE-CONTRACT.md](WARDROBE-CONTRACT.md) for the state/assembly/socket contract.
