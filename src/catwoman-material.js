import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSpecular,sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
import {sourceSceneSunGlsl,sourceSceneSunColorGlsl} from './source-scene-light.js';

// standard_char_catwoman.hlsl and common/function.hlsl; source numeric domains
// are preserved (sparkle colors are raw; albedo/emission colors use source gamma).
export const catwomanColorGlsl=`
vec3 cwRGBtoHSV(vec3 c){
 vec4 p=c.g<c.b?vec4(c.bg,-1.,2./3.):vec4(c.gb,0.,-1./3.);
 vec4 q=c.r<p.x?vec4(p.xyw,c.r):vec4(c.r,p.yzx);
 float d=q.x-min(q.w,q.y);
 return vec3(abs((q.w-q.y)/(6.*d+1e-10)+q.z),d/(q.x+1e-10),q.x);
}
vec3 cwHSVtoRGB(vec3 c){
 vec3 h=clamp(vec3(abs(c.x*6.-3.)-1.,2.-abs(c.x*6.-2.),2.-abs(c.x*6.-4.)),0.,1.);
 return ((h-1.)*c.y+1.)*c.z;
}
vec3 cwRainbow(vec2 uv,float time,float saturation){
 vec3 c=(.5+.5*cos(vec3(time-uv.x*3.1415+sin(uv.y*length(uv)+time*.5))+vec3(0.,2.,4.)))*vec3(.4,.2,1.);
 vec3 hsv=cwRGBtoHSV(c);hsv.y*=saturation;return cwHSVtoRGB(hsv);
}
float cwPow5(float x){float x2=x*x;return x2*x2*x;}
`;

