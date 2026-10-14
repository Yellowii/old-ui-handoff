import {configureColorVariant} from './color-variants-material.js';
import {scalar,vector,f,rgb} from './t107-frame.js';
import {sourcePerlinGlsl} from './source-perlin.js';

// Ordinary model path only. T176 proves that SubmeshBoundsInfo comes from
// the GIM root, not the individual material slot.
export async function configureColorObjectVtxOffset(m,p,macros,load,warnings,o={}){
  try{
    const q=scalar(macros.RENDER_QUALITY,0),bounds=o.sourceBounds;
    if(q<2&&(!bounds?.center||!bounds.half||bounds.center.length!==3||bounds.half.length!==3||
      [...bounds.center,...bounds.half].some(v=>!Number.isFinite(v))||bounds.half[1]<=0))throw Error('Original GIM root bounds required');
    const offset=vector(p.OffsetParam,[1,1,1,1]),pivot=vector(p.FoliagePivotPosition,[0,0,0]),power=scalar(p.OffsetPow,1);
    if(q<2&&power<0)throw Error('Undefined negative offset power at zero weight');
    const fragmentMacros={...macros};
    for(const [macro,param] of [['ENABLE_FOLIAGE_INTERACT','EnableInteract'],['ENABLE_FOLIAGE_GLOBAL_WIND','EnableGlobalWind']]){
      const enabled=scalar(macros[macro],1),active=scalar(p[param],0);
      if(![0,1].includes(enabled)||![0,1].includes(active)||enabled&&active)throw Error('Active source foliage input unresolved: '+param);
      delete fragmentMacros[macro];
    }
    const result=await configureColorVariant(m,p,fragmentMacros,load,warnings,o,'color-object-vtxoffset');
    if(!result)return null;
    if(q<2){
      const previous=m.onBeforeCompile,h=bounds.half,c=bounds.center;
      m.onBeforeCompile=s=>{
        previous(s);
        s.vertexShader='uniform float neoTime;\n'+sourcePerlinGlsl+'\n'+s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>
          vec3 neoVtxLocal=transformed*vec3(-1.,1.,1.);
          float neoVtxWeight=abs((neoVtxLocal.y-(${f(c[1]-h[1])}))/${f(h[1]*2)});
          neoVtxWeight=pow(neoVtxWeight,${f(power)});
          vec3 neoVtxWorld=(modelMatrix*vec4(transformed,1.)).xyz*vec3(-1.,1.,1.);
          // Continuous preview seconds equal FrameTimeIndex*100+FrameTime.
          vec2 neoVtxNoiseUv=(neoVtxWorld.xz-${rgb(pivot)}.xz)*${f(offset[3])}+neoTime*vec2(${f(offset[0])},${f(offset[1])});
          float neoVtxNoise=neoPerlinNoise(neoVtxNoiseUv);
          transformed+=vec3(-1.,1.,1.)*(neoVtxNoise*neoVtxWeight*${f(offset[2])});`);
      };
    }
    warnings.push('standard_change_color_object_vtxoffset: source sequential color, emission and ordinary-model offset connected; foliage instances remain unsupported.');
    return result;
  }catch(error){warnings.push('standard_change_color_object_vtxoffset remains unsupported: '+error.message);return null;}
}
