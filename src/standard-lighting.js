import {scalar,vector,f} from './t107-frame.js';
import {sourceSpecular,sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
import {standardCommonEmission,standardCharacterEmission} from './standard-emission.js';
import {standardColor} from './standard-color.js';

// Original standard_char/common color, direct-light inputs and quality switches.
// Source SH, artist trick and full scene binding remain separate.
export function configureStandardLighting(m,p,macros,mix,char,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  if(![0,1,2].includes(q)||[normal,light].some(x=>![0,1].includes(x)))throw Error('Unknown standard lighting permutation');
  if(['USE_SKIN_LUT','USE_ANISOTROPIC_SPECULAR','USE_SPECULAR_COLOR','LIGHT_MAP_ENABLE'].some(k=>scalar(macros[k],0)!==0))throw Error('Alternate source lighting branch not connected');
  if(!m.map?.isTexture||m.map.isCubeTexture)throw Error('Original standard Tex0 required');
  if(q<2&&normal&&(!m.normalMap?.isTexture||m.normalMap.isCubeTexture))throw Error('Original standard Tex1 required');
  if((q<2||!char)&&(!mix?.isTexture||mix.isCubeTexture))throw Error('Original standard Tex2 required');
  const I=vector(p.Intensity,[1,1,1,0]),ur=scalar(p.UGCKey_R,1),um=scalar(p.UGCKey_M,1);
  const emission=char?standardCharacterEmission(p,q,o.sourceLightingProfile):standardCommonEmission(p,macros,q,m.alphaTest>0);
  const color=standardColor(p,macros,q,char);
  m.normalScale.setScalar(I[0]);
  if(q===2||!normal)m.normalMap=null;
  if(q===2){m.roughnessMap=null;m.metalnessMap=null;}
  const compile=m.onBeforeCompile;
  m.onBeforeCompile=s=>{
   compile(s);
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',color);
   if(emission){
    s.fragmentShader='uniform float neoEmissionScale;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',emission);
   }
   const sample=q===2?'vec4(1.,1.,0.,0.)':'texture2D(neoMix,vAoMapUv)';
   s.fragmentShader=s.fragmentShader
    .replace('#include <roughnessmap_fragment>',`vec4 neoStdMix=${sample};float roughnessFactor=${!char&&q===2?'.5':`mix(${f(I[1])},clamp(neoStdMix.g*${f(I[1])},0.,1.),${f(ur)})`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${!char&&q===2?'0.':`mix(${f(I[2])},clamp(neoStdMix.b*${f(I[2])},0.,1.),${f(um)})`};`)
    .replace('#include <lights_physical_fragment>',sourceSpecular('.5',sourceGrazing));
   if(q===2)s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>','');
   sourceIsotropy(s,{quality:q,smoothDiffuse:char,light:light===1,standardMaterial:!char});
  };
  return true;
 }catch(e){warnings.push('Standard source lighting remains unsupported: '+e.message);return false;}
}
