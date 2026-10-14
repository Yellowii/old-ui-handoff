# Wardrobe Contract

## Scope And Evidence

This records source-inspected behavior in the extracted appearance workbench. It is not an asset-backed visual acceptance result. Source paths below are relative to this handoff unless explicitly marked original. No source, test or package changes are part of this documentation task.

## Catalog And Entry Shapes

`appearance/main.js` loads `/data/wardrobe.json` once and requires `items` to be an array. The current projection uses known `businessCategoryId` values (`skin`, `headwear`, `facewear`, `waistwear`, `backwear`, `hair`, `upper`, `lower`) and dedicated social/scene/look branches. Merely adding a novel category or `capabilities` key does not install new behavior.

Wardrobe entry shape consumed by the implementation:

```js
{
  item: {
    id, itemId, name, businessCategoryId, equipSlot,
    variants, socket, partAssemblyRoles, renderBlock,
    fragmentWardrobe, preserveSourceDefault
  },
  variant: {id, name, isDefault, preview, runtime, renderBlock},
  role: 'preview', // or 'runtime'
  fragmentParts: undefined, // selected business-position -> fragment ID mapping
  fashionParts: undefined // selected hair/upper/lower -> part ID mapping
}
```

Fields are conditional, not an assertion that every row supplies all of them. `variants` must be an array for normal wardrobe rows. Skin `preview`/`runtime` roles require the exact corresponding model (`appearance/model-role.js:3`); accessories use the preferred role with opposite-role fallback (`wardrobe.js:16`). `defaultVariant()` honors `preserveSourceDefault`, then a default with a model, then any modeled variant, then the first row (`wardrobe.js:15`).

## Session State

`AppearanceWardrobe` keeps `actor` (saved base entry), `outfit` (Map from accessory slot to entry), `shown` (last displayed entry), `mode` (`single` or `outfit`) and warnings (`wardrobe.js:30`). This session draft is distinct from saved-look recipes in localStorage.

| Operation | Actual effect |
| --- | --- |
| `show(entry)` | Resolve model/assembly, await viewer show and onShow callback, then expose shown entry and warnings; not itself an outfit save |
| `preview(entry)` | Show an item alone; keep saved actor/outfit; set mode single; rear accessories frame from 180 degrees |
| `restore()` | Require an actor; return immediately if already in outfit mode; otherwise show saved actor and attempt all saved accessory slots |
| `wear(skin)` | Show and commit actor, set outfit mode, attempt all saved accessories; collect failures while preserving their choices |
| `wear(accessory)` | Restore outfit first, equip, then replace saved slot only after successful equip |
| `wear(hair/upper/lower)` | Require supported role in `partAssemblyRoles`, then rebuild fashion assembly |
| `remove(slot)` | Remove saved accessory and visible slot in outfit mode; fashion slots rebuild selected fashion parts |
| `clear()` | Clear saved accessories and visible accessories in outfit mode; does not reset actor or actor's fashion/fragment parts |

Evidence: `wardrobe.js:65` (show), `:94` (preview), `:99` (restore), `:118` (wear), `:150` (remove), `:156` (clear). The UI reset separately wears the initial actor (`appearance/main.js:194`).

## Selection Versus Preview Versus Wear

The UI records selection and usage before trying to show/wear (`appearance/main.js:465`). `select()` can return true even if a resource has no model or the serialized operation reports a load error. True means the selection path was accepted, not that rendering or equipping succeeded. Busy operations return false and are not queued (`main.js:147`).

`showCurrent()` chooses single-item preview for non-skin resources in single mode, or for items blocked by `wearBlock`; otherwise it wears (`main.js:182`). `wearBlock` respects item renderBlock, requires fashion assembly roles for hair/upper/lower, and restricts ordinary accessory slots to face/head/waist/back (`wardrobe.js:20`). Unsupported wearing may still allow isolated inspection. An item/variant renderBlock is checked again by show/wear.

Changing category during an in-flight single-item operation schedules saved-outfit restoration after it completes (`main.js:159`, `:420`). Viewer model-generation protection disposes superseded completed loads (`viewer.js:182`). These guards are not a transaction or complete state rollback.

## Published Variants

The dye UI selects existing variant records, never arbitrary RGB colors (`appearance/demo.js:116`). The resource projection derives `dyeGroup`: fragment-capable skin -> wardrobe; two through four variants -> basic; otherwise none (`main.js:174`). Fragment clothing cards are not extra color variants (`dongdong-slots.js:3`). Do not promise an unlimited variant editor merely because the catalog can contain more rows.

