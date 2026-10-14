import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// shader/surf/s31/slzs_cloth.hlsl. The source uses UV1 for the cloth flow and
// star layers, COLOR0.r as the wind mask, and the authored tangent basis for
// the normal map. We keep those inputs explicit so models without UV1 remain
// in the backlog instead of silently sampling UV0.
export async function configureSlzsCloth(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),uv1=scalar(macros.TEXCOORD1_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||uv1!==1)throw Error('Unknown source macro');
  if(q<2&&normal&&!o.sourceTangents)throw Error('Missing original tangent basis');
  if(q<2&&!o.sourceSecondUv)throw Error('Missing original second UV');
  if(q<2&&!o.sourceVertexColors)throw Error('Missing original vertex color');
  const n=(k,d)=>f(scalar(p[k],d)),v=(k,d)=>vector(p[k],d),col=(k,d=[1,1,1,1])=>rgb(v(k,d));
  const intensity=v('Intensity',[1,.5,0,0]),flowT=v('FlowTiling',[1,1]);
  const maps=await Promise.all(['Tex0','Tex1','Tex3','Tex4'].map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0/Tex1/Tex3/Tex4');
  const u={neoTime:{value:0}};maps.forEach((t,i)=>u['neoSlzsTex'+[0,1,3,4][i]]={value:t});
  setup(m,q<2&&normal);m.vertexColors=q<2;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal);
   s.vertexShader='attribute vec2 uv1;varying vec2 neoSlzsUv1;varying float neoSlzsColor;uniform float neoTime;\n'+s.vertexShader
    .replace('#include <uv_vertex>',`#include <uv_vertex>\nneoSlzsUv1=uv1;neoSlzsColor=${q<2?'color.r':'1.'};`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
    ${q<2?`float neoSlzsT=uv1.y*20.-neoTime*${n('WindSwingSpeed',3.5)};float neoSlzsPhase=dot(transformed*6.,vec3(17.3,5.1,31.7));float neoSlzsTurb=sin(neoSlzsT*.7+neoSlzsPhase*.03)*.4+sin(neoSlzsT*1.9+neoSlzsPhase*.07)*.35+sin(neoSlzsT*3.3+neoSlzsPhase*.13)*.25;float neoSlzsNoise=clamp(.5+.5*sin(length(transformed.xz)*3.+neoTime*1.6),0.,1.);transformed+=vec3(neoSlzsTurb*${n('WindSwingTurbulence',0)}*.125,sin(neoSlzsT)*${n('WindSwingStrength',0)}*neoSlzsNoise,0.)*color.r;`:''}`);
   s.fragmentShader='varying vec2 neoSlzsUv1;varying float neoSlzsColor;uniform sampler2D neoSlzsTex0,neoSlzsTex1,neoSlzsTex3,neoSlzsTex4;uniform float neoTime;\n'+s.fragmentShader;
   const normalCode=q<2&&normal?`vec3 neoSlzsSample=texture2D(neoSlzsTex1,t107Uv).xyz*2.-1.;neoSlzsSample.xy*=${f(intensity[0])};neoSlzsN=mat3(t107T,t107B,t107N)*normalize(neoSlzsSample);`:'neoSlzsN=t107N;';
   const body=`vec4 neoSlzsBase=texture2D(neoSlzsTex0,t107Uv);neoSlzsBase.rgb=pow(max(neoSlzsBase.rgb,vec3(0.)),vec3(2.2));
    vec3 neoSlzsN=t107N;${normalCode}
    vec3 neoSlzsV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec2 neoSlzsNoiseUv=neoSlzsUv1*2.+neoTime*vec2(0.,-.25);float neoSlzsNoise=texture2D(neoSlzsTex3,neoSlzsNoiseUv).r;
    vec2 neoSlzsFlowUv=neoSlzsUv1*vec2(${f(flowT[0])},${f(flowT[1])})+neoTime*vec2(0.,-.06*${n('FlowSpeed',1)})-neoSlzsV.xy*.1+neoSlzsNoise*.1*${n('FlowNoiseStr',0)};
    float neoSlzsFlow=texture2D(neoSlzsTex3,neoSlzsFlowUv).a;
    vec2 neoSlzsStarUv=neoSlzsUv1*${n('StarsTiling',1)};float neoSlzsStars=texture2D(neoSlzsTex3,neoSlzsStarUv-neoSlzsV.xy*.15).b*texture2D(neoSlzsTex3,neoSlzsStarUv*1.2+neoTime*vec2(0.,-.04)).b;
    vec2 neoSlzsCapUv=(mat3(viewMatrix)*neoSlzsN).xy*.5+.5;neoSlzsCapUv.y=1.-neoSlzsCapUv.y;vec3 neoSlzsCap=pow(max(texture2D(neoSlzsTex4,neoSlzsCapUv).rgb,vec3(0.)),vec3(2.2));
    diffuseColor=vec4(neoSlzsBase.rgb*${n('TintValue',1)},neoSlzsBase.a*opacity);
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(neoSlzsN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'.5':f(intensity[1])};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':f(intensity[2])};`)
    .replace('#include <emissivemap_fragment>',`float neoSlzsF=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*pow(1.-dot(neoSlzsN,neoSlzsV),5.),0.,1.);vec3 neoSlzsEm=neoSlzsF*${col('RimColor',[0,0,0,1])}*${f(intensity[3])}+neoSlzsBase.a*${col('EmissiveColor',[0,0,0,1])}*${n('EmissiveValue',0)}+pow(neoSlzsFlow,3.)*${col('FlowColor',[0,0,0,1])}*${n('FlowColStr',0)}+${col('StarsColor',[0,0,0,1])}*${n('StarsColStr',0)}*neoSlzsStars*200.+neoSlzsCap*${n('MatcapStr',0)};totalEmissiveRadiance=neoSlzsEm;`)
    .replace('#include <aomap_fragment>','');
  };
  warnings.push('slzs_cloth 源 Tex0/Tex1/cloth_noise/13、UV1 流动星点、原切线法线、顶点色风摆遮罩与 MatCap 已接入；完整源场景光照/风摆精度仍按预览环境');return u;
 }catch(e){warnings.push('slzs_cloth remains unsupported: '+e.message);return null;}
}
