import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';
// char_laser differs from char_laser01; its lookup always uses the source basis.
export async function configureCharLaserSource(m,p,macros,load,warnings,o={}){
 try{
 const {q,normal:normalOn,change,light}=flags(macros,o),low=q===2;
 const base=vector(p.BaseColor,[1,1,1,1]),blend=vector(p.BlendColor,[1,1,1,1]),rim=vector(p.RimColor,[0,0,0,0]),intensity=vector(p.Intensity,[1,1,1,0]);
 const tint=scalar(p.TintValue,1),mask=scalar(p.MaskAmount,0),tiling=scalar(p.TilingAmount,1),fresnel=scalar(p.FresnelScale,0);
 const maps=await Promise.all([0,1,2,3].map(i=>load('Tex'+i,false)));
 if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0-Tex3');
 const u={neoEmissionScale:{value:1}};maps.forEach((t,i)=>u['clTex'+i]={value:t});setup(m,normalOn);
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,u);frame(m,s,normalOn);
  s.fragmentShader=`uniform sampler2D clTex0,clTex1,clTex2,clTex3;uniform float neoEmissionScale;
  vec3 clLinear(vec3 v){return ${low?'v*v':'pow(max(v,vec3(0)),vec3(2.2))'};}
  `+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   vec3 clV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
   mat3 clFrame=${normalOn?'mat3(t107T,t107B,t107N)':'mat3(1.0)'};
   vec3 clSample=texture2D(clTex2,t107Uv*1.2).xyz*2.-1.;clSample.xy*=3.;vec3 clLaser=clFrame*normalize(clSample);
   float clDot=dot(clV,clLaser);
   vec3 clMask=clamp(cos(clDot)*vec3(0,0,1),0.,1.)+clamp(sin(clDot)*vec3(-1,1,0),0.,1.);
   clMask=mix(clMask,vec3(1),${f(mask)});
   float clGray=clamp(dot(clMask,vec3(.2125,.7154,.114)),0.,1.);
   vec3 clDiffuse=texture2D(clTex0,vec2(clGray)*${f(tiling)}).rgb;
   clDiffuse=mix(vec3(dot(clDiffuse,vec3(.2125,.7154,.0721))),clDiffuse,1.5);
   clDiffuse=clLinear(mix(clDiffuse*1.3,${rgb(blend)},clGray));
   vec4 clLogo=texture2D(clTex3,t107Uv);clDiffuse=mix(clDiffuse,clLinear(clLogo.rgb),clLogo.a);
   ${change?`clDiffuse=clLinear(vec3(dot(clDiffuse,vec3(.2125,.7154,.0721)))*${rgb(base)});`:''}
   diffuseColor=vec4(clDiffuse*${f(tint)},opacity);
   vec3 clSurface=t107N;
   ${!low&&normalOn&&light?`vec3 clN=texture2D(clTex1,t107Uv).xyz*2.-1.;clN.xy*=${f(intensity[0])};clSurface=clFrame*normalize(clN);`:''}
  `).replace('#include <color_fragment>','')
  .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(clSurface*vec3(-1.,1.,1.)));')
  .replace('#include <roughnessmap_fragment>','float roughnessFactor=0.0;')
  .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.0;')
  .replace('#include <aomap_fragment>','')
  .replace('#include <emissivemap_fragment>',`float clF=clamp(${f(fresnel)}+(1.-${f(fresnel)})*pow(1.-dot(clSurface,clV),5.),0.,1.);totalEmissiveRadiance=clF*${rgb(rim)}*${f(intensity[3])}*neoEmissionScale;`);
 };
 return u;
 }catch(e){warnings.push('char_laser: '+e.message);return null;}
}
