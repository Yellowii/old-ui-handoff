import {sourceSceneSunGlsl,sourceSceneLightWarning} from './source-scene-light.js';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// The two source shaders share the frame only; their raw-data formulas differ.
async function configure(m,p,macros,load,warnings,o={},kind){
 try{
  const qs=kind==='qs',q=scalar(macros.RENDER_QUALITY,0),detailed=q<2;
  const normalOn=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,qs?1:0);
  if(![0,1,2].includes(q)||![0,1].includes(normalOn)||![0,1].includes(change))throw Error('Unknown source macro');
  if(detailed&&normalOn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body displacement is unresolved');
  const num=(key,fallback)=>f(scalar(p[key],fallback)),col=(key,fallback=[1,1,1,1])=>rgb(vector(p[key],fallback));
  const I=vector(p.Intensity,qs?[1,1,0,0]:[1,1,1,0]),P=vector(p.Parameter,[1,1,1,1]);
  const maps=await Promise.all(Array.from({length:qs?6:5},(_,i)=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original texture');
  const uniforms={neoT121Time:{value:0},neoT121Scale:{value:1}};
  maps.forEach((t,i)=>uniforms['t121Tex'+i]={value:t});setup(m,detailed&&normalOn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,uniforms);frame(m,s,detailed&&normalOn);
   s.fragmentShader=`uniform sampler2D ${maps.map((_,i)=>'t121Tex'+i).join(',')};
    uniform float neoT121Time,neoT121Scale;
    vec3 t121Linear(vec3 x){return ${detailed?'pow(max(x,vec3(0.)),vec3(2.2))':'x*x'};}
    float t121Random(vec2 st){return fract(sin(dot(st,vec2(12.,78.)))*43758.);}
    float t121Noise(vec2 st){vec2 i=floor(st),v=fract(st),u=v*v*(3.-2.*v);float a=t121Random(i),b=t121Random(i+vec2(1,0)),c=t121Random(i+vec2(0,1)),d=t121Random(i+vec2(1,1));return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}
   `+s.fragmentShader;
   let body=`vec4 t121Base=texture2D(t121Tex0,t107Uv);t121Base.rgb=t121Linear(t121Base.rgb);
    vec3 t121View=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 t121Normal=t107N,t121Extra=vec3(0.);
    vec4 t121Mix=${qs?'vec4(0.)':'vec4(1.,.5,0.,1.)'};
    float t121Flash=0.;
   `;
   if(detailed){
    body+=`mat3 t121Tbn=${normalOn?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
     vec4 t121Nt=texture2D(t121Tex1,t107Uv);vec3 t121Ns=t121Nt.xyz*2.-1.;
     ${qs?'t121Ns.z=sqrt(clamp(1.-dot(t121Ns.xy,t121Ns.xy),0.,1.));':''}
     t121Ns.xy*=${f(I[0])};t121Normal=t121Tbn*normalize(t121Ns);t121Mix=texture2D(t121Tex2,t107Uv);
    `;
    if(qs){
     body+=`vec3 t121Nv=mat3(viewMatrix)*(t121Normal*vec3(-1.,1.,1.)),t121Vv=normalize(vViewPosition);
      vec3 t121Tv=normalize(cross(t121Vv,vec3(0,1,0))),t121Bv=normalize(cross(t121Vv,t121Tv));
      vec2 t121CapUv=vec2(dot(t121Nv,t121Tv),dot(t121Nv,t121Bv))*.5+.5;
      vec4 t121Cap=texture2D(t121Tex3,t121CapUv);
      vec3 t121TangentView=transpose(t121Tbn)*t121View;
      float t121Offset=t121Noise(vec2(floor(t107Uv.x*16.)*.6));
      vec2 t121Inner=t107Uv*vec2(16.,1.)*${num('CrackedUVTiling',1)}-t121TangentView.xy*.1+vec2(0.,-neoT121Time*.1+t121Offset);
      float t121Spark=texture2D(t121Tex4,t121Inner).r,t121Flow=t121Noise(t107Uv*12.+vec2(0.,-neoT121Time*.5));
      float t121Cracked=t121Spark*t121Spark*${num('CrackedStr',0)}*t121Flow*t121Flow*t121Flow;
      float t121Fres=pow(clamp(1.-clamp(dot(t107N,t121View),0.,1.),0.,1.),${num('FresnelPow',5)})*${num('FresnelStr',1)};
      float t121Ndl=dot(t121Normal,-${sourceSceneSunGlsl()}),t121P=clamp(t121Ndl,0.,1.),t121Negative=clamp(-t121Ndl,0.,1.);
      vec3 t121Sss=${col('SSSColor1')}*.2*(1.-t121P)*(1.-t121P)*pow(1.-t121Negative,3./1.001)*.96;
      vec3 t121Dn=texture2D(t121Tex5,t107Uv*${num('DetailNormalUVTiling',1)}).xyz*2.-1.;
      t121Dn.z=sqrt(clamp(1.-dot(t121Dn.xy,t121Dn.xy),0.,1.));t121Dn.xy*=${num('DetailNormalIntensity',.2)};
      vec3 t121Add=t121Tbn*normalize(t121Dn),t121LerpA=mix(t121Normal,t121Add,t121Nt.a);
      float t121NormalFr=clamp(dot(t121View,t121Normal)-.4,0.,1.);
      vec3 t121Blend=mix(t121Normal,t121LerpA,min(t121NormalFr,clamp(t121Ndl,0.,1.)));
      if(dot(t121Blend,-${sourceSceneSunGlsl()})>t121Ndl)t121Normal=t121Blend;
      float t121Sun=clamp(clamp(dot(-${sourceSceneSunGlsl()},t121View),0.,1.)*1.2,0.,1.);
      vec3 t121Front=t121Base.rgb*${col('Color0',[0,0,0,0])}*(1.-clamp((dot(t121View,t121Normal)-.1)*1.2,0.,1.));
      vec3 t121Back=t121Base.rgb*${col('Color1',[0,0,0,0])}*(1.-clamp((dot(t121View,t121Normal)-.5)*1.6,0.,1.));
      t121Extra=mix(t121Back,t121Front,t121Sun)+t121Fres*${col('FresnelColor')};
      t121Extra+=pow(t121Cap.g,1.7)*${col('HighLightColor')}*${num('HighLightStr',1)}+pow(t121Cap.a,1.7)*${col('ReflectColor')}*${num('ReflectStr',1)};
      t121Extra+=t121Nt.b*mix(${col('SSSColor')},t121Base.rgb,${num('SSSColorUseBaseCol',1)})*${num('SSSColorStr',1)};
      t121Extra+=t121Cracked*${col('CrackedColor')}+t121Sss*${num('SSSIntensity',0)};
     `;
    }else{
     body+=`vec3 t121TangentView=normalize(transpose(t121Tbn)*t121View);
      vec4 t121Probe=texture2D(t121Tex3,t107Uv*${f(P[3])}-t121TangentView.xy*.1);
      float t121Mask=clamp(dot(t121Probe.rgb*2.-1.,t121View),0.,1.)*t121Nt.a;
      vec3 t121FlashCol=texture2D(t121Tex4,vec2(t121Mask*${num('FlashColTiling',4)},.01)).rgb;
      vec4 t121Star=texture2D(t121Tex3,t107Uv*${num('StarTiling',10)});
      float t121Dot1=(t121View.x+t121View.y)*${num('FresnelColOffset',.05)};
      t121Dot1=mix(t121Dot1,t121Dot1+.4+ceil(t121Star.a)*2.*${num('StarBackValue',1)},1.-t107Uv.y);
      vec3 t121FresCol=t121Linear(texture2D(t121Tex4,vec2(t121Dot1*${num('FresnelColTiling',12)},mix(.4,.7,t121Star.a*${num('StarBackValue',1)}))).rgb);
      float t121Ndl=clamp(dot(-${sourceSceneSunGlsl()},t121Normal),0.,1.);
      t121Ndl=smoothstep(${num('FresnelStep',.5)},.9,t121Ndl)*(1.-${num('FresnelAreaBase',.05)})+${num('FresnelAreaBase',.05)};
      float t121StarMask=step(.1,pow(t121Star.a,3.))*t121Base.a;
      float t121Dot2=(t121View.x+t121View.y)*.2;
      vec3 t121StarCol=texture2D(t121Tex4,vec2(abs(fract(t121Dot2*${num('StarColTiling',4)}+t121Probe.r*.05+t121Star.a)*2.-1.),.7)).rgb;
      t121Star.a=t121StarMask*t121Star.a*t121Ndl;
      float t121FlashBase=${num('FlashBase',.2)}*t121Nt.a;
      t121Base.rgb=mix(t121Base.rgb,t121FresCol,t121FlashBase)+t121FresCol*t121FlashBase;
      float t121Facing=clamp(dot(t121Normal,t121View),0.,1.);
      t121Flash=pow(t121Mask,${num('FlashPow',2)})*(.2+smoothstep(0.,1.,t121Facing)*.8)*(1.-t121Star.a)*t121Ndl;
      t121Base.rgb=mix(t121Base.rgb*.8,vec3(0.),max(t121Flash,t121StarMask));
      t121Extra=t121FlashCol*t121Flash*${num('FlashEmisValue',2)}+t121StarCol*t121Star.a*${num('StarEmisValue',1)};
     `;
    }
   }
   const luminance='vec3(dot(t121Base.rgb,vec3(.2125,.7154,.0721)))';
   body+=`vec3 t121Albedo=${qs?`${change?luminance:'t121Base.rgb'}*${col('BaseColor')}`:change?`t121Linear(${luminance}*${col('BaseColor')})`:'t121Base.rgb'}*${num('TintValue',1)};
    ${qs&&detailed?`t121Albedo*=${num('BaseColorStr',1)};`:''}
    diffuseColor=vec4(t121Albedo,${qs?'t121Base.a*opacity':'opacity'});`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body)
    .replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(t121Normal*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${!detailed?(qs?'.5':'1.'):qs?`clamp(t121Mix.g*${f(I[1])},0.,1.)`:`mix(t121Mix.g*${f(I[1])},${f(P[0])},t121Flash)`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${!detailed?'0.':qs?`clamp(t121Mix.b*${f(I[2])},0.,1.)`:`mix(t121Mix.b*${f(I[2])},${f(P[1])},t121Flash)`};`)
    .replace('#include <emissivemap_fragment>',`float t121F=clamp(${num('FresnelScale',0)}+(1.-${num('FresnelScale',0)})*pow(1.-dot(${qs?'t121Normal':'t107N'},t121View),5.),0.,1.);
     totalEmissiveRadiance=(t121F*${col('RimColor',qs?[0,0,0,0]:[1,1,1,1])}*${f(I[3])}+t121Base.rgb*${qs?col('EmissiveColor'):'vec3(1.)'}*${num('EmissiveValue',0)}*t121Mix.a+t121Extra)*neoT121Scale;`)
    .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>\nmaterial.specularColor=vec3(${qs?'.08':'.04'});material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);`)
    .replace('#include <aomap_fragment>',qs?'':`reflectedLight.indirectDiffuse*=t121Mix.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),t121Mix.r,material.roughness);
     #endif`);
  };
  warnings.push(`${qs?'qingshe':'laserflash'} source custom channels; ${sourceSceneLightWarning}`);return uniforms;
 }catch(e){warnings.push(`${kind} remains unsupported: ${e.message}`);return null;}
}
export const configureQingshe=(...args)=>configure(...args,'qs');
export const configureLaserflash=(...args)=>configure(...args,'lf');
