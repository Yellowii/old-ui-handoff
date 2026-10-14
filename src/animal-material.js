import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl} from './source-scene-light.js';

// Current PPK animal_fur/cat_eye: source material channels, not fur simulation.
export async function configureAnimal(m,p,macros,load,warnings,o={},fur=false){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),uv=fur?scalar(p.UVKey,0):0;
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED',...(fur?['TEXCOORD1_ENABLE','VERTEX_COLOR_ENABLE']:[])]);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active animal permutation');
  const on=q<2&&normal===1;
  if(on&&!o.sourceTangents)throw Error('Original tangents required');
  if(uv!==0&&(!o.sourceSecondUv||scalar(macros.TEXCOORD1_ENABLE,1)!==1))throw Error('Original second UV required');
  const num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d));
  const keys=fur?['Tex0','Tex2',...(on?['Tex1']:[])]:['Tex0','Tex1',...(on?['Tex2']:[])];
  const maps=await Promise.all(keys.map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active 2D texture');
  const u={neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['an'+k]={value:maps[i]});setup(m,on);
  if(uv!==0)m.defines={...m.defines,USE_UV1:''};
  const mp=vector(p.MaterialParams,[1,1,1,1]),an=vector(p.AnisoParams,[.8,32,1,0]),tr=vector(p.TransmissionParams,[1,2.5,0,0]),vol=vector(p.VolumeShadowParams,[2,.2,.5,0]);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,on);
   if(uv!==0){s.vertexShader='varying vec2 anUv1;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nanUv1=uv1;');s.fragmentShader='varying vec2 anUv1;\n'+s.fragmentShader;}
   s.fragmentShader=`uniform sampler2D anTex0,anTex1,anTex2;uniform float neoEmissionScale;vec3 anLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}\n`+s.fragmentShader;
   const view='vec3 anV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);';
   const code=fur?`
    vec2 anUv=${uv!==0?`mix(t107Uv,anUv1,${f(uv)})`:'t107Uv'};
    vec4 anBase=texture2D(anTex0,anUv);float anAlpha=texture2D(anTex0,t107Uv).a;
    vec3 anColor=pow(max(anLinear(anBase.rgb),vec3(.0001)),vec3(${num('BaseMapPow',1)})),anMra=texture2D(anTex2,t107Uv).rgb;
    vec3 anBlend=mix(anColor,anColor*${col('blendColor')},anMra.g);
    vec3 anRoot=mix(anBlend*${col('rootcolorB')},anBlend*${col('rootcolorA')}*${num('rootcolorAIntensity',1)},anMra.r);
    anColor=mix(anColor,anRoot,${num('rootcolorkey',0)});
    ${view}vec3 anN=t107N,anSpec=vec3(0.),anEmission=anColor;float anShadow=1.;
    ${on?`vec3 anTn=texture2D(anTex1,t107Uv).xyz*2.-1.;anTn.xy*=${f(mp[0])};anN=mat3(t107T,t107B,t107N)*normalize(anTn);
    float anNoise=texture2D(anTex2,t107Uv*vec2(.1,1.)).b;
    vec3 anLight=-${sourceSceneSunGlsl()},anDir=mix(t107T,t107B,${f(an[2])}),anHalf=normalize(anV+anLight);
    float anTh=dot(anDir,anHalf)+(anNoise*2.-1.)*.1;
    float anTerm=pow(max(sqrt(clamp(1.-anTh*anTh,0.,1.)),.0001),${f(an[1])})*${f(an[0])}*clamp(dot(anN,anLight),0.,1.);
    anSpec=anLinear(${col('AnisoColor',[1,.95,.85,1])})*anTerm;`:''}
    ${q<2?`float anNl=dot(t107N,-${sourceSceneSunGlsl()});float anLit=clamp(max(clamp(anNl*.5+.5,0.,1.)-.5,0.)*2.,0.,1.);
    anShadow=mix(${f(vol[2])},1.,anLit);anColor*=anShadow;
    float anFrShadow=mix(1.,.2,anLit),anRim=clamp(max(clamp(1.-dot(t107N,anV),0.,1.)-.55,0.)*1.5,0.,1.);
    float anTrick=mix(1.,.5,clamp((anNl-.1)*2.,0.,1.))*anRim;
    anEmission=anColor+${col('TransmissionColor',[1,.7,.4,1])}*anColor*${f(tr[0])}*anFrShadow*anTrick;`:''}
    anEmission+=anSpec;diffuseColor=vec4(0.,0.,0.,anAlpha*opacity);
   `:`
    vec4 anBase=texture2D(anTex0,t107Uv);vec3 anColor=anLinear(anBase.rgb)*${num('TintValue',1)};
    vec3 anN=normalize(t107N);${view}
    ${on?`vec3 anTn=texture2D(anTex2,t107Uv*${num('NormalTiling',1)}).xyz*2.-1.;anTn.xy*=${num('NormalIntensity',1)};anN=normalize(mat3(t107T,t107B,t107N)*normalize(anTn));`:''}
    float anMask=clamp(pow(max(clamp(dot(anV,anN)*.5+.5,0.,1.)-${num('StarCenterThreshold',.98)},0.),.3)*2.,0.,1.);
    vec3 anCenter=anMask*texture2D(anTex1,t107Uv*${num('StarCenterUVTiling',2.5)}).g*${col('StarColor')}*${num('StarCenterIntensity',200)}*anBase.a;
    vec3 anEmission=anCenter+anColor+texture2D(anTex1,t107Uv).a*anColor*${num('StarColorIntensity',30)};
    diffuseColor=vec4(anColor,opacity);
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',code).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(${fur?'t107N':'anN'}*vec3(-1.,1.,1.)));`)
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=anEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>','');
   // animal_fur is explicitly unlit; its source AO therefore has no lit channel.
   if(fur)s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };return u;
 }catch(e){warnings.push((fur?'AnimalFur':'CatEye')+' remains unsupported: '+e.message);return null;}
}
