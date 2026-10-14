# Final Validation

Validation date: 2026-10-14. Scope: mature appearance wardrobe handoff only, outside the legacy project; no new-project code was entered or changed.

## Automated Checks

- `npm --prefix D:/Proj/old-ui-handoff test`: 51 tests passed, 0 failed. This includes three new DDS cube-policy regressions covering removal of implicit legacy path ownership, host-approved resource-neutral delivery/cache, and retry after invalid bytes.
- `npm --prefix D:/Proj/old-ui-handoff run check`: syntax, relative import closure, forbidden resource entries, workspace coupling, symlinks, and the two reviewed embedded UI SVG exceptions are checked. Exact final counts are recorded in ISOLATION-CHANGES.md.
- `npm --prefix D:/Proj/old-ui-handoff run build`: Vite 8.2.2 succeeded, 1867 modules transformed. The main minified demo chunk is 2075.67 kB. The chunk-size warning is retained, not suppressed or solved through an unrelated refactor.
- `node scripts/manifest.mjs <original-web-root>` generates per-file SHA-256 and original-copy comparison metadata. There was no pre-extraction hash baseline.
- `scripts/package-handoff.ps1` verifies archive paths, duplicates, completeness, content hashes, and forbidden entries against the final manifest; the manifest itself is hashed separately.

## Browser Fixture Evidence

The asset-free fixture was served at http://127.0.0.1:4331/appearance.html during validation. DOM observations confirmed initialization, the explicit runtime-unconnected status, a no-results search, headwear category selection, an unavailable demo resource, and favorite checkbox state. A screenshot was captured but was not visually accepted, so no screenshot or pixel-based visual acceptance is claimed. Filter-menu interaction was not conclusively verified.

The fixture deliberately ships no game geometry, textures, audio, or old generated catalogs. It does not prove asset-backed 3D rendering or runtime integration.

## Remaining Validation Gaps

Real WebGL/DOM model load and equip integration, live host asset delivery, multi-actor posed framing follow, SourceAdditiveMotionExtra, browser audio failure behavior, and global service isolation between suites require host integration testing. Internal GLTF resources and direct DOM media are not universally intercepted by assetResolver.

Catalogs are memoized and there is no wired live invalidation API. Published variants, source rig sockets, extra models, and specialized material/effect algorithms remain included but require valid host descriptors and policy contracts. UI title and return SVGs are hash-identical to their mature originals; embedded artwork licensing is not independently cleared.

Inherited behavior is documented rather than opportunistically changed: SocialRuntimeBridge.tick uses raw delta rather than stored playbackRate; partial outfit restoration has no automatic retry; fashion/fragment rebuilds stop at the first equip failure; loadModel has no encompassing disposal guard around all material/face-frame awaits.

## Execution Deviation

An initial final-validation command set ran from the legacy workspace instead of the handoff. Its results were discarded: legacy tests failed, no check script existed, and its build regenerated legacy dist output. No legacy source/config files were intentionally edited; generated legacy build output was not removed or reverted because its prior state was not baselined. Final handoff validation used explicit npm --prefix targeting. The new project was not accessed.

## Delivery Shape

The shipped handoff directory and ZIP exclude node_modules and build-output. Reinstall with `npm ci` to run the fixture or tests; retain package-lock.json. The validation development server is stopped before cleanup, so the historical validation URL is not promised to remain running.