`appearance.variant(value)` blocks an unready socket assembly, tries the change, restores the old selectedVariant on failure, and updates saved selection on success (`main.js:510`). Saved looks resolve the exact saved variant ID and reject unavailable references instead of substituting a different dye (`main.js:315`). Failure does not imply the entire displayed outfit was rolled back.

## Assembly Contracts

Fashion assembly uses `defaults` and `parts`, a shared skeleton URL, per-role model/texture metadata, runtime byte-block composition, face frames, optional poseOffsetContract and specialPartContract. Hair/upper/lower changes are not independent skeleton substitutions (`source-fashion-assembly.js:2`).

Fragment assembly uses `characters[itemId].variants[variantId][role]`, `fragment_parts_data`, `fragment_suit_data`, default suit, conflict positions, slot choices and model lookup. It rejects unready parts, conflicting coverage and missing base models (`source-fragment-assembly.js:3`). Combined meshes require matching source skeleton URLs, every referenced bone in the base rig, and supported identity ancestry (`source-fragment-assembly.js:54`).

`changeFashionParts` and `changeFragments` rebuild the actor, commit its part selection and re-equip saved accessories (`wardrobe.js:49`, `:59`). They clear the mutually exclusive fragment/fashion selection on the new entry. Both catalog loading promises reset on failure for explicit retry; successful values are memoized (`wardrobe.js:39`).

## Accessory Sockets

`viewer.equip(slot, item, variant)` requires an actor, rejects direct hair/upper/lower replacement, and selects accessory quality using the actor descriptor's `capabilities.previewQuality` (`viewer.js:226`). This is not a runtimePolicy callback.

`item.socket` must be an array of candidate names. Candidates are checked against source bones or named actor nodes. If candidates exist but none resolves, equipping fails: shared-bone fallback is allowed only when the candidate array is empty and every bone of every skinned mesh matches the actor. A partial match is rejected. The newly loaded accessory is disposed on this explicit blocked path; the old equipped slot is removed only after attachment succeeds (`viewer.js:232`).

`source-rig.js:4` reconstructs omitted source bones. Auxiliary sockets require raw_flag 2; the explicit parent -2 form attaches to the model root, unsupported forms are returned as skipped. The term socket refers to model attachment points, never a network connection.

## Motion Extras And Idle

`loadMotionExtras` consults memoized `/data/action-extras.json`, resolves the role/animKey row, requires status ready, resolves source sockets, loads independent extra models and clips, applies scale/offset/angle and creates extra playback (`viewer.js:442`). Unsupported special animation/paint/transform rules become warnings. If one extra fails, already successful extras from that group are disposed and an empty group plus warning is returned.

The ordinary `playMotionItem` path can play its skeleton clips with extra warnings rather than blocking the whole action (`viewer.js:400`). `showMotionCompanion` additionally rejects a required-extra group count mismatch (`viewer.js:267`). Therefore extras are not universally fail-closed. Companion loads have a separate generation and keyed map; extra bone bindings are captured before extras attach, avoiding accidental actor binding to same-named prop bones.

`stopMotion` invalidates animation work and clears active extras. AppearanceSocial stop/finish clears playback, multi-motion/companions and runtime effects before asynchronous idle restoration. See [RUNTIME-ADAPTER.md](RUNTIME-ADAPTER.md) for the lifecycle. No asset-backed animation or idle test was run during this documentation task.

## Verified Inherited Limitations

These are source-inspection findings compared with the read-only original at `D:/Proj/NeoX23Js/product/web/src`, not new reproduction or test results.

- Partial outfit restoration is not automatically retried: restore sets mode outfit before re-equipping; failures leave choices saved, and a second restore immediately returns while mode remains outfit. Handoff `wardrobe.js:99`; original `appearance/wardrobe.js:98` has the same flow.
- Fashion/fragment changes commit the new actor before their accessory loop, which stops at the first equip rejection rather than attempting remaining slots or rolling back. Handoff `wardrobe.js:49` and `:59`; original `appearance/wardrobe.js:48` and `:58` have the same flow.
- `loadModel` has no encompassing cleanup guard around descriptor material construction/face-frame loading, so cleanup is not guaranteed for exceptions there after GLTF allocation. Handoff `viewer.js:94` and original `viewer.js:92` both guard the later effect-attachment block only. Assembly/companion/stale-result cleanup exists in specific later branches; it does not establish universal exception safety.

These inherited behaviors are documented, not fixed. Missing game assets, host policy contracts, unsupported effect branches and unlocated media are delivery/capability limits, not evidence of visual parity or a newly verified runtime bug.
