import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// standard_pudding keeps the second, flattened normal after deriving its two Matcap lookups.
export async function configurePudding(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normalOn=scalar(macros.NORMAL_MAP_ENABLE,1),tiling=macros.ENABLE_TILING===true||macros.ENABLE_TILING==='TRUE'?1:scalar(macros.ENABLE_TILING,0);
  if(![0,1,2].includes(q)||![0,1].includes(normalOn)||tiling!==0)throw Error(tiling?'ENABLE_TILING requires unverified uv_scale input':'Unknown source macro');
  if(normalOn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const intensity=vector(p.Intensity,[1,1,0,0]),mask0=vector(p.MaskColor0,[.192157,.26275,.0549,1]),mask1=vector(p.MaskColor1,[.52549,.6392,.1137,1]),mask2=vector(p.MaskColor2,[1,1,1,1]),rim=vector(p.RimColor,[.77255,.77255,.77255,1]);
  const lightness=scalar(p.Lightness,.5),reflection=scalar(p.Reflection,1),repeat=scalar(p.RepeatScale,1),main=scalar(p.MainMaskPow,.7),sub=scalar(p.SubMaskPow,1.3);
  const [cap,normal]=await Promise.all([load('Tex0',false),load('Tex1',false)]);
  if(!cap?.isTexture||cap.isCubeTexture||!normal?.isTexture||normal.isCubeTexture)throw Error('Missing original Tex0 or Tex1');
  const u={neoPuddingCap:{value:cap},neoPuddingNormal:{value:normal}};setup(m,normalOn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   s.fragmentShader=`uniform sampler2D neoPuddingCap,neoPuddingNormal;
    vec3 neoPuddingLinear(vec3 value){return ${q===2?'value*value':'pow(max(value,vec3(0.0)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 neoPuddingN=texture2D(neoPuddingNormal,t107Uv*${f(repeat)});vec3 neoPuddingSample=neoPuddingN.xyz*2.0-1.0;neoPuddingSample.xy*=${f(intensity[0])};
    mat3 neoPuddingTbn=${normalOn?'mat3(t107T,t107B,t107N)':'mat3(1.0)'};vec3 neoPuddingBump=neoPuddingTbn*normalize(neoPuddingSample);
    vec3 neoPuddingView=normalize(vViewPosition),neoPuddingTangent=normalize(cross(neoPuddingView,vec3(0.0,1.0,0.0))),neoPuddingBinormal=normalize(cross(neoPuddingView,neoPuddingTangent));
    vec2 neoPuddingUv=vec2(dot(neoPuddingBump,neoPuddingTangent),dot(neoPuddingBump,neoPuddingBinormal))*0.5+0.5;
    neoPuddingSample.xy=vec2(0.0);vec3 neoPuddingFlat=neoPuddingTbn*normalize(neoPuddingSample);
    vec2 neoPuddingFlatUv=vec2(dot(neoPuddingFlat,neoPuddingTangent),dot(neoPuddingFlat,neoPuddingBinormal))*0.5+0.5;
    vec4 neoPuddingBase=texture2D(neoPuddingCap,neoPuddingFlatUv),neoPuddingHighlight=texture2D(neoPuddingCap,neoPuddingUv);
    float neoPuddingMask=pow(neoPuddingBase.b,${f(main)})*pow(neoPuddingBase.r,${f(sub)});
    vec3 neoPuddingBelow=neoPuddingLinear(mix(${rgb(mask0)},${rgb(mask1)},neoPuddingMask));
    vec3 neoPuddingLight=neoPuddingLinear(neoPuddingHighlight.aaa*${rgb(mask2)}),neoPuddingReflect=neoPuddingLinear(neoPuddingHighlight.ggg*${rgb(rim)});
    diffuseColor=vec4(neoPuddingBelow+neoPuddingLight*${f(lightness)}+neoPuddingReflect*${f(reflection)},opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(neoPuddingFlat*vec3(-1.0,1.0,1.0));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${f(intensity[1])};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${f(intensity[2])};`)
    .replace('#include <aomap_fragment>','')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=vec3(0.0);');
  };
  warnings.push('standard_pudding original Matcap and flattened output normal are connected; source non-standard lighting and half precision remain uncalibrated');
  return u;
 }catch(error){warnings.push('standard_pudding remains unsupported: '+error.message);return null;}
}
