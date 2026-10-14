import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneLightWarning} from './source-scene-light.js';

async function configure(m,p,macros,load,warnings,o={},paper){
 try{
  const quality=scalar(macros.RENDER_QUALITY,0),detailed=quality<2,normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1),ugc=scalar(macros.ENABLE_UGC_COLOR,0),second=scalar(macros.TEXCOORD1_ENABLE,paper?0:1);
  if(![0,1,2].includes(quality)||[normal,change,ugc,second].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  if(detailed&&normal&&!o.sourceTangents)throw Error('Missing source tangent');
  if(!paper&&detailed&&second&&!o.sourceSecondUv)throw Error('Missing source second UV');
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body displacement unresolved');
  const num=(k,d)=>f(scalar(p[k],d)),vec=(k,d)=>vector(p[k],d),col=(k,d=[1,1,1,1])=>rgb(vec(k,d));
  const intensity=vec('Intensity',[1,1,1,0]),base=vec('BaseColor',[1,1,1,1]);
  const maps=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing source Tex0-Tex4');
  const u={neoT124Time:{value:0},neoT124Scale:{value:1}};maps.forEach((t,i)=>u['t124Tex'+i]={value:t});setup(m,detailed&&normal);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,detailed&&normal);
   if(!paper&&detailed&&second){
    s.vertexShader='attribute vec2 uv1;varying vec2 t124Uv1;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nt124Uv1=uv1;');
    s.fragmentShader='varying vec2 t124Uv1;\n'+s.fragmentShader;
   }
   s.fragmentShader=`uniform sampler2D t124Tex0,t124Tex1,t124Tex2,t124Tex3,t124Tex4;uniform float neoT124Time,neoT124Scale;
    vec3 t124Linear(vec3 c){return ${detailed?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
   `+s.fragmentShader;
   let body=`vec2 t124Uv=t107Uv;${paper?`t124Uv.x+=t124Uv.y<.25?${num('FaceUVOffset',0)}*${num('CharOffset',1)}:0.;`:''}
    vec4 t124Base=texture2D(t124Tex0,t124Uv);t124Base.rgb=t124Linear(t124Base.rgb);
    t124Base.rgb=${change?`vec3(dot(t124Base.rgb,vec3(.2125,.7154,.0721)))*${paper?rgb(base):`t124Linear(${rgb(base)})`}`:'t124Base.rgb'}*${num('TintValue',1)};
    vec3 t124N=t107N,t124V=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    mat3 t124Tbn=${detailed&&normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec4 t124Mix=${detailed?'texture2D(t124Tex2,t124Uv)':'vec4(1.,1.,0.,0.)'};
    vec3 t124Extra=vec3(0.),t124Albedo=t124Base.rgb;float t124Spark=0.,t124Noise=0.,t124Hair=0.;
   `;
   if(paper)body+='vec4 t124Point=texture2D(t124Tex4,t124Uv);\n';
   if(detailed&&normal){
    body+=`vec3 t124Sample=texture2D(t124Tex1,t124Uv).xyz*2.-1.;t124Sample.xy*=${f(intensity[0])};t124N=t124Tbn*normalize(t124Sample);`;
    if(paper)body+=`vec3 t124Detail=texture2D(t124Tex3,t124Uv*${num('PaPerNormalTile',1)}).xyz*2.-1.;t124Detail.xy*=${num('PaPerNormalMult',1)};
     vec3 t124A=vec3(t124Sample.xy,t124Sample.z+1.),t124B=vec3(-t124Detail.xy,t124Detail.z);
     vec3 t124Blended=t124A*dot(t124A,t124B)-t124B*(t124Sample.z+1.);
     t124N=mix(t124N,t124Tbn*normalize(t124Blended),t124Point.b);`;
   }
   if(detailed&&paper){
    const para=vec('PaperPara02',[1,1,0,0]),noise=vec('PaperNoisePara',[1,0,1,0]);
    body+=`float t124Spec=pow(max(dot(normalize(reflect(${sourceSceneSunGlsl()},t107N)),t124V),0.),3.);t124Spec=smoothstep(0.,1.,t124Spec);
     t124Spark=texture2D(t124Tex4,t124Uv*${f(para[1])}).r*t124Point.a;
     t124Noise=smoothstep(${f(noise[1])},${f(noise[2])},texture2D(t124Tex4,t124Uv*${f(noise[0])}).g);
     vec3 t124SparkColor=mix(${col('PointColor')},${col('PointColor')}*20.,t124Spec);
     t124Albedo=mix(t124Base.rgb,t124SparkColor,t124Spark*t124Noise);`;
   }
   if(detailed&&!paper){
    const add=vec('AddNoisePara',[1,0,0,0]),bn=vec('BaseNoisePara',[1,0,0,0]),a=vec('DotPara',[1,1,1,0]),b=vec('Dot2Para',[1,0,0,0]),c=vec('DotPara2',[1,1,1,0]),d=vec('Dot2Para2',[1,0,0,0]),em=vec('EmisPara',[1,0,0,0]);
    body+=`vec2 t124Custom=${second?'t124Uv1':'t124Uv'};vec3 t124Tv=transpose(t124Tbn)*t124V;
     float t124Distort=texture2D(t124Tex4,t124Custom*${f(add[0])}+neoT124Time*vec2(${f(add[1])},${f(add[2])})).r*${f(add[3])};
     float t124Ramp=texture2D(t124Tex4,t124Custom*${f(bn[0])}+neoT124Time*vec2(${f(bn[1])},${f(bn[2])})+t124Distort).r;
     vec2 t124RampUv=-t124Tv.xy*${f(bn[3])}+vec2(smoothstep(0.,1.,t124Ramp),0.);
     float t124Edge=pow(clamp(dot(t124V,t107N),0.,1.),2.)*1.1+.3;
     t124Hair=texture2D(t124Tex4,t124Uv).a;
     vec3 t124Color=texture2D(t124Tex3,t124RampUv).rgb;
     t124Albedo=mix(pow(t124Base.rgb*t124Edge,vec3(1.2))*.7,t124Base.rgb,t124Hair);
     vec3 t124EmisAlbedo=t124Color*t124Edge*(1.-t124Hair);
     vec3 t124BaseEmis=(1.-t124Ramp)*pow(t124EmisAlbedo,vec3(${f(em[0])}))*${f(em[1])};
     float t124Luminance=length(t124EmisAlbedo);
     float t124Dot1=texture2D(t124Tex4,t124Custom*${f(a[0])}).g*texture2D(t124Tex4,t124Custom*${f(b[0])}-(${f(b[3])})*t124Tv.xy+neoT124Time*vec2(${f(b[1])},${f(b[2])})).g;
     float t124Dot2=texture2D(t124Tex4,t124Custom*${f(c[0])}).b*texture2D(t124Tex4,t124Custom*${f(d[0])}-(${f(d[3])})*t124Tv.xy+neoT124Time*vec2(${f(d[1])},${f(d[2])})).b;
     vec3 t124Layer1=pow(t124Luminance/.5,1.2)*pow(t124Dot1,${f(a[1])})*${f(a[2])}*${col('PotColor')};
     vec3 t124Layer2=pow(t124Luminance/.6,1.2)*pow(t124Dot2,${f(c[1])})*${f(c[2])}*${col('Pot2Color')};
     t124Extra=(t124BaseEmis+t124Layer1+t124Layer2)*t124Edge;`;
   }
   body+=`diffuseColor=vec4(t124Albedo,${paper&&!ugc?'t124Base.a*':''}${f(base[3])}*opacity);`;
   const paperSpec=vec('PaperPara01',[1,0,0,0]);
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(t124N*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${paper?`mix(t124Mix.g,${num('PaPerPointRough',0)},t124Spark)`:`mix(${f(intensity[1])},t124Mix.g,t124Hair)`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${paper?`mix(t124Mix.b,clamp(t124Spark*${num('PaPerPointMetal',1)}*t124Noise,0.,1.),t124Spark)`:`mix(${f(intensity[2])},t124Mix.b,t124Hair)`};`)
    .replace('#include <emissivemap_fragment>',`float t124F=clamp(${num('FresnelScale',0)}+(1.-${num('FresnelScale',0)})*pow(1.-dot(t124N,t124V),5.),0.,1.);
     vec3 t124BaseEm=mix(vec3(t124Mix.a),t124Mix.a*t124Base.rgb,${num('BaseEmissiveKey',0)})*${paper?col('EmissiveColor'):`t124Linear(${col('EmissiveColor')})`}*${num('EmissiveValue',1)};
     totalEmissiveRadiance=(t124F*${col('RimColor',[0,0,0,0])}*${f(intensity[3])}+t124BaseEm+t124Extra)*neoT124Scale;`)
    .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>\nmaterial.specularColor=vec3(${paper?f(.08*paperSpec[2]):'.04'});material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);`)
    .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>\n${paper?`reflectedLight.directSpecular*=${col('SpecularColor')};`:''}`)
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=t124Mix.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),t124Mix.r,material.roughness);
     #endif`);
  };
  warnings.push((paper?'paper':'liuma')+' source channels; '+(paper?sourceSceneLightWarning:'original lighting/BRDF remain preview'));return u;
 }catch(e){warnings.push((paper?'paper':'liuma')+' remains unsupported: '+e.message);return null;}
}
export const configurePaper=(...x)=>configure(...x,true);
export const configureLiuma=(...x)=>configure(...x,false);
