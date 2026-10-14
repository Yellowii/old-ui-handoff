import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// standard_change_color_tiling_all.hlsl; original forward_shading supplies local
// position/normal after skinning and world matrix column lengths. No Scale9.
export async function configureTilingAll(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1),tiling=scalar(macros.ENABLE_TILING,0),ytiling=scalar(macros.ENABLE_YTILING,0),border=scalar(macros.ENABLE_BORDER,0);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ENABLE_TILING','ENABLE_YTILING','ENABLE_BORDER','ALPHA_TEST_ENABLE','TWO_SIDED','USE_LOCAL_PARAMATER']);
  if(![0,1,2].includes(q)||[normal,light,tiling,ytiling,border].some(x=>![0,1].includes(x))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented active source permutation');
  const normalOn=q<2&&normal===1&&light===1;if(normalOn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const C=[0,1,2,3].map(i=>vector(p['MaskColor'+i],[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,1,1]][i])),base=vector(p.BaseColor,[1,1,1,1]),I=vector(p.Intensity,[1,1,1,0]),E=vector(p.EmissiveColor,[0,0,0,0]);
  const repeat=scalar(p.RepeatScale,1),repeatY=scalar(p.RepeatScaleY,1),texture=vector(p.TexturePara,[1,1,0,0]),uv=vector(p.UVPara,[1,1,0,0]),angle=scalar(p.RotationAngle,0)*6.283/360,procedural=scalar(p.UVSampleKey,0),speed=[scalar(p.Speed_U,0),scalar(p.Speed_V,0)];
  const kr=scalar(p.UGCKey_R,1),km=scalar(p.UGCKey_M,1),alpha=scalar(p.Extra_Op,1),rim=vector(p.BorderColor,[0,0,0,1]),rimScale=scalar(p.BorderScale,.03),rimIntensity=scalar(p.BorderIntensity,3);
  const textures=await Promise.all(['Tex0','Tex1','Tex2'].map(k=>load(k,false)));if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active 2D texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};textures.forEach((t,i)=>u['taTex'+i]={value:t});setup(m,normalOn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   const vary='varying vec3 taLocalPos,taLocalNormal,taScale;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <skinnormal_vertex>','#include <skinnormal_vertex>\ntaLocalNormal=objectNormal;')
    .replace('#include <skinning_vertex>','#include <skinning_vertex>\ntaLocalPos=transformed;taScale=vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));');
   s.fragmentShader=vary+`uniform sampler2D taTex0,taTex1,taTex2;uniform float neoTime,neoEmissionScale;
    vec3 taLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec3 taAxis=abs(taLocalNormal),taPos=${tiling?'taScale*((taLocalPos/2.64)*.5+.5)':'taLocalPos'};float taMax=max(max(taAxis.x,taAxis.y),taAxis.z);
    vec2 taUv=taPos.yz;taUv.x=taMax==taAxis.y?taPos.x:taPos.y;taUv.y=taMax==taAxis.z?taPos.x:taPos.z;taUv.x=taMax==taAxis.z?taPos.y:taUv.x;
    ${ytiling?`taUv=vec2(t107Uv.x*${f(repeat)},t107Uv.y*${tiling?'taScale.y*':''}${f(repeatY)});`:`taUv*=vec2(${f(repeat)},${f(repeat*repeatY)});`}
    taUv=(taUv-.5)*vec2(${f(texture[0])},${f(texture[1])});
    taUv=vec2(taUv.x*${f(Math.cos(angle))}-taUv.y*${f(Math.sin(angle))},taUv.y*${f(Math.cos(angle))}+taUv.x*${f(Math.sin(angle))});
    taUv+=vec2(${f(.5+texture[2])},${f(.5+texture[3])});
    ${procedural?`taUv=t107Uv*vec2(${f(uv[0])},${f(uv[1])})+vec2(${f(uv[2])},${f(uv[3])})+neoTime*vec2(${f(speed[0])},${f(speed[1])});`:''}
    vec4 taMask=texture2D(taTex0,taUv),taNS=texture2D(taTex1,taUv),taOrm=texture2D(taTex2,taUv);
    vec3 taColor=${C.map((c,i)=>`taMask.${'rgba'[i]}*${rgb(c)}`).join('+')};vec3 taAlbedo=taLinear(taColor*${rgb(base)}),taN=t107N;
    ${normalOn?`vec3 taSample=taNS.xyz*2.-1.;taSample.xy*=${f(I[0])};taN=mat3(t107T,t107B,t107N)*normalize(taSample);`:''}
    float taRoughness=${q===2?'.5':`mix(${f(I[1])},clamp(taOrm.g*${f(I[1])},0.,1.),${f(kr)})`},taMetalness=${q===2?'0.':`mix(${f(I[2])},clamp(taOrm.b*${f(I[2])},0.,1.),${f(km)})`},taAo=${q===2?'1.':'taOrm.r'};
    vec3 taEmission=taLinear(taOrm.a*${rgb(E)})*${f(I[3])};
    ${border?`vec3 taView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);float taF=1.-dot(taN,taView);taEmission+=clamp(${f(rimScale)}+(1.-${f(rimScale)})*pow(taF,5.),0.,1.)*${rgb(rim)}*${f(rimIntensity)};`:''}
    diffuseColor=vec4(taAlbedo,${f(alpha)}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(taN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=taRoughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=taMetalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=taEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=taAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),taAo,material.roughness);
     #endif`);
  };
  warnings.push('tiling_all: original planar/Y projection and mask channels connected; source scene and native precision remain uncalibrated');return u;
 }catch(e){warnings.push('tiling_all unsupported: '+e.message);return null;}
}
