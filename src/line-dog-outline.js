import {BackSide,NormalBlending,LessEqualDepth} from 'three';

// The two original outline programs are intentionally distinct. In particular,
// line_dog03 never samples albedo alpha; line_dog02 uses local (not world) center.
export function configureLineDogOutline(m,p,maps,noisy){
 const n=k=>Number(p[k]),f=x=>Number(x).toFixed(8),s=k=>f(n(k));
 const vec=k=>JSON.parse(p[k]),gl=k=>`vec3(${vec(k).slice(0,3).map(f).join(',')})`;
 const width=n('Line_Width'),uniforms={dogOutlineBase:{value:maps.Tex0},dogOutlineNoise:{value:maps.Line}};
 m.map=null;m.normalMap=null;m.emissive.set(0);m.color.set(0);m.side=BackSide;
 m.transparent=true;m.depthWrite=false;m.depthTest=true;m.depthFunc=LessEqualDepth;m.blending=NormalBlending;m.alphaTest=0;
 if(width!==0)m.defines={...m.defines,USE_COLOR:''};
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const varying='varying vec2 dogOutlineUv;varying vec3 dogOutlineView,dogOutlineNormal,dogOutlineTrick;\n';
  shader.vertexShader=varying+shader.vertexShader
   .replace('#include <uv_vertex>','#include <uv_vertex>\ndogOutlineUv=uv;')
   // objectNormal is already skinned here: apply its offset after position skinning.
   .replace('#include <skinning_vertex>',`#include <skinning_vertex>\n${width!==0?`transformed+=objectNormal*${f(width)}*${noisy?'mix(.4,1.0,color.r)':'color.r'};`:''}`)
   .replace('#include <normal_vertex>',`#include <normal_vertex>\ndogOutlineNormal=normalize(transformedNormal);\n#ifdef FLIP_SIDED\ndogOutlineNormal=-dogOutlineNormal;\n#endif`)
   .replace('#include <project_vertex>',`#include <project_vertex>\ndogOutlineView=-mvPosition.xyz;
    ${noisy?`vec3 dogCenter=${gl('Center')}+${gl('CenterOF')};
    dogOutlineTrick=mat3(modelViewMatrix)*(transformed-dogCenter);`:'dogOutlineTrick=vec3(0);'}`);
  shader.fragmentShader=varying+'uniform sampler2D dogOutlineBase,dogOutlineNoise;\n'+shader.fragmentShader;
  const fragment=noisy?`
   vec3 dogTrick=normalize(dogOutlineTrick);
   float dogU=atan(dogTrick.x,dogTrick.y)/6.28+.5;
   float dogV=clamp(dot(-normalize(dogOutlineNormal),normalize(dogOutlineView)),0.0,1.0);
   float dogAlpha=texture2D(dogOutlineBase,dogOutlineUv).a*texture2D(dogOutlineNoise,vec2(dogU*${s('Line_Tiling_U')}+${s('Line_Offset_U')},dogV*${s('Line_Tiling_V')}+${s('Line_Offset_V')})).r;
   diffuseColor=vec4(0,0,0,dogAlpha*opacity);totalEmissiveRadiance=${gl('OutlineColor')};
  `:'diffuseColor=vec4(0,0,0,opacity);totalEmissiveRadiance=vec3(0);';
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',fragment)
   .replace('#include <color_fragment>','').replace('#include <emissivemap_fragment>','')
   .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
 };
 return uniforms;
}
