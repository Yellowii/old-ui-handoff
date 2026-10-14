import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Original 2025_anniversary/fire_wing.hlsl; T130 resolves the IA color default.
const noiseGlsl=`
float fwRandom(vec2 st){return fract(sin(dot(st,vec2(12.,78.)))*43758.);}
float fwNoise(vec2 st){vec2 i=floor(st),v=fract(st),u=v*v*(3.-2.*v);
 float a=fwRandom(i),b=fwRandom(i+vec2(1.,0.)),c=fwRandom(i+vec2(0.,1.)),d=fwRandom(i+vec2(1.));
 return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}
`;
export async function configureFireWing(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),detail=q<2,normal=scalar(macros.NORMAL_MAP_ENABLE,1),ia=scalar(macros.IA_VERTEX_COLOR,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(ia))throw Error('Unknown source macro');
  if(detail&&normal&&!o.sourceTangents)throw Error('Missing original tangent');
  if(detail&&!o.sourceSecondUv)throw Error('Missing original UV1');
  if(detail&&ia&&!o.sourceVertexColors)throw Error('Missing original COLOR0');
  const num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d));
  const intensity=vector(p.Intensity,[1,1,0,0]);
  const maps=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0-Tex4');
  const u={neoTime:{value:0}};maps.forEach((t,i)=>u['fwTex'+i]={value:t});setup(m,detail&&normal);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,detail&&normal);
   if(detail){
    // COLOR0 only masks displacement; it must not tint the fragment a second time.
    s.vertexShader=`attribute vec2 uv1;${ia?'attribute vec3 color;':''}varying vec2 fwUv1;uniform float neoTime;${noiseGlsl}\n`+s.vertexShader
     .replace('#include <uv_vertex>','#include <uv_vertex>\nfwUv1=uv1;')
     .replace('#include <skinning_vertex>',`#include <skinning_vertex>
      float fwTime=neoTime*3.*${num('PositionOffsetSpeed',1)};
      float fwOffsetNoise=fwNoise(uv1*5.+fwTime*vec2(0.,-1.))-.5;
      transformed.xy+=(fwOffsetNoise*vec2(.05,.03)+sin(uv1.x*30.+fwTime*2.)*vec2(.02,.01))*${ia?'color.r':'1.'}*${num('PositionOffsetScale',1)};`);
    s.fragmentShader='varying vec2 fwUv1;\n'+s.fragmentShader;
   }
   s.fragmentShader=`uniform sampler2D fwTex0,fwTex1,fwTex2,fwTex3,fwTex4;uniform float neoTime;
    vec3 fwLinear(vec3 c){return ${detail?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    ${detail?noiseGlsl:''}\n`+s.fragmentShader;
   let body=`vec2 fwUv=t107Uv,fwBaseUv=fwUv;
    vec3 fwN=t107N,fwV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    mat3 fwTbn=${detail&&normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec4 fwMix=vec4(1.,1.,0.,0.),fwNormal=vec4(0.),fwFlow=vec4(0.);
    vec3 fwMatcap=vec3(0.);float fwStars=0.,fwFres=0.;
   `;
   if(detail)body+=`fwNormal=texture2D(fwTex1,fwUv);vec3 fwSample=fwNormal.xyz*2.-1.;fwSample.xy*=${f(intensity[0])};
    fwSample.z=pow(1.-fwSample.x*fwSample.x-fwSample.y*fwSample.y,.5);fwN=fwTbn*normalize(fwSample);
    fwMix=texture2D(fwTex2,fwUv);
    float fwNoiseMask=fwNoise(fwUv*8.+neoTime*vec2(0.,-1.125));
    fwBaseUv+=vec2(fwNoise(fwUv*100.-neoTime*3.)*.0035*fwNormal.b*${num('NoiseKey',1)});`;
   body+=`vec4 fwBase=texture2D(fwTex0,fwBaseUv);fwBase.rgb=fwLinear(fwBase.rgb);
    fwFres=pow(1.-clamp(dot(t107N,fwV),0.,1.),${num('FresnelPow',5)});
    vec3 fwAlbedoBase=fwBase.rgb;
   `;
   if(detail)body+=`vec2 fwCustomUv=mix(fwUv,fwUv1,${num('SecondUVKey',0)});
    fwFlow=texture2D(fwTex3,fwCustomUv*${num('StarUVTiling',1)}+neoTime*vec2(0.,.5*${num('StarSpeed',1)}));
    vec3 fwStarSample=fwFlow.xyz*2.-1.;fwStarSample.z=pow(1.-fwStarSample.x*fwStarSample.x-fwStarSample.y*fwStarSample.y,.5);
    vec3 fwStarN=fwTbn*normalize(vec3(fwStarSample.xy*9.,fwStarSample.z));
    float fwStarMask=pow(clamp(fwNoiseMask,0.,1.),3.)*5.;
    fwStars=clamp(-dot(fwStarN,fwV),0.,1.)*fwStarMask*(1.-fwBase.g)*fwNormal.a;
    fwFres*=fwStarMask;
    float fwFlowB=texture2D(fwTex3,fwCustomUv*vec2(3.5*${num('FlowTilingX',1)},3.5*${num('FlowTilingY',1)})+neoTime*vec2(0.,.5*${num('FlowLSpeed',1)})).b;
    fwFlow.b=fwFlowB*fwFlowB*texture2D(fwTex3,fwUv).a;
    vec2 fwMcUv=(mat3(viewMatrix)*fwN).xy*.5+.5;fwMcUv.y=-fwMcUv.y;
    fwMatcap=fwLinear(texture2D(fwTex4,fwMcUv).rgb)*fwBase.rgb*fwMix.r;
    fwAlbedoBase=mix(fwBase.rgb,mix(fwBase.rgb,vec3(1.),fwMatcap),fwMix.r);`;
   body+=`diffuseColor=vec4(fwAlbedoBase*${col('BaseColor')}*${num('TintValue',1)}*fwMix.r,fwBase.a*opacity);`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(fwN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(fwMix.g*${f(intensity[1])},0.,1.);`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=clamp(fwMix.b*${f(intensity[2])},0.,1.);`)
    .replace('#include <emissivemap_fragment>',`float fwNoV5=1.-dot(fwN,fwV);fwNoV5=fwNoV5*fwNoV5*fwNoV5*fwNoV5*fwNoV5;
     float fwRim=clamp(${num('FresnelScale',0)}+(1.-${num('FresnelScale',0)})*fwNoV5,0.,1.);
     totalEmissiveRadiance=fwRim*${col('RimColor',[0,0,0,0])}*${f(intensity[3])}
      +fwBase.rgb*${col('EmissiveColor')}*${num('EmissiveValue',0)}*fwMix.a
      +pow(fwBase.rgb,vec3(${num('BaseColorEmisPow',1)}))*${num('BaseColorEmis',0)}*(1.-fwMix.r)
      ${detail?`+fwFres*${col('FresnelColor')}*${num('FresnelStr',1)}+fwStars*${col('StarColor')}*${num('StarStr',1)}+fwFlow.b*${col('FlowColor')}*${num('FlowStr',1)}+fwMatcap`:''};`);
  };
  warnings.push('fire_wing original channels and post-skin vertex displacement; source noise precision and scene lighting remain preview');return u;
 }catch(e){warnings.push('fire_wing remains unsupported: '+e.message);return null;}
}
