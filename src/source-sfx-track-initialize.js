import {compileSourceSfxTrackProfile,bindSourceSfxTrack} from './source-sfx-track.js';
import {bindSourceSfxTrackClock} from './source-sfx-track-clock.js';
import {sourceSfxInheritTransform} from './source-sfx-controller.js';
import {bindSourceSfxTrackUpdate} from './source-sfx-track-update.js';

const identity=()=>({translation:[0,0,0],scale:[1,1,1],rotation:[1,0,0,0,1,0,0,0,1],flags:0});
const kinds=['TrackFixPoint','TrackLine','TrackCircle','TrackRotate','TrackScale'];
const parentPath=p=>p.slice(0,p.lastIndexOf('/'));

// FxBase 2b51098..2b51174 checks the entire runtime parent chain, not the
// actor/controller hierarchy. Static tracks are sought and folded exactly once.
// Controller set-position 2b847dc writes both offset20 and local.translation38.
export function initializeSourceSfxControllerTrack(controller,{positionOffset,track=null}){
  if(!Array.isArray(positionOffset)||positionOffset.length!==3||positionOffset.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw new TypeError('Finite source PosOffset required');
  let allStatic=true;
  const seen=new Set();
  for(let current=track;current;current=current.parentTrack){
    if(seen.has(current))throw new Error('Cyclic source track parent chain');
    seen.add(current);
    if(typeof current.isStatic!=='boolean')throw new TypeError('Source track static classification required');
    if(!current.isStatic){allStatic=false;break;}
  }
  controller.positionOffset=positionOffset.map(Math.fround);
  controller.local={...controller.local,translation:[...controller.positionOffset]};
  if(!track)return {mode:'none'};
  if(allStatic){
    track.seek(0);
    controller.local=sourceSfxInheritTransform(track.getTransform(),controller.local,7);
    return {mode:'folded'};
  }
  controller.track=track;
  track.stop();
  controller.trackAttached=true; // Native controller+c0.
  return {mode:'attached'};
}

// SFX factory 2b50194 creates tracks with a null runtime parent. Constructor
// 2e75f4c supplies identity base, mask7, and no parent-control propagation.
// Actor nesting is handled by parentController, never by inventing track links.
export function initializeSourceSfxNodeTrack(controller,{orderedNodes,path,readFrameDelta,profileOptions}){
  const node=orderedNodes.find(n=>n.path===path);
  if(!node)throw new Error(`Missing source SFX node ${path}`);
  const positionOffset=typeof node.attributes.PosOffset==='string'?JSON.parse(node.attributes.PosOffset):node.attributes.PosOffset;
  const type=Number(node.attributes.TrackType);
  const children=orderedNodes.filter(n=>parentPath(n.path)===path&&/^Track[^/]*\[\d+\]$/.test(n.path.slice(path.length+1)));
  if(!children.length){
    // Source skips factory entirely for a null parsed payload, even if type exists.
    return initializeSourceSfxControllerTrack(controller,{positionOffset});
  }
  if(children.length!==1||!Number.isInteger(type)||!kinds[type]||!children[0].path.slice(path.length+1).startsWith(`${kinds[type]}[`))throw new RangeError(`Unresolved source track payload/type at ${path}`);
  const profile=compileSourceSfxTrackProfile(orderedNodes,children[0].path,profileOptions);
  // Native construction already has a readable TRS before the first seek.
  // Line2e71a9c writes StartPos; dynamic Scale/Rotate/Circle leave constructor
  // identity untouched. Sampling time0 here would incorrectly apply curves,
  // start angle or circle radius before the source ever samples them.
  const initialTransform=identity();
  if(type===1){
    const start=children[0].attributes.StartPos;
    initialTransform.translation=(typeof start==='string'?JSON.parse(start):start).map(Math.fround);
  }
  const sampled=bindSourceSfxTrack(profile,{baseTransform:identity(),inheritanceMask:7,initialTransform});
  const runtime=bindSourceSfxTrackUpdate(bindSourceSfxTrackClock(sampled,{readFrameDelta}),sampled,
    {repeatEnabled:false,tangentEnabled:false,preserveUp:false});
  const result=initializeSourceSfxControllerTrack(controller,{positionOffset,track:runtime});
  return {...result,path:children[0].path,kind:profile.kind,numericalStatus:profile.numericalStatus};
}
