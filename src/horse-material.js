import {sourceSpecular} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl} from './source-scene-light.js';

// Original 2026_carrier body/hair programs. No replacement textures or UVs.
export async function configureHorse(m,p,macros,load,o,warnings,family){
 try{
  const hair=family==='hair',q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),litNormal=q<2&&normal===1;
  const light=scalar(macros.LIGHT_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(light))throw Error('Unknown horse permutation');
  const allowed=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','VERTEX_COLOR_ENABLE','TEXCOORD1_ENABLE']);
  if(Object.entries(macros).some(([k,v])=>!allowed.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented horse macro');
  if(litNormal&&!o.sourceTangents)throw Error('Original tangent basis required');
  if(hair&&!o.sourceSecondUv)throw Error('Original second UV required');
  if(!hair&&!o.sourceVertexColors)throw Error('Original vertex color required');
  const num=(k,d)=>f(scalar(p[k],d)),col=k=>rgb(vector(p[k],[1,1,1,1]));
  const keys=q===2?['Tex0']:hair?['Tex0','Tex1','Tex3']:['Tex0','Tex2','Tex3','Tex4'];
  const textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original horse texture');
  const u=Object.fromEntries(keys.map((k,i)=>['hr'+k,{value:textures[i]}]));u.neoTime={value:0};u.neoEmissionScale={value:1};
  setup(m,litNormal);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,litNormal);
   const vary='varying vec3 hrLocal,hrCenterView;varying vec2 hrUv1;varying float hrColor;\n';
   s.vertexShader=vary+(hair?'attribute vec2 uv1;\n':'attribute vec3 color;\n')+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`hrLocal=transformed*vec3(-1.,1.,1.);hrCenterView=mat3(viewMatrix)*mat3(modelMatrix)*transformed;hrUv1=${hair?'uv1':'uv'};hrColor=${hair?'1.':'color.r'};\n#include <project_vertex>`);
   s.fragmentShader=vary+`uniform float neoTime,neoEmissionScale;${keys.map(k=>'uniform sampler2D hr'+k+';').join('')}
    vec3 hrLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
    float hrRandom(vec2 st){return fract(sin(dot(st,vec2(12.,78.)))*43758.);}
    float hrNoise(vec2 st){vec2 i=floor(st),v=fract(st),u=v*v*(3.-2.*v);float a=hrRandom(i),b=hrRandom(i+vec2(1.,0.)),c=hrRandom(i+vec2(0.,1.)),d=hrRandom(i+vec2(1.));return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}
   `+s.fragmentShader;
   const body=`
    vec4 hr0=texture2D(hrTex0,t107Uv);hr0.rgb=hrLinear(hr0.rgb);
    vec3 hrAlbedo=vec3(0.),hrEmission=hr0.rgb,hrN=t107N;float hrAlpha=1.;
    ${q<2?`
     vec3 hrNormal=${litNormal?'mat3(t107T,t107B,t107N)*normalize(texture2D(hrTex4,t107Uv*3.).xyz*2.-1.)':'t107N'};
     vec3 hr3=hrLinear(texture2D(hrTex3,t107Uv*1.8+neoTime*vec2(-.3,0.)).rgb);
     float hr3a=texture2D(hrTex3,t107Uv*vec2(.8,1.5)*2.+neoTime*vec2(-.1,.1)).a;hr3*=hr3a;
     vec4 hr2=texture2D(hrTex2,t107Uv+vec2(hr3a*.01*${num('raodongOff',1)}));
     float hr2b=texture2D(hrTex2,t107Uv).b,hr4a=texture2D(hrTex4,t107Uv*3.+neoTime*vec2(-.03,.03)).a;
     float hrNoiseMask=smoothstep(.2,1.,clamp(hrNoise(hrLocal.zy*4.+neoTime*3.),0.,1.));
     float hrFlow=hr4a*200.*hrNoiseMask*${num('bodystrflowOff',1)};
     float hrFr=mix(${num('FrbodyAst',.6)},${num('FrbodyBst',1)},clamp(clamp(dot(hrV,t107N)-.3,0.,1.)*1.5,0.,1.));
     vec3 hrBase=mix(hr0.rgb*hrFr,hr0.rgb*.65+hr3,hr2.g);
     // HLSL assigns float3 to float: only the first component survives.
     float hrMao=clamp(1.-dot(hrV,hrNormal)-.2,0.,1.)*${num('maost',1)}*hr0.r;
     vec3 hrMaoOut=mix(vec3(hrMao*hrFlow+hrMao),hrBase*${num('facest',1)},clamp(hrColor,0.,1.));
     hrEmission=hrBase+hr2.r*clamp(cos(t107Uv.x*20.+neoTime*2.),0.,1.)*${col('EmissiveColor')}*50.+vec3(hr2.r*.5)+${col('FootColor')}*hr2b*10.+hrMaoOut+hr0.a*${col('EmissiveColor')}*1.6;
     hrAlpha=hr2.a;
    `:''}`;
   const hairs=`
    vec4 hr0=texture2D(hrTex0,mix(hrUv1,t107Uv,${num('SecondUV',0)}));
    vec3 hrAlbedo=${q<2?'vec3('+num('gray',0)+')':'hr0.rgb'},hrEmission=vec3(0.),hrN=t107N;float hrAlpha=hr0.a;
    ${q<2?`
     float hrAnis=0.;
     ${litNormal?`hrN=mat3(t107T,t107B,t107N)*normalize(texture2D(hrTex1,t107Uv).xyz*2.-1.);float hrTH=dot(cross(hrN,t107T),normalize(-${sourceSceneSunGlsl()}+hrV));float hrPow=150.*1.4427+1.4427;hrAnis=.8*clamp(exp2((1.-hrTH*hrTH)*hrPow-hrPow)*.5,0.,1.);`:''}
     hr0.rgb=hrLinear(hr0.rgb)*.6;
     float hr1a=texture2D(hrTex1,hrUv1*vec2(1.5,1.)*2.5+neoTime*vec2(-.09,-.12)).a;
     float hrR=texture2D(hrTex3,t107Uv*5.+neoTime*vec2(0.,-.08)).r;
     float hrG=texture2D(hrTex3,hrCenterView.xy*.6+neoTime*vec2(-.05,.05)).g;
     float hrEdge=texture2D(hrTex3,t107Uv).a*hr1a*50.;
     vec3 hrStar=hrR*300.*hrG*clamp((1.-t107Uv.y-.4)*2.,0.,1.)*${col('EmissiveColor')};
     vec3 hrFr=clamp(clamp(1.-dot(hrV,t107N)-.3,0.,1.)*6.,0.,1.)*hr0.rgb;
     vec3 hrFrB=clamp(dot(hrV,hrN)-.8,0.,1.)*hr0.rgb*2.;
     hrEmission=hr0.rgb+hr1a*.3*${col('FlowColor')}*clamp((1.-t107Uv.y-.1)*3.,0.,1.)+hrFrB+vec3(hrAnis+hrEdge)+hrStar+hrFr;
    `:''}`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec3 hrV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);${hair?hairs:body}\ndiffuseColor=vec4(hrAlbedo,hrAlpha*opacity);`)
    .replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(hrN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=hrEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>','')
    .replace('#include <lights_physical_fragment>',sourceSpecular(hair?'0.':'1.',hair?'0.':null));
   sourceIsotropy(s,{quality:q,smoothDiffuse:true,light:light===1,standardMaterial:true});
  };
  return u;
 }catch(e){warnings.push('Horse '+family+' remains unsupported: '+e.message);return null;}
}
