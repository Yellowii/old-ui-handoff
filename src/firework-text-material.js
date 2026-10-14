import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// APK standard_common_firework.hlsl: source font edge and two moving dot layers.
export async function configureFireworkText(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active firework permutation');
  const on=q<2&&normal===1;
  if(on&&!o.sourceTangents)throw Error('Original tangent basis required for dot parallax');
  const ratio=scalar(p.EdgeRatio,100),min=scalar(p.EdgeSSMin,0),max=scalar(p.EdgeSSMax,1);
  if(ratio===0||min>=max)throw Error('Undefined edge ratio/smoothstep');
  if(q<2&&[scalar(p.DotPow,1),scalar(p.DotPow2,1)].some(v=>v<=0))throw Error('Unverified dot exponent boundary');
  const num=(k,d)=>f(scalar(p[k],d)),col=k=>rgb(vector(p[k],[1,1,1,1]));
  const keys=['FontTex',...(q<2?['PatternTex']:[])],textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active 2D texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['fw'+k]={value:textures[i]});setup(m,on);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,on);
   s.fragmentShader='uniform sampler2D fwFontTex,fwPatternTex;uniform float neoTime,neoEmissionScale;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    float fwFont=texture2D(fwFontTex,t107Uv).r;
    float fwOffset=${num('EdgeUVOffset',1)}/${f(ratio)};
    vec4 fwNeighbours=vec4(texture2D(fwFontTex,t107Uv+vec2(fwOffset,0.)).r,texture2D(fwFontTex,t107Uv-vec2(fwOffset,0.)).r,texture2D(fwFontTex,t107Uv+vec2(0.,fwOffset)).r,texture2D(fwFontTex,t107Uv-vec2(0.,fwOffset)).r);
    float fwEdge=smoothstep(${f(min)},${f(max)},dot(abs(fwNeighbours-vec4(fwFont)),vec4(.25)));
    vec3 fwEmission=${col('BGEmisColor')}*(${num('BGEmisStrength',0)}+fwEdge*${num('EdgeStrength',0)});
    vec2 fwUv1=vec2(0.),fwUv2=vec2(0.);float fwDots=0.;
    ${q<2?`vec3 fwView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 fwTangentView=${on?'transpose(mat3(t107T,t107B,t107N))*fwView':'fwView'};
    fwUv1=t107Uv*vec2(${num('Dot1Tiling',1)},${num('Dot1Tiling2',1)});
    fwUv2=t107Uv*vec2(${num('Dot2Tiling',1)},${num('Dot2Tiling2',1)})-${num('Dot2ViewOffset',0)}*fwTangentView.xy+neoTime*vec2(${num('Dot2SpeedX',0)},${num('Dot2SpeedY',0)});
    vec2 fwDot1=texture2D(fwPatternTex,fwUv1).rg,fwDot2=texture2D(fwPatternTex,fwUv2).rg;
    fwDots=pow(fwDot1.r*fwDot2.r,${num('DotPow',1)})*${num('DotStrength',1)}+pow(fwDot1.g*fwDot2.g,${num('DotPow2',1)})*${num('DotStrength2',1)};
    fwEmission+=${col('DotColor')}*fwDots;`:''}
    diffuseColor=vec4(0.,0.,0.,fwFont*${num('BGAlpha',1)}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=fwEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>','');
  };return u;
 }catch(e){warnings.push('FireworkText remains unsupported: '+e.message);return null;}
}
