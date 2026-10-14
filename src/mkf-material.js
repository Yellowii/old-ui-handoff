import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';
// Original standard_common_mkf; raw Matcap sampling also runs at quality 2.
export async function configureMkf(m,p,macros,load,warnings,o={}){
 try{
 const {q,normal:normalOn,change,light}=flags(macros,o),low=q===2;
 const base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]),emission=vector(p.EmissiveColor,[0,0,0,0]);
 const tint=scalar(p.TintValue,1),reflect=scalar(p.reflectMult,1);
 const maps=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
 if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0-Tex4');
 const u={neoEmissionScale:{value:1}};maps.forEach((t,i)=>u['mkfTex'+i]={value:t});setup(m,normalOn);
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,u);frame(m,s,normalOn);
  s.fragmentShader='uniform sampler2D mkfTex0,mkfTex1,mkfTex2,mkfTex3,mkfTex4;uniform float neoEmissionScale;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   vec4 mkfBase=texture2D(mkfTex0,t107Uv),mkfNormal=texture2D(mkfTex1,t107Uv),mkfM=texture2D(mkfTex2,t107Uv),mkfMask=texture2D(mkfTex3,t107Uv);
   vec3 mkfSurface=t107N;
   ${normalOn?`vec3 mkfSample=mkfNormal.xyz*2.-1.;mkfSample.xy*=${f(intensity[0])};mkfSurface=mat3(t107T,t107B,t107N)*normalize(mkfSample);`:''}
   vec3 mkfView=normalize(vViewPosition),mkfNv=mat3(viewMatrix)*(mkfSurface*vec3(-1.,1.,1.));
   vec3 mkfT=normalize(cross(mkfView,vec3(0,1,0))),mkfB=normalize(cross(mkfView,mkfT));
   vec2 mkfUv=vec2(dot(mkfNv,mkfT),dot(mkfNv,mkfB))*.5+.5;
   vec3 mkfCap=texture2D(mkfTex4,mkfUv).rgb;
   vec3 mkfColor=mix(mkfBase.rgb,mix(mkfCap,mkfBase.rgb,.5)*${f(reflect)}*mkfBase.rgb,mkfMask.r);
   ${change?'mkfColor=vec3(dot(mkfBase.rgb,vec3(.2125,.7154,.0721)));':''}
   diffuseColor=vec4(pow(max(mkfColor*${rgb(base)},vec3(0)),vec3(${low?'2.0':'2.2'}))*${f(tint)},mkfBase.a*${f(base[3])}*opacity);
  `).replace('#include <color_fragment>','')
  .replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(${!low&&normalOn&&light?'mkfSurface':'t107N'}*vec3(-1.,1.,1.)));`)
  .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(mkfM.g*${f(intensity[1])},0.,1.)`};`)
  .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(mkfM.b*${f(intensity[2])},0.,1.)`};`)
  .replace('#include <emissivemap_fragment>',`totalEmissiveRadiance=mkfM.a*${rgb(emission)}*${f(intensity[3]*tint)}*neoEmissionScale;`)
  .replace('#include <aomap_fragment>',low?'':`reflectedLight.indirectDiffuse*=mkfM.r;
  #if defined(USE_ENVMAP) && defined(STANDARD)
  reflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),mkfM.r,material.roughness);
  #endif`);
 };
 return u;
 }catch(e){warnings.push('standard_common_mkf: '+e.message);return null;}
}
