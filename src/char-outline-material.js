import * as THREE from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// char_outline_drawing.surf has two source draw calls.  The base pass uses
// Tex0/Tex1/Tex2 and the second pass expands the back face and samples Tex4.
// The source vertex stage initializes CommonVertex.diffuse to (1,1,1,1) when
// IA_VERTEX_COLOR is inactive, so missing COLOR_0 is not a blocker for this
// surface (the outline alpha is therefore the documented default of one).
export async function configureCharOutline(m,p,macros,load,warnings,o={}){
  try{
    const outline=o.charOutlinePass===true;
    const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0);
    if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(change))throw Error('Unknown char-outline permutation');
    const normalOn=!outline&&normal===1&&o.sourceTangents===true;
    const tex={};
    for(const k of ['Tex0','Tex1','Tex2','Tex3','Tex4']){
      const t=await load(k,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+k);tex[k]=t;
    }
    const col=vector(p.OutlineColor,[1,1,1,1]),base=vector(p.BaseColor,[1,1,1,1]);
    const I=vector(p.Intensity,[1,1,1,0]);
    const u={neoTime:{value:0},neoEmissionScale:{value:1},coTex0:{value:tex.Tex0},coTex1:{value:tex.Tex1},coTex2:{value:tex.Tex2},coTex3:{value:tex.Tex3},coTex4:{value:tex.Tex4},coBaseColor:{value:new THREE.Vector4(...base)},coOutlineColor:{value:new THREE.Vector4(...col)},coWidth:{value:scalar(p.OutlineWidth,0)},coPoints:{value:scalar(p.PointsTiling,9)},coNoise:{value:scalar(p.NoiseScale,.5)},coEmissive:{value:scalar(p.EmissiveValue,1)},coTint:{value:scalar(p.TintValue,1)},coMetalWeight:{value:scalar(p.MetalnessPBRWeight,.5)},coIntensity:{value:new THREE.Vector4(...I)}};
    if(outline){
      setup(m,false);m.side=THREE.BackSide;m.transparent=true;m.depthWrite=false;m.blending=THREE.NormalBlending;m.alphaTest=0;
      m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);frame(m,s,false);s.vertexShader='uniform float coWidth;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += objectNormal * coWidth * 0.01;');s.fragmentShader='uniform sampler2D coTex1,coTex3,coTex4;uniform vec4 coOutlineColor;uniform float neoTime,neoEmissionScale,coPoints;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec4 coMask=texture2D(coTex1,t107Uv);vec4 coLine=texture2D(coTex4,t107Uv);float coNoise=texture2D(coTex3,t107Uv*max(coPoints,1.)*.25+neoTime*.05).r;float coAlpha=coMask.a*coLine.a*mix(.75,1.,coNoise);if(coMask.a<.5)discard;diffuseColor=vec4(pow(max(coLine.rgb,vec3(0.)),vec3(2.2))*coOutlineColor.rgb,coAlpha*opacity);`).replace('#include <color_fragment>','').replace('#include <emissivemap_fragment>','totalEmissiveRadiance=coOutlineColor.rgb*neoEmissionScale;');};
      m.userData.fidelity='source-channels-preview';m.userData.fidelityGaps=['原描边双层噪声与屏幕空间淡出按当前五图近似'];m.userData.uniforms=u;m.userData.charOutlinePass=true;return u;
    }
    setup(m,normalOn);m.userData.uniforms=u;
    m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);frame(m,s,normalOn);s.fragmentShader='uniform sampler2D coTex0,coTex1,coTex2,coTex3;uniform vec4 coBaseColor,coIntensity;uniform float neoTime,neoEmissionScale,coTint,coEmissive,coMetalWeight;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec4 co0=texture2D(coTex0,t107Uv);vec4 co2=texture2D(coTex2,t107Uv);co0.rgb=pow(max(co0.rgb,vec3(0.)),vec3(2.2));${change?'co0.rgb=vec3(dot(co0.rgb,vec3(.2125,.7154,.0721)))*pow(max(coBaseColor.rgb,vec3(0.)),vec3(2.2));':''}co0.rgb*=coTint;diffuseColor=vec4(co0.rgb,co0.a*opacity);`).replace('#include <normal_fragment_maps>',normalOn?'normal=normalize(mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.)));':'').replace('#include <roughnessmap_fragment>','float roughnessFactor=clamp(co2.g*coIntensity.y,0.,1.);').replace('#include <metalnessmap_fragment>','float metalnessFactor=co2.b*coMetalWeight;').replace('#include <emissivemap_fragment>','totalEmissiveRadiance=co0.rgb*co2.a*coEmissive*neoEmissionScale;');};
    m.userData.fidelity='source-channels-preview';m.userData.fidelityGaps=['原 SmoothDiffuse、屏幕空间点状明暗与场景 SH 未完全等价',...(normal&&!normalOn?['源切线未发布，法线贴图退回几何法线']:[])];
    warnings.push('char_outline_drawing：源五图基础/描边双遍已接入；原屏幕空间噪声淡出保留近似');return u;
  }catch(e){warnings.push('char_outline_drawing remains unsupported: '+e.message);return null;}
}
