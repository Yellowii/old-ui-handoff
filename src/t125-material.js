import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneLightWarning} from './source-scene-light.js';

// gqing_hacker_dissolve: original custom channels; standard lighting remains preview.
export async function configureHackerDissolve(m,p,macros,load,warnings,o={}){
 try{
  const quality=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),detailed=quality<2;
  if(![0,1,2].includes(quality)||[normal,change].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  if(detailed&&normal&&(!o.sourceTangents||!o.sourceSecondUv))throw Error('Missing original tangent/UV1');
  const num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d)),intensity=vector(p.Intensity,[1,1,1,0]);
  const maps=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0-Tex4');
  const u={neoT125Time:{value:0}};maps.forEach((t,i)=>u['t125Tex'+i]={value:t});setup(m,detailed&&normal);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,detailed&&normal);
   s.vertexShader='varying float t125LocalY;\n'+s.vertexShader.replace('#include <project_vertex>','t125LocalY=transformed.y;\n#include <project_vertex>');
   if(detailed&&normal){
    s.vertexShader='attribute vec2 uv1;varying vec2 t125Uv1;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nt125Uv1=uv1;');
    s.fragmentShader='varying vec2 t125Uv1;\n'+s.fragmentShader;
   }
   s.fragmentShader=`varying float t125LocalY;uniform sampler2D t125Tex0,t125Tex1,t125Tex2,t125Tex3,t125Tex4;uniform float neoT125Time;
    vec3 t125Linear(vec3 c){return ${detailed?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    float t125Random(vec2 st){return fract(sin(dot(st,vec2(12.9898,78.233)))*43758.5453123);}
    float t125Noise(vec2 st){vec2 i=floor(st),v=fract(st),h=v*v*(3.-2.*v);float a=t125Random(i),b=t125Random(i+vec2(1.,0.)),c=t125Random(i+vec2(0.,1.)),d=t125Random(i+vec2(1.,1.));return mix(a,b,h.x)+(c-a)*h.y*(1.-h.x)+(d-b)*h.x*h.y;}
   `+s.fragmentShader;
   let body=`vec2 t125Offset=${detailed?`vec2(t125Noise(t107Uv*30.+neoT125Time*vec2(0.,1.5))*.003*(1.-${num('noiseKey',0)}))`:'vec2(0.)'};
    vec3 t125Base=t125Linear(texture2D(t125Tex0,t107Uv+t125Offset).rgb);
    vec4 t125NormalSample=vec4(.5,.5,1.,1.),t125Mix=${detailed?'texture2D(t125Tex2,t107Uv)':'vec4(1.,1.,0.,1.)'};
    vec3 t125RawN=vec3(0.),t125N=t107N,t125V=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 t125Albedo=t125Base,t125Extra=vec3(0.);
   `;
   if(detailed&&normal)body+=`
    t125NormalSample=texture2D(t125Tex1,t107Uv+t125Offset);
    vec3 t125B=t125NormalSample.xyz*2.-1.;t125B.xy*=${f(intensity[0])};
    vec2 t125DetailOffset=vec2(t125Noise(t125Uv1*100.+vec2(neoT125Time*.6))*.1*(1.-${num('noiseKey',0)}));
    vec3 t125A=texture2D(t125Tex3,mix(t107Uv,t125Uv1,${num('NormalUVKey',1)})*${num('DetailNormalUVTiling',1)}+t125DetailOffset).xyz*2.-1.;t125A.xy*=${num('DetailNormalIntensity',.2)};
    mat3 t125Tbn=mat3(t107T,t107B,t107N);t125RawN=t125Tbn*normalize(t125B);
    vec3 t125LerpA=mix(t125RawN,t125Tbn*normalize(t125A),t125NormalSample.a);
    float t125Fr=clamp(dot(t125V,t125RawN)-.4,0.,1.),t125NoL=dot(t125RawN,-${sourceSceneSunGlsl()});
    // Integer power preserves negative source dot products (GLSL pow is undefined there).
    float t125NoL2=t125NoL*t125NoL,t125NoL4=t125NoL2*t125NoL2;t125NoL=t125NoL4*t125NoL4*t125NoL2;
    t125N=mix(mix(t125RawN,t125LerpA,t125Fr),mix(t125RawN,t125LerpA,min(t125Fr,t125NoL)),${num('DetailDarkLerp',0)});
   `;
   if(detailed)body+=`
    vec3 t125MatN=mix(t107N,t125RawN,${num('matcapuvKey',0)});
    vec2 t125MatUv=(mat3(viewMatrix)*(t125MatN*vec3(-1.,1.,1.))).xy*.5+.5;t125MatUv.y*=-1.;
    vec3 t125Mat=texture2D(t125Tex4,t125MatUv).rgb*${num('MatcapIntensity',.5)}*t125NormalSample.a*clamp(1.-t125Mix.a,0.,1.);
    float t125ColorFr=clamp((dot(t125V,t125RawN)-.3)*2.,0.,1.);
    vec3 t125Mask=mix(t125Base,mix(${col('Color0')},${col('Color1')},t125ColorFr),t125NormalSample.a);
    t125Mask=mix(t125Mask,t125Base,${num('ColorLerp0Scale',0)});
    vec3 t125MaskB=mix(t125Base,mix(${col('Color0')},t125Base,t125ColorFr),t125NormalSample.a);
    t125Albedo=mix(mix(t125Base,t125MaskB,t125Mix.r),t125Mask,${num('basecolKey',0)});
    float t125Shine=mix(t125Noise(t107Uv*30.+vec2(neoT125Time*3.))*3.,.5+smoothstep(0.,1.,sin(neoT125Time*5.)*.5+.5)*3.,${num('EmissiveShiningKey',0)});
    t125Extra=t125Mat+t125Mix.a*mix(${col('Color3')},t125Base,${num('BaseEmissiveKey',1)})*t125Shine*${num('EmissiveIntensity',1)}+${col('Color2')}*(1.-clamp((dot(t125V,t107N)-.1)*2.,0.,1.));
   `;
   body+=`float t125MaskValue=t125LocalY*.3+t125Random(ceil(t107Uv*50.))*.1;
    float t125Opacity=1.-step(${num('DissolveStep',1)},t125MaskValue),t125Edge=t125Opacity+step(${num('DissolveStep',1)}-.05,t125MaskValue)-1.;
    vec3 t125Specular=mix(vec3(1.),t125Albedo,${num('highLightColor',0)});
    diffuseColor=vec4(${change?`t125Linear(vec3(clamp(dot(t125Albedo,vec3(.6,.7154,.0721)),0.,1.))*${col('BaseColor')})*${num('TintValue',1)}`:'t125Albedo'},t125Opacity);`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(t125N*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=t125Mix.g*${f(intensity[1])};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=t125Mix.b*${f(intensity[2])};`)
    .replace('#include <emissivemap_fragment>',`float t125F=clamp(${num('FresnelScale',0)}+(1.-${num('FresnelScale',0)})*pow(1.-dot(t125N,t125V),5.),0.,1.);totalEmissiveRadiance=t125Extra+t125F*${col('RimColor',[0,0,0,0])}*${f(intensity[3])}+vec3(t125Edge*${num('DissolveIntensity',3)});`)
    .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=.08*t125Specular;material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);');
  };
  warnings.push('hacker dissolve source channels; '+sourceSceneLightWarning);return u;
 }catch(e){warnings.push('hacker dissolve remains unsupported: '+e.message);return null;}
}
