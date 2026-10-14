import {sourceSfxNormalize3} from './source-sfx-vector.js';
import {sourceSfxExtraScaleMatrix,sourceSfxSignedScale} from './source-sfx-extra-scale.js';
const f32=Math.fround;
const identityRotation=[1,0,0,0,1,0,0,0,1];
const copy=t=>({translation:t.translation.map(f32),scale:t.scale.map(f32),rotation:t.rotation.map(f32),flags:t.flags});
const identity=()=>({translation:[0,0,0],scale:[1,1,1],rotation:[...identityRotation],flags:0});
const required=(fn,name)=>{if(typeof fn!=='function')throw new TypeError(`${name} required`);return fn;};
function valid(t){
  if(!t||!Number.isInteger(t.flags))throw new TypeError('Source TRS with flags required');
  for(const [key,size] of [['translation',3],['scale',3],['rotation',9]]){
    if(!Array.isArray(t[key])||t[key].length!==size||t[key].some(x=>typeof x!=='number'||!Number.isFinite(x)))throw new TypeError(`Source TRS ${key} required`);
  }
  return t;
}
const dot=(a,b)=>f32(f32(f32(a[0]*b[0])+f32(a[1]*b[1]))+f32(a[2]*b[2]));
const transform=(p,r)=>[0,1,2].map(j=>f32(f32(f32(p[0]*r[j])+f32(p[1]*r[3+j]))+f32(p[2]*r[6+j])));
const isIdentity=r=>r.every((x,i)=>Object.is(x,identityRotation[i])); // Native memcmp distinguishes -0.

// 2a0db24/2b84b30: multiply row-vector bases, then Gram-Schmidt rows.
export function sourceSfxComposeRotation(a,b){
  a=a.map(f32);b=b.map(f32);
  const rows=[0,1,2].map(i=>[0,1,2].map(j=>f32(
    f32(f32(a[3*i]*b[j])+f32(a[3*i+2]*b[6+j]))+f32(0+f32(a[3*i+1]*b[3+j])))));
  const u=sourceSfxNormalize3(rows[0]);
  const vu=dot(rows[1],u),cu=dot(rows[2],u);
  const v=sourceSfxNormalize3(rows[1].map((x,i)=>f32(x-f32(vu*u[i]))));
  const cv=dot(rows[2],v);
  const w=sourceSfxNormalize3(rows[2].map((x,i)=>f32(x-f32(f32(cu*u[i])+f32(cv*v[i])))));
  return [...u,...v,...w];
}

export function sourceSfxInheritTransform(local,parent,mask){
  local=copy(valid(local));parent=copy(valid(parent));
  if(!Number.isInteger(mask)||mask<0||mask>65535)throw new TypeError('Source inheritance mask required');
  const world=copy(local);
  if((mask&7)===7){
    world.scale=world.scale.map((x,i)=>f32(x*parent.scale[i]));
    world.translation=world.translation.map((x,i)=>f32(x*parent.scale[i]));
    if(parent.flags&2){
      world.rotation=(local.flags&2)?sourceSfxComposeRotation(local.rotation,parent.rotation):parent.rotation.map(f32);
      world.flags|=2;
      world.translation=transform(world.translation,parent.rotation);
    }
    world.translation=world.translation.map((x,i)=>f32(x+parent.translation[i]));
    return world;
  }
  if(mask&4){
    world.translation=world.translation.map((x,i)=>f32(x*parent.scale[i]));
    world.scale=world.scale.map((x,i)=>f32(x*parent.scale[i]));
  }
  if(mask&2){
    world.rotation=sourceSfxComposeRotation(world.rotation,parent.rotation);
    world.flags=isIdentity(world.rotation)?0:2;
    world.translation=transform(world.translation,parent.rotation);
  }
  if(mask&1)world.translation=world.translation.map((x,i)=>f32(x+parent.translation[i]));
  return world;
}

// Controller2b84824; parentController or rootTransform is resolved from the
// source scene. Track transforms are sampled elsewhere by the real clock.
export function sourceSfxRecomposeController(controller,{rootTransform,separateScaleEnabled}){
  if(typeof separateScaleEnabled!=='boolean'||typeof controller.separateScale!=='boolean')throw new TypeError('Explicit scale-separation gates required');
  if(controller.track){
    controller.local=copy(valid(required(controller.track.getTransform,'track.getTransform')()));
    if(!Array.isArray(controller.positionOffset)||controller.positionOffset.length!==3)throw new TypeError('Source positionOffset required');
    controller.local.translation=controller.local.translation.map((x,i)=>f32(x+f32(controller.positionOffset[i])));
  }
  const parent=valid(controller.parentController?controller.parentController.world:rootTransform);
  controller.world=sourceSfxInheritTransform(controller.local,parent,controller.inheritanceMask);
  if(separateScaleEnabled&&controller.separateScale){
    if(controller.parentController){
      if(!Array.isArray(controller.parentController.externalScale))throw new TypeError('Parent externalScale required');
      controller.externalScale=controller.parentController.externalScale.map(f32);
    }else{
      controller.externalScale=parent.scale.map(f32);
      controller.world.scale=controller.local.scale.map(f32);
    }
  }
  return controller.world;
}

