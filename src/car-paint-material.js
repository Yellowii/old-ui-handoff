import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// standard_car_paint_mix.hlsl and its ENV_CUSTOM isotropy branch. Root bounds
// use the ordinary-model writer contract recorded in T176, including skinned cars.
export async function configureCarPaint(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),border=scalar(macros.ENABLE_BORDER,0),light=scalar(macros.LIGHT_ENABLE,1),high=q<2,on=high&&normal===1;
  if(![0,1,2].includes(q)||[normal,border,light].some(x=>![0,1].includes(x)))throw Error('Unknown car-paint permutation');
  const allowed=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','ENABLE_BORDER','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE','TEXCOORD1_ENABLE']);
  if(Object.entries(macros).some(([k,v])=>!allowed.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented active car-paint macro');
  if(on&&!o.sourceTangents)throw Error('Original tangent basis required');
  if(high&&!o.sourceSecondUv)throw Error('Original second UV required');
  const bounds=o.sourceBounds;
  if(!bounds?.center?.every(Number.isFinite)||!bounds?.half?.every(Number.isFinite)||bounds.half[2]<=0)throw Error('Original root bounds required');
  const n=(k,d)=>f(scalar(p[k],d)),c=(k,d=[1,1,1,1])=>rgb(vector(p[k],d)),I=vector(p.CarIntensity,[1,1,1,0]);
  if(scalar(p.StreamStep,.1)>=.8||scalar(p.BreathStep,.3)>=1)throw Error('Nonpositive source smoothstep interval unresolved');
  const keys=high?['Tex0','Tex1','Tex2','Tex3','MaskTex']:['Tex0'],u={neoTime:{value:0},neoEmissionScale:{value:1}};
  for(const k of keys){const t=await load(k,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing original 2D '+k);u['cp'+k]={value:t};}
  for(const k of high?['ReflectionCube',...(light?['ReflectionProbeCustom']:[])]:[]){const t=await load(k,false);if(!t?.isCubeTexture)throw Error('Original cube required: '+k);u['cp'+k]={value:t};}
  setup(m,on);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,on);
   const vary='varying vec3 cpLocal;'+(high?'attribute vec2 uv1;varying vec2 cpUv1;':'');
   s.vertexShader=vary+'\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n'+(high?'cpUv1=uv1;':''))
    .replace('#include <project_vertex>','cpLocal=transformed*vec3(-1.,1.,1.);\n#include <project_vertex>');
   s.fragmentShader=`varying vec3 cpLocal;${high?'varying vec2 cpUv1;':''}
    uniform float neoTime,neoEmissionScale;${keys.map(k=>'uniform sampler2D cp'+k+';').join('')}
    uniform samplerCube cpReflectionCube,cpReflectionProbeCustom;
    vec3 cpLinear(vec3 v){return ${high?'pow(v,vec3(2.2))':'v*v'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 cp0=texture2D(cpTex0,t107Uv);cp0.rgb=cpLinear(cp0.rgb);
    vec4 cp1=vec4(.5,.5,1.,1.),cp2=vec4(1.,.5,0.,0.),cpMask=vec4(0.);
    vec3 cpDetail=vec3(0.),cpN=t107N,cpReflection=vec3(0.);
    vec3 cpV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float cpTime=0.,cpStream=0.,cpFresnel=0.,cpNdV=1.-clamp(dot(cpV,cpN),0.,1.);
    ${high?`
     cp1=texture2D(cpTex1,t107Uv);cp2=texture2D(cpTex2,t107Uv);cpMask=texture2D(cpMaskTex,t107Uv);
     cpTime=neoTime*ceil(fract(cpUv1.x)*3.);
     cpStream=smoothstep(${n('StreamStep',.1)},.8,1.-abs(fract(cpUv1.y*.5-cpTime*${n('StreamSpeed',1)})*2.-1.));
     float cpLine=1.-abs(fract(cpUv1.y-cpTime*${n('StreamSpeed',1)}*.5)*2.-1.);
     cp0.rgb=mix(cp0.rgb,${c('LineColor')},cpMask.r*cpLine);
     mat3 cpTbn=${on?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
     vec3 cpCamera=normalize(transpose(cpTbn)*cpV);vec2 cpOffset=cpCamera.xy/max(cpCamera.z,.001);
     vec4 cp3=texture2D(cpTex3,t107Uv*${n('DeitalTiling',20)}-cpOffset*.2*cp0.a);
     cp0.rgb+=cp3.z*(1.-clamp(cp0.a+1.-cp1.a,0.,1.))*${n('CarbonCol',0)};
     cpDetail=mix(vec3(cp3.zw,1.),vec3(cp3.xy,1.),cp0.a);
     vec3 cpT=cp1.xyz*vec3(2.)+vec3(-1.,-1.,0.),cpU=cpDetail*vec3(-2.,-2.,2.)+vec3(1.,1.,-1.);
     cpT.xy*=${f(I[0])};float cpViewDot=clamp(dot(cpV,t107N),0.,1.);
     cpU.xy*=mix(${n('CarbonIntensity',1)},${n('DetailIntensity',.05)},cp0.a)*cpViewDot*cpViewDot;
     cpN=cpTbn*normalize(mix(cpT,cpT*dot(cpT,cpU)-cpU*cpT.z,cp1.a));
     vec3 cpBaseNormal=cpTbn*normalize(cpT);cpNdV=1.-clamp(dot(cpV,cpBaseNormal),0.,1.);
     cpReflection=cpLinear(textureLod(cpReflectionCube,reflect(-cpV,cpBaseNormal),cpNdV*${n('ReflectMipMax',1)}).rgb)*cp0.a*${n('ReflectStrenth',.3)}*${c('ReflectColor')};
     cpFresnel=cpNdV*cpNdV*cpNdV*cpNdV*cpNdV;
    `:''}
    float cpGradient=smoothstep(.1,.6,abs((cpLocal.z-(${f(bounds.center[2]-bounds.half[2])}))/${f(bounds.half[2]*2)}));
    cp0.rgb*=mix(vec3(1.),mix(${c('LerpColor2')},${c('LerpColor1')},cpGradient),cp0.a);
    cp0.rgb=mix(cp0.rgb,${c('RimColor',[0,0,0,1])},smoothstep(.4,.8,cpNdV)*cp0.a);
    vec3 cpBorder=vec3(0.);
    ${border?`float cpNoV=clamp(1.-dot(cpN,cpV),0.,1.),cpFc=cpNoV*cpNoV*cpNoV*cpNoV*cpNoV;
     cpBorder=${c('BorderColor',[1,.8,.3,1])}*clamp(${n('BorderScale',.03)}+cpFc*(1.-${n('BorderScale',.03)}),0.,1.)*${n('BorderIntensity',3)};`:''}
    vec3 cpAlbedo=cp0.rgb+cpReflection*(1.-cpFresnel)*.3,cpEmission=cpBorder;
    ${high?`
     float cpBreathX=abs(fract(cpTime*${n('BreathSpeed',1)})*2.-1.);
     float cpBreath=smoothstep(${n('BreathStep',.3)},1.,1.-cpBreathX*cpBreathX);
     cpEmission+=cp0.rgb*cp2.a*${f(I[3])}*min(cpDetail.x,cpDetail.y)
      +cpReflection*cp2.r*mix(.04,1.,cpFresnel)
      +cpMask.g*cp0.rgb*cpBreath*${n('BreathIntensity',1)}
      +cpStream*${c('StreamColor')}*(cpMask.r*${n('StreamIntensity1',1)}+cpMask.b*${n('StreamIntensity2',1)})
      +cp0.rgb*cp2.b*${n('MaterialEmis',.2)}*(1.-cp0.a);
    `:''}
    float cpRough=${high?`mix(cp2.g,${f(I[1])},cp0.a)`:'.5'},cpMetal=${high?`mix(cp2.b,${f(I[2])},cp0.a)`:'0.'},cpAo=${high?'cp2.r':'1.'};
    vec3 cpMaterialN=${on?'cpN':'t107N'},cpSpecular=mix(vec3(.5),${c('SpecularColor')},cp0.a)*${n('SpecularIntensity',1)};
    // Source ENV_CUSTOM is sampled in source coordinates at authored roughness*6;
    // no PMREM regeneration or sRGB conversion is applied to this second cube.
    float cpA=cpRough*cpRough;
    vec3 cpEnvDir=mix(cpMaterialN,reflect(-cpV,cpMaterialN),(1.-cpA)*(sqrt(1.-cpA)+cpA));
    vec3 cpEnvironment=${high&&light?'textureLod(cpReflectionProbeCustom,cpEnvDir,cpRough*6.).rgb*.3':'vec3(0.)'};
    diffuseColor=vec4(cpAlbedo,opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(cpMaterialN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=cpRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=cpMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=cpEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=cpAo*${high?'1.':'1.5'};reflectedLight.indirectSpecular=cpEnvironment*cpAo;reflectedLight.directSpecular${high?'*=cpSpecular':'=vec3(0.)'};`);
   if(!light)s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  return u;
 }catch(error){warnings.push('Car paint remains unsupported: '+error.message);return null;}
}
