import {initializeSourceSfxNodeTrack} from './source-sfx-track-initialize.js';
import {sourceSfxRecomposeController} from './source-sfx-controller.js';
const identity=()=>({translation:[0,0,0],scale:[1,1,1],rotation:[1,0,0,0,1,0,0,0,1],flags:0});
const kind=n=>n.path.split('/').at(-1).replace(/\[\d+\]$/,'');
export function compileSourceModelSfxControllers(effect){
 let delta=0;const controllers=new Map();
 for(const n of effect.orderedNodes){
  if(!['Dummy','Model','Sprite','ParticleSystem','PolyTubeEx'].includes(kind(n)))continue;
  const parent=n.path.slice(0,n.path.lastIndexOf('/'));
  if(parent!=='FxGroup'&&!controllers.has(parent))throw Error('蹄部特效父节点缺失');
  const c={path:n.path,local:identity(),world:identity(),inheritanceMask:7,separateScale:false,parentController:controllers.get(parent)};
  initializeSourceSfxNodeTrack(c,{orderedNodes:effect.orderedNodes,path:n.path,readFrameDelta:()=>({primaryDeltaMilliseconds:delta,fallbackDeltaMilliseconds:delta})});
  c.track?.seek(0);c.track?.start();controllers.set(n.path,c);
 }
 const update=dt=>{
  if(!Number.isFinite(dt)||dt<0)throw Error('Invalid hoof frame delta');
  delta=Math.fround(dt*1000);
  for(const c of controllers.values()){
   if(delta)c.track?.update();
   sourceSfxRecomposeController(c,{rootTransform:identity(),separateScaleEnabled:false});
  }
 };
 update(0);return {controllers,update};
}

