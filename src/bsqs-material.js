import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Exact custom channels from standard_bsqs_base / standard_qs_hair.
// Hair keeps the existing Three lighting approximation; base is source unlit.
export async function configureBsqs(m,p,macros,load,warnings,kind='base',options={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normalOn=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1),ugc=scalar(macros.ENABLE_UGC_COLOR,0);
  if(![0,1,2].includes(q)||[normalOn,light,change,ugc].some(v=>![0,1].includes(v)))throw Error('Unknown source macro');
  const basis=normalOn===1&&(kind==='base'||(q<2&&light===1));
  if(basis&&!options.sourceTangents)throw Error('Missing original tangent basis');
  const maps=await Promise.all(Array.from({length:kind==='base'?5:4},(_,i)=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing source texture');
  const num=(key,fallback)=>f(scalar(p[key],fallback)),col=(key,d=[1,1,1,1])=>rgb(vector(p[key],d));
  const intensity=vector(p.Intensity,[1,1,1,0]),base=vector(p.BaseColor,[1,1,1,1]),speed=vector(p.SparkLayerSpeed,[0,0]);
  const u={neoTime:{value:0},neoFaceOffset:{value:scalar(p.FaceUVOffset,0)}};maps.forEach((map,i)=>u['bsqsTex'+i]={value:map});setup(m,basis);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,basis);
   s.fragmentShader=`uniform sampler2D bsqsTex0,bsqsTex1,bsqsTex2,bsqsTex3${kind==='base'?',bsqsTex4':''};uniform float neoTime,neoFaceOffset;
    vec3 bsqsLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    float bsqsPow5(float v){float v2=v*v;return v2*v2*v;}
   `+s.fragmentShader;
   let body=`vec2 bsqsUv=t107Uv;${kind==='base'?'bsqsUv.x+=bsqsUv.y<.25?neoFaceOffset:0.;':''}
    vec4 bsqsBase=texture2D(bsqsTex0,bsqsUv),bsqsMix=texture2D(bsqsTex2,bsqsUv);
    vec3 bsqsV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 bsqsN=t107N;
    ${q<2&&normalOn&&light?`vec3 bsqsRawN=texture2D(bsqsTex1,bsqsUv).xyz*2.-1.;bsqsRawN.xy*=${f(intensity[0])};bsqsN=mat3(t107T,t107B,t107N)*normalize(bsqsRawN);`:''}
    float bsqsDot=dot(bsqsN,bsqsV),bsqsF=clamp(${num('FresnelScale',0)}+(1.-${num('FresnelScale',0)})*bsqsPow5(1.-bsqsDot),0.,1.);
    vec3 bsqsEmission=vec3(0.);
   `;
   if(kind==='hair'){
    body+=`vec2 bsqsSparkUv=bsqsUv*${num('SparkleTiling',5)};
     float bsqsSpark=texture2D(bsqsTex3,bsqsSparkUv+vec2(0.,neoTime*${f(speed[0])})).r*texture2D(bsqsTex3,bsqsSparkUv*1.5+vec2(0.,neoTime*${f(speed[1])})).r;
     vec3 bsqsColor=${change?`bsqsLinear(vec3(dot(bsqsBase.rgb,vec3(.2125,.7154,.0721)))*${col('BaseColor')})`:`bsqsLinear(bsqsBase.rgb*${col('BaseColor')}+bsqsSpark*${col('SparkleCol')}*${num('SparkLightness',10)})`}*${num('TintValue',1)};
     diffuseColor=vec4(bsqsColor,${f(base[3])}*opacity);
     float bsqsHairF=clamp(${num('hairFrenel',0)}+(1.-${num('hairFrenel',0)})*pow(1.-bsqsDot,${num('hairFrenelPow',1)}),0.,1.);
     bsqsEmission=bsqsF*${col('RimColor',[0,0,0,0])}*${f(intensity[3])}+bsqsMix.a*${col('EmissiveColor')}*${num('EmissiveValue',1)}+bsqsHairF*${num('hairFrenelMult',1)}*${col('hairFrenelColor')};`;
   }else{
    body+=`vec3 bsqsTangentV=${normalOn?'vec3(dot(t107T,bsqsV),dot(t107B,bsqsV),dot(t107N,bsqsV))':'bsqsV'};
     vec2 bsqsOffset=bsqsTangentV.xy*.01*${num('SparkleOffset',4)};
     float bsqsSpark=pow(texture2D(bsqsTex3,bsqsUv*${num('SparkleScale',4)}+vec2(.3,neoTime)*${num('SparkleSpeed',.02)}+bsqsOffset).g*texture2D(bsqsTex3,bsqsUv*${num('SparkleScale',4)}*1.5+vec2(neoTime,.3)*${num('SparkleSpeed',.02)}+bsqsOffset).g,${num('SparklePow',4)});
     vec3 bsqsColor=bsqsLinear(bsqsBase.rgb);
     bsqsEmission=bsqsF*${col('RimColor',[0,0,0,0])}*${f(intensity[3])}+bsqsMix.a*bsqsColor*${num('EmissiveValue',1)}+bsqsSpark*40.*${num('SparkleStrength',1)}*bsqsColor*texture2D(bsqsTex4,bsqsUv).r;
     ${change?`bsqsEmission=bsqsLinear(vec3(dot(bsqsBase.rgb,vec3(.2125,.7154,.0721)))*${col('BaseColor')})*${num('TintValue',1)};`:ugc?`float bsqsArea=step(bsqsBase.a,.35)-step(bsqsBase.a,.3);bsqsEmission=mix(bsqsColor,bsqsLinear(bsqsArea*${col('Color7')}),bsqsArea)*${num('TintValue',1)};`:`bsqsEmission=(bsqsEmission+bsqsColor)*${col('BaseColor')}*${num('TintValue',1)};`}
     diffuseColor=vec4(0.,0.,0.,${ugc?'1.':'bsqsBase.a'}*${f(base[3])}*opacity);`;
   }
   const rough=q===2?'.5':kind==='base'?`mix(${f(intensity[1])},clamp(bsqsMix.g*${f(intensity[1])},0.,1.),${num('UGCKey_R',1)})`:`clamp(bsqsMix.g*${f(intensity[1])},0.,1.)`;
   const metal=q===2?'0.':kind==='base'?`mix(${f(intensity[2])},clamp(bsqsMix.b*${f(intensity[2])},0.,1.),${num('UGCKey_M',1)})`:`clamp(bsqsMix.b*${f(intensity[2])},0.,1.)`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(bsqsN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${rough};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${metal};`)
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=${q===2?'1.':'bsqsMix.r'};`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=bsqsEmission;');
   if(kind==='base')s.fragmentShader=s.fragmentShader.replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;','vec3 outgoingLight = totalEmissiveRadiance;');
  };
  warnings.push(kind==='base'?'骑士基底源无光照、颜色、闪点与原切线视差已接入':'骑士头发源颜色、ORM、闪点和边缘光已接入；通用光照仍为预览近似');
  return u;
 }catch(error){warnings.push('骑士材质未完整支持：'+error.message);return null;}
}
