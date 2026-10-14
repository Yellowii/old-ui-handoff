import {createModelSprite,ADDITIVE_SPRITE_PROFILE} from './model-sprite-effects.js';
import {compileSourceModelSfxControllers} from './source-model-sfx-controllers.js';
import {sourceSfxTransformMatrix} from './source-sfx-controller.js';

import {requestJSON} from './handoff/services.js';
import {isReviewedEffect} from './handoff/runtime-contracts.js';

export const HEADWEAR_SPRITE_PROFILE='source-headwear-nested-sprites-v1';
let registry;
const resources=()=>registry??=requestJSON('/data/headwear-sprite-effects.json').then(r=>{if(!r.ok)throw Error('头饰光晕目录缺失');return r.json();}).catch(e=>{registry=null;throw e;});

export function compileHeadwearSprite(effect){
 if(effect.profile!==ADDITIVE_SPRITE_PROFILE||!isReviewedEffect(HEADWEAR_SPRITE_PROFILE,effect))throw Error('Unreviewed nested headwear Sprite; provide runtimePolicy.reviewedEffects');
 const runtime=compileSourceModelSfxControllers({orderedNodes:effect.controllerNodes});
 if([...runtime.controllers.values()].some(c=>c.track))throw Error('Animated nested Sprite requires lifecycle binding');
 const c=runtime.controllers.get(effect.nodePath);if(!c)throw Error('Source Sprite controller missing');
 return {matrix:sourceSfxTransformMatrix(c.world),controllers:runtime.controllers};
}

export async function attachHeadwearSpriteEffects(root,desc,loadTexture){
 const data=await resources();if(data.version!==1||data.profile!==HEADWEAR_SPRITE_PROFILE)throw Error('头饰光晕目录版本不受支持');
 const host=data.models[desc.id];if(!host)return;
 if(host.source.sha256!==desc.sourceBounds?.source?.sha256)throw Error('头饰光晕来源已变化，请重新生成');
 const active=[];
 for(const entry of host.entries){
  const socket=root.getObjectByName(entry.socket);if(!socket?.userData.sourceSocket)throw Error('头饰原挂点缺失：'+entry.socket);
  const effect=data.effects[entry.path],compiled=compileHeadwearSprite(effect),mesh=createModelSprite({...effect,effectPath:entry.path},await loadTexture(effect.image.url));
  mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(compiled.matrix);mesh.matrixWorldNeedsUpdate=true;mesh.name='source-headwear-glow';socket.add(mesh);
  active.push({path:entry.path,socket:entry.socket,nodePath:effect.nodePath,mesh,pendingNodes:effect.pendingNodes});
 }
 root.userData.headwearSpriteEffects={active,pending:host.pending};
}
