import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// APK standard_common_uvflow.hlsl (source-shaders/uvflow-t346/source.json).
// PannerUV adds velocity * FrameTime. Both components intentionally use SpeedX;
// Repeat.xy belongs exclusively to the separate ENABLE_SCALE_9 branch.
export async function configureUvFlow(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(light)||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented active source permutation');
  const normalOn=q<2&&normal===1&&light===1;
  if(normalOn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const base=vector(p.BaseColor,[1,1,1,1]),I=vector(p.Intensity,[1,1,1,0]),E=vector(p.EmissiveColor,[0,0,0,1]),repeat=vector(p.Repeat,[1,1,1,1]);
  const speed=scalar(p.SpeedX,1),albedoIntensity=scalar(p.AlbedoIntensity,0),kr=scalar(p.UGCKey_R,1),km=scalar(p.UGCKey_M,1);
  const keys=['Tex0',...(normalOn?['Tex1']:[]),...(q<2?['Tex2']:[])];
  const textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active 2D texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['uf'+k]={value:textures[i]});setup(m,normalOn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   s.fragmentShader=`uniform sampler2D ufTex0,ufTex1,ufTex2;uniform float neoTime,neoEmissionScale;\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 ufUv=t107Uv+vec2(${f(repeat[2]*speed)},${f(repeat[3]*speed)})*neoTime;
    vec4 ufD=texture2D(ufTex0,ufUv),ufOrm=${q<2?'texture2D(ufTex2,ufUv)':'vec4(0.)'};
    ufD.rgb=${q===2?'ufD.rgb*ufD.rgb':'pow(max(ufD.rgb,vec3(0.)),vec3(2.2))'};
    vec3 ufN=t107N;
    ${normalOn?`vec3 ufSample=texture2D(ufTex1,ufUv).xyz*2.-1.;ufSample.xy*=${f(I[0])};ufN=mat3(t107T,t107B,t107N)*normalize(ufSample);`:''}
    vec3 ufAlbedo=ufD.rgb*${rgb(base)};
    float ufRoughness=${q===2?'.5':`mix(${f(I[1])},clamp(ufOrm.g*${f(I[1])},0.,1.),${f(kr)})`};
    float ufMetalness=${q===2?'0.':`mix(${f(I[2])},clamp(ufOrm.b*${f(I[2])},0.,1.),${f(km)})`};
    vec3 ufEmission=${rgb(E)}*(ufOrm.a*${f(I[3])})+${f(albedoIntensity)}*ufD.rgb;
    float ufAo=${q===2?'1.':'ufOrm.r'};
    diffuseColor=vec4(ufAlbedo,ufD.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(ufN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=ufRoughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=ufMetalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=ufEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=ufAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),ufAo,material.roughness);
     #endif`);
  };
  warnings.push('uvflow: source FrameTime and channels connected; original scene lighting and half precision remain uncalibrated');
  return u;
 }catch(e){warnings.push('uvflow remains unsupported: '+e.message);return null;}
}
