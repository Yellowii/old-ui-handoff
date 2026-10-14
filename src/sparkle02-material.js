import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';

// Source char_sparkle02.hlsl, default DrawCalls="lit". Tex3 is sampled by the
// source but does not contribute to this pass. No invented coat/highlight pass.
export async function configureSparkle02(m,p,macros,load,warnings,o={}){
 try{
  let intensity=[1,1,1,0];
  if(p.Intensity!==undefined){
   const v=typeof p.Intensity==='string'?JSON.parse(p.Intensity):p.Intensity;
   if(!Array.isArray(v)||![3,4].includes(v.length)||!v.every(Number.isFinite))throw Error('Intensity requires finite float3 or float4');
   // Native T117: a short float3 assignment is an atomic no-op.
   if(v.length===4)intensity=v;
  }
  const parameter=vector(p.Parameter,[1,1,1,1]),base=vector(p.BaseColor,[1,1,1,1]),rim=vector(p.RimColor,[1,1,1,1]);
  const {q,normal,change,light}=flags(macros,o),normalOn=q!==2&&normal===1&&light===1;
  const tint=scalar(p.TintValue,1),fresnel=scalar(p.FresnelScale,0);
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(x=>x!==0))throw Error('Active soft body is unresolved');
  if(scalar(o.sourcePass,0)!==0)throw Error('Only the default lit draw call is implemented');
  const u={};
  for(const key of ['Tex0','Tex1','Tex2','Tex3']){const t=await load(key,false,key==='Tex0'?o.baseColor:undefined);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+key);u['sp'+key]={value:t};}
  setup(m,normalOn);m.roughness=q===2?1:intensity[1];m.metalness=q===2?0:intensity[2];
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   s.fragmentShader='uniform sampler2D spTex0,spTex1,spTex2;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 spBase=texture2D(spTex0,t107Uv),spNoise=texture2D(spTex2,t107Uv*${f(parameter[3])});
    vec3 spBlend=mix(spBase.rgb,spNoise.rgb,${f(parameter[2])}*spNoise.a);
    vec3 spAlbedo=${q===2?'spBlend*spBlend':'pow(max(spBlend,vec3(0.)),vec3(2.2))'};
    ${change?`float spLum=dot(spBase.rgb,vec3(.2125,.7154,.0721));vec3 spTint=spLum*${rgb(base)};
    diffuseColor=vec4(${q===2?'spTint*spTint':'pow(max(spTint,vec3(0.)),vec3(2.2))'}*${f(tint)},opacity);`:`diffuseColor=vec4(spAlbedo*${f(tint)},opacity);`}
    vec3 spN=t107N;
    ${normalOn?`vec3 spSample=texture2D(spTex1,t107Uv*${f(parameter[3])}).xyz*2.-1.;spSample.xy*=${f(intensity[0])};spN=mat3(t107T,t107B,t107N)*normalize(spSample);`:''}
    vec3 spV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float spX=1.-dot(t107N,spV),spX2=spX*spX;
    float spF=clamp(${f(fresnel)}+(1.-${f(fresnel)})*spX2*spX2*spX,0.,1.);
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(spN*vec3(-1.,1.,1.)));')
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'1.':`mix(${f(intensity[1])},${f(parameter[0])},spNoise.a)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':`mix(${f(intensity[2])},${f(parameter[1])},spNoise.a)`};`)
   .replace('#include <emissivemap_fragment>',`
    totalEmissiveRadiance=${rgb(rim)}*${f(intensity[3])}*spF;
    ${normal?`#if NUM_DIR_LIGHTS > 0
     vec3 spH=normalize(directionalLights[0].direction+normalize(vViewPosition));
     float spHighlight=pow(clamp(dot(normal,spH),0.,1.),20.);
     totalEmissiveRadiance+=spHighlight*spAlbedo*directionalLights[0].color*.5;
    #endif`:''}
   `);
  };
  warnings.push('Sparkle02默认lit原混色/法线/粗糙度/金属度/边缘光已接入；太阳使用当前场景主方向光，原场景对照未验。');return u;
 }catch(e){warnings.push('sparkle02 remains unsupported: '+e.message);return null;}
}