export function sourceSfxTransformMatrix(trs){
  valid(trs);
  return [0,1,2].flatMap(i=>[...trs.rotation.slice(3*i,3*i+3).map(x=>f32(x*trs.scale[i])),0])
    .concat(trs.translation.map(f32),1);
}

// The native action2 branch explicitly uses identity at spawn, then the
// controller world transform at render. Action1 is the converse. Identity
// here is source behavior, never a substitute for an absent controller.
// 2b49358: controller world relative to the owning group's attachment TRS.
// The particle keeps this birth-space offset while its frame follows the group.
export function sourceSfxGroupRelativeSpawn(world,group){
  world=copy(valid(world));group=copy(valid(group));
  if(group.scale.some(x=>x===0))throw new RangeError('Nonzero source group scale required');
  const inverse=[0,1,2].map(i=>[0,1,2].map(j=>f32(group.rotation[j*3+i]*f32(1/group.scale[j]))));
  const origin=[0,1,2].map(j=>f32(f32(f32(-group.translation[0]*inverse[0][j])+f32(-group.translation[1]*inverse[1][j]))+f32(-group.translation[2]*inverse[2][j])));
  const source=sourceSfxTransformMatrix(world),matrix=[];
  for(let i=0;i<3;i++){
    for(let j=0;j<3;j++)matrix.push(f32(f32(f32(source[i*4]*inverse[0][j])+f32(source[i*4+2]*inverse[2][j]))+f32(f32(source[i*4+1]*inverse[1][j])+f32(origin[j]*0))));
    matrix.push(0);
  }
  for(let j=0;j<3;j++)matrix.push(f32(f32(f32(world.translation[0]*inverse[0][j])+f32(world.translation[2]*inverse[2][j]))+f32(f32(world.translation[1]*inverse[1][j])+origin[j])));
  matrix.push(1);
  return {matrix,particleScale:sourceSfxSignedScale(matrix)};
}

export function createSourceSfxPolyTransformBindings({getController,extraScaleEnabled,getGroupTransform}){
  required(getController,'getController');required(extraScaleEnabled,'extraScaleEnabled');
  return {
    refreshFrameTransform(node,actionMode){
      if(actionMode===1){node.particleFrameTransform=identity();return;}
      if(actionMode===0){
        const group=required(getGroupTransform,'getGroupTransform')(node);
        node.particleFrameTransform=group?copy(valid(group)):identity();return;
      }
      if(actionMode!==2)throw new RangeError('Unresolved particle action mode');
      const controller=getController(node);
      if(controller)node.particleFrameTransform=copy(valid(controller.world));
      // Native action2 with no controller leaves the previous transform.
    },
    prepareSpawnTransform(node){
      if(node.actionMode===2)return {matrix:sourceSfxTransformMatrix(identity()),particleScale:[1,1,1]};
      if(node.actionMode===0)return sourceSfxGroupRelativeSpawn(getController(node)?.world,required(getGroupTransform,'getGroupTransform')(node));
      if(node.actionMode!==1)throw new RangeError('Unresolved particle action mode');
      const controller=getController(node),world=valid(controller?.world);
      const matrix=sourceSfxTransformMatrix(world);
      const resolved=extraScaleEnabled(node)
        ?sourceSfxExtraScaleMatrix(matrix,controller.externalScale):matrix;
      return {matrix:resolved,particleScale:world.scale.map(f32)};
    },
    motionScaleLength(node){
      if(node.actionMode!==1)return 1;
      const controller=getController(node),scale=valid(controller?.world).scale;
      const length=v=>f32(Math.sqrt(f32(f32(f32(v[0]*v[0])+f32(v[1]*v[1]))+f32(v[2]*v[2]))));
      const own=length(scale);
      if(!extraScaleEnabled(node))return own;
      if(!Array.isArray(controller.externalScale)||controller.externalScale.length!==3)throw new TypeError('Source externalScale required');
      return f32(own*length(controller.externalScale));
    },
  };
}