export async function configureCatwoman(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT']);
  if(![0,1,2].includes(q)||[normal,light].some(x=>![0,1].includes(x))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active catwoman permutation');
  // The two source instances have neutral soft-body parameters. Active source
  // deformation needs its controller; do not silently accept it here.
  if(['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ','SoftBodyCenter'].some(k=>vector(p[k],[0,0,0]).some(x=>x!==0))||vector(p.SoftBodyScale,[1,1,1,1]).some(x=>x!==1)||vector(p.SoftBodyBottom,[0,0,0,1]).some((x,i)=>x!==(i===3?1:0)))throw Error('Active source soft-body controller not connected');
  const high=q<2,useTangent=high&&normal===1;
  if(useTangent&&o.sourceTangents!==true)throw Error('Missing original tangent basis');
  const I=vector(p.Intensity,[1,1,1,0]),base=vector(p.BaseColor,[1,1,1,1]);
  const rim=vector(p.RimColor,[0,0,0,0]),emission=vector(p.EmissiveColor,[1,1,1,1]);
  const color1=vector(p.SparkleColor1,[1,1,1,1]),color2=vector(p.SparkleColor2,[1,1,1,1]);
  const n=(k,d)=>f(scalar(p[k],d)),tint=n('TintValue',1);
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};
  for(const key of high?['Tex0','Tex1','Tex2','Tex3','Tex4','Tex5']:['Tex0']){
   const texture=await load(key,false);
   if(!texture?.isTexture||texture.isCubeTexture)throw Error('Missing active original 2D texture: '+key);
   u['cw'+key]={value:texture};
  }
  setup(m,useTangent);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,useTangent);
   if(high){
    s.vertexShader='varying vec3 cwCenterView;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
     cwCenterView=(viewMatrix*vec4((modelMatrix*vec4(transformed,1.)).xyz-modelMatrix[3].xyz,0.)).xyz*vec3(1.,1.,-1.);`);
    s.fragmentShader='varying vec3 cwCenterView;\n'+s.fragmentShader;
   }
   s.fragmentShader=`uniform sampler2D cwTex0,cwTex1,cwTex2,cwTex3,cwTex4,cwTex5;
    uniform float neoTime,neoEmissionScale;
    vec3 cwLinear(vec3 c){return ${high?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    ${catwomanColorGlsl}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 cwUv=t107Uv;cwUv.x+=cwUv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset',1)}:0.;
    vec4 cw0=texture2D(cwTex0,cwUv);cw0.rgb=cwLinear(cw0.rgb)*${tint};
    vec4 cw2=vec4(1.,1.,0.,0.);vec3 cwN=t107N,cwSparkle=vec3(0.),cwStreamer=vec3(0.);
    vec3 cwV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${high?`
    cw2=texture2D(cwTex2,cwUv);vec4 cwMask=texture2D(cwTex5,cwUv),cw1=texture2D(cwTex1,cwUv);
    // Detail UV deliberately uses the original UV, before face atlas offset.
    vec4 cwDetail=texture2D(cwTex4,t107Uv*${n('DetailNormalTiling',1)});
    mat3 cwTbn=${useTangent?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 cwT=cw1.xyz*2.+vec3(-1.,-1.,0.),cwU=cwDetail.xyz*vec3(-2.,-2.,2.)+vec3(1.,1.,-1.);
    cwU.xy*=${n('DetailNormalIntensity',1)};
    vec3 cwLocal=mix(cw1.xyz*2.-1.,cwT*dot(cwT,cwU)-cwU*cwT.z,cwMask.b);
    cwLocal.xy*=${f(I[0])};cwN=cwTbn*normalize(cwLocal);
    vec3 cwTV=normalize(vec3(dot(cwTbn[0],cwV),dot(cwTbn[1],cwV),dot(cwTbn[2],cwV)));
    vec2 cwParallax=cwTV.xy/cwTV.z;
    vec4 cwS1=texture2D(cwTex3,cwUv*${n('SparkleScale1',1)}*2.-cwParallax*${n('SparkleOffset1',.1)});
    vec4 cwS2=texture2D(cwTex3,cwUv*${n('SparkleScale2',1)}-cwParallax*${n('SparkleOffset2',.1)});
    float cwGlint1=clamp(dot(cwTbn*normalize(cwS1.xyz*2.-1.),-cwV),0.,1.);
    float cwGlint2=pow(clamp(dot(cwTbn*normalize(cwS2.xyz*2.-1.),-cwV),0.,1.),3.)*cwS2.a;
    cwSparkle=cwPow5(cwGlint1*cwMask.r)*${rgb(color1)}*${n('SparkleIntensity1',1)}*10.
      +cwPow5(cwGlint2*cwMask.r)*${rgb(color2)}*${n('SparkleIntensity2',1)}*100.;
    `:''}
    float cwNoV=clamp(1.-dot(cwN,cwV),0.,1.),cwFresnel=cwPow5(cwNoV);
    ${high?`
    float cwStreamMask=max(cwPow5(cwDetail.a)*6.*cwMask.g,cwFresnel);
    cwStreamer=(cwStreamMask*cwMask.b+cwNoV*cwNoV*cwMask.a*${n('ColorfulMaskIntensity',1)})
      *cwRainbow(cwCenterView.xy*1.5,neoTime,${n('ColorfulSaturation',.8)})*${n('ColorfulIntensity',2)};
    `:''}
    diffuseColor=vec4(cw0.rgb,cw0.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(cwN*vec3(-1.,1.,1.)));')
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(cw2.g*${f(I[1])},0.,1.);`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=clamp(cw2.b*${f(I[2])},0.,1.);`)
   .replace('#include <emissivemap_fragment>',`
    vec3 cwBaseEmission=mix(vec3(cw2.a),cw2.a*cw0.rgb,${n('BaseEmissiveKey',0)})*cwLinear(${rgb(emission)})*${n('EmissiveValue',1)};
    vec3 cwSun=${sourceSceneSunGlsl()};
    float cwSss=clamp(clamp(dot(cwV,-(cwN*.1+cwSun)),0.,1.)*.5+clamp(dot(cwV,-(cwN*.3-cwSun)),0.,1.),0.,1.);
    vec3 cwSssEmission=mix(cw0.rgb*vec3(.7,.4,.3),${sourceSceneSunColorGlsl()},cwPow5(cwSss))*cwSss*.3*${tint};
    totalEmissiveRadiance=(clamp(${n('FresnelScale',0)}+(1.-(${n('FresnelScale',0)}))*cwFresnel,0.,1.)*${rgb(rim)}*${f(I[3])}
      +cwBaseEmission+cwSssEmission+cwSparkle+cwStreamer)*neoEmissionScale;
   `)
   .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=cw2.r;
    #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),cw2.r,material.roughness);
    #endif`)
   .replace('#include <lights_physical_fragment>',sourceSpecular('.5',sourceGrazing));
   sourceIsotropy(s,{quality:q,smoothDiffuse:true,light:light===1});
  };
  warnings.push('猫女材质通道已接入；原场景环境补光、完整光照及软体动态仍待还原');
  return u;
 }catch(e){warnings.push('Catwoman remains unsupported: '+e.message);return null;}
}
