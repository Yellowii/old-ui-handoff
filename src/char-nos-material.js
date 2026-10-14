const scalar=v=>Number(v).toFixed(8);
const vec=(v,f)=>{try{const a=typeof v==='string'?JSON.parse(v):v;if(a?.length===4&&a.every(Number.isFinite))return a;}catch{}return f;};
const rgb=v=>`vec3(${v.slice(0,3).map(scalar).join(',')})`;
const num=(v,f)=>Number.isFinite(Number(v))?Number(v):f;

// standard_char_nos: EmissiveValue controls the mix-map emission; Intensity.a
// controls only the rim. Keep those authored channels independent.
export async function configureCharNos(m,p,macros,load,warnings,overrides={}){
 const low=Number(macros.RENDER_QUALITY)===2,useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0&&Number(macros.LIGHT_ENABLE)!==0;
 const fail=message=>{warnings.push('char-nos unsupported: '+message);return null;};
 if(Number(macros.ENABLE_SOFT_BODY2)!==0)return fail('Original soft-body deformation not connected');
 if(useNormal&&overrides.sourceTangents!==true)return fail('Original tangent basis required');
 const base=vec(p.BaseColor,[1,1,1,1]),intensity=vec(p.Intensity,[1,1,1,0]),rim=vec(p.RimColor,[0,0,0,0]),emissive=vec(p.EmissiveColor,[1,1,1,1]);
 const textures=await Promise.all([load('Tex0',false,overrides.baseColor),useNormal?load('Tex1',false,overrides.normal):null,load('Tex2',false,overrides.mask)]);
 const builtin={green:'vec4(0.,1.,0.,1.)',normal:'vec4(.5,.5,1.,1.)',white:'vec4(1.)',black:'vec4(0.,0.,0.,1.)'};
 for(const i of useNormal?[0,1,2]:[0,2])if(!textures[i]&&!builtin[p['Tex'+i]])return fail('Original Tex'+i+' required');
 const sample=i=>textures[i]?`texture2D(neoNos${i},neoNosUv)`:builtin[p['Tex'+i]];
 const uniforms={neoNos0:{value:textures[0]},neoNos1:{value:textures[1]},neoNos2:{value:textures[2]},neoEmissionScale:{value:1}};
 m.color.set(0xffffff);m.map=textures[0];m.normalMap=null;m.aoMap=null;m.roughnessMap=null;m.metalnessMap=null;m.emissive.set(0xffffff);m.emissiveIntensity=1;
 if(useNormal)m.defines={...m.defines,USE_TANGENT:''};
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const varyings='varying vec2 neoNosUv;varying vec3 neoNosN,neoNosT,neoNosB;\n';
  shader.vertexShader=varyings+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoNosUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
   vec3 neoNosSourceNormal=transformedNormal;
   #ifdef FLIP_SIDED
   neoNosSourceNormal=-neoNosSourceNormal;
   #endif
   neoNosN=inverseTransformDirection(neoNosSourceNormal,viewMatrix)*vec3(-1.,1.,1.);
   neoNosT=${useNormal?'inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.,1.,1.)':'vec3(0.)'};
   neoNosB=${useNormal?'cross(neoNosN,neoNosT)*tangent.w':'vec3(0.)'};
  `);
  shader.fragmentShader=varyings+'uniform sampler2D neoNos0,neoNos1,neoNos2;uniform float neoEmissionScale;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec4 neoNosRaw=${sample(0)},neoNosMix=${sample(2)};
   vec3 neoNosAlbedo=${Number(macros.CHAR_CHANGE_COLOR)===1?'vec3(dot(neoNosRaw.rgb,vec3(.2125,.7154,.0721)))':'neoNosRaw.rgb'}*${rgb(base)};
   diffuseColor.rgb=${low?'neoNosAlbedo*neoNosAlbedo':'pow(max(neoNosAlbedo,vec3(0.)),vec3(2.2))'}*${scalar(num(p.TintValue,1))};
   diffuseColor.a=neoNosRaw.a*${scalar(base[3])}*opacity;
  `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(neoNosMix.g*${scalar(intensity[1])},0.,1.)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.':`clamp(neoNosMix.b*${scalar(intensity[2])},0.,1.)`};`)
   .replace('#include <normal_fragment_maps>',`
    vec3 neoNosSurfaceNormal=neoNosN;
    ${useNormal?`vec3 neoNosLocal=${sample(1)}.xyz*2.-1.;neoNosLocal.xy*=${scalar(intensity[0])};neoNosSurfaceNormal=mat3(neoNosT,neoNosB,neoNosN)*normalize(neoNosLocal);`:''}
    normal=normalize(mat3(viewMatrix)*(neoNosSurfaceNormal*vec3(-1.,1.,1.)));
   `).replace('#include <emissivemap_fragment>',`
    float neoNosNV=dot(neoNosSurfaceNormal,inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.));
    float neoNosF=1.-neoNosNV;neoNosF=clamp(${scalar(num(p.FresnelScale,0))}+(1.-${scalar(num(p.FresnelScale,0))})*neoNosF*neoNosF*neoNosF*neoNosF*neoNosF,0.,1.);
    totalEmissiveRadiance=(neoNosF*${rgb(rim)}*${scalar(intensity[3])}+neoNosMix.a*${rgb(emissive)}*${scalar(num(p.EmissiveValue,1))})*neoEmissionScale;
   `).replace('#include <aomap_fragment>',low?'':`
    reflectedLight.indirectDiffuse*=neoNosMix.r;
    #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),neoNosMix.r,material.roughness);
    #endif
   `);
 };
 return uniforms;
}
