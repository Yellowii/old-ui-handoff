import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// APK standard_common_normalblend.hlsl and material_function_zzy.hlsl.
// The source flattens encoded samples toward (0,0,1), then blends before
// decoding to signed normals. Do not substitute the usual decoded RNM formula.
export async function configureNormalBlend(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE']);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||light!==1||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented active source permutation');
  const normalOn=q<2&&normal===1;
  if(normalOn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const base=vector(p.BaseColor,[1,1,1,1]),I=vector(p.Intensity,[1,1,1,0]),E=vector(p.EmissiveColor,[0,0,0,0]);
  const tint=scalar(p.TintValue,1),kr=scalar(p.UGCKey_R,1),km=scalar(p.UGCKey_M,1);
  const flatten=[scalar(p.BaseNormalFlatten,0),scalar(p.AddNormalFlatten,0)],tiling=[scalar(p.BaseNormalTiling,1),scalar(p.AddNormalTiling,1)];
  const textures=await Promise.all(['Tex0','Tex1','Tex2','Tex3'].map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0-Tex3 2D textures');
  const u={neoEmissionScale:{value:1}};textures.forEach((t,i)=>u['nbTex'+i]={value:t});setup(m,normalOn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   s.fragmentShader=`uniform sampler2D nbTex0,nbTex1,nbTex2,nbTex3;uniform float neoEmissionScale;\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 nbD=texture2D(nbTex0,t107Uv),nbOrm=texture2D(nbTex2,t107Uv);
    vec3 nbN=t107N;
    ${normalOn?`
    vec3 nbBase=mix(texture2D(nbTex1,t107Uv*${f(tiling[0])}).xyz,vec3(0.,0.,1.),${f(flatten[0])});
    vec3 nbAdd=mix(texture2D(nbTex3,t107Uv*${f(tiling[1])}).xyz,vec3(0.,0.,1.),${f(flatten[1])});
    nbAdd.xy=vec2(1.)-nbAdd.xy;
    vec3 nbV1=vec3(nbBase.xy,nbBase.z+1.),nbV2=vec3(nbAdd.xy-vec2(1.),nbAdd.z);
    vec3 nbSample=(dot(nbV1,nbV2)*nbV1-nbV2*(nbBase.z+1.))*2.-1.;
    nbSample.xy*=${f(I[0])};nbN=mat3(t107T,t107B,t107N)*normalize(nbSample);
    `:''}
    vec3 nbAlbedo=${q===2?`(nbD.rgb*${rgb(base)})*(nbD.rgb*${rgb(base)})`:`pow(max(nbD.rgb*${rgb(base)},vec3(0.)),vec3(2.2))`}*${f(tint)};
    float nbRoughness=${q===2?'.5':`mix(${f(I[1])},clamp(nbOrm.g*${f(I[1])},0.,1.),${f(kr)})`};
    float nbMetalness=${q===2?'0.':`mix(${f(I[2])},clamp(nbOrm.b*${f(I[2])},0.,1.),${f(km)})`};
    vec3 nbEmission=nbOrm.a*${rgb(E)}*${f(I[3]*tint)};
    float nbAo=${q===2?'1.':'nbOrm.r'};
    diffuseColor=vec4(nbAlbedo,nbD.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(nbN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=nbRoughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=nbMetalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=nbEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=nbAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),nbAo,material.roughness);
     #endif`);
  };
  warnings.push('normalblend: source dual-normal channels connected; original scene lighting and half precision remain uncalibrated');
  return u;
 }catch(e){warnings.push('normalblend remains unsupported: '+e.message);return null;}
}
