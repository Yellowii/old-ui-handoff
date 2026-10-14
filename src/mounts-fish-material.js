import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// standard_mounts_fish.hlsl. Authored sampler: bilinear, wrap, mip.
export async function configureMountsFish(m,p,macros,load,o={},warnings=[]){
 try{
  // Source-only dead inputs (ENV_CUSTOM=0, BackN_Invert, HUEPara) remain unused.
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1),ugc=scalar(macros.ENABLE_UGC_COLOR,0);
  if(![0,1,2].includes(q)||[normal,change,ugc].some(x=>![0,1].includes(x)))throw Error('Unknown fish permutation');
  if(q<2&&normal&&!o.sourceTangents)throw Error('Original tangent basis required');
  const allowed=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','CHAR_CHANGE_COLOR','ENABLE_UGC_COLOR','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(Object.entries(macros).some(([k,v])=>!allowed.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented fish macro');
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body input unresolved');
  const num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d));
  const intensity=vector(p.Intensity,[1,1,1,0]),spark=vector(p.sparkPara,[1,1,0,0]),mask=vector(p.sparkMaskPara,[1,0,1,0]);
  if(mask[1]>=mask[2]||spark[1]<0||mask[0]<0)throw Error('Undefined fish power/smoothstep domain');
  if(Math.hypot(...vector(p.HueColor,[1,1,1,1]).slice(0,3))===0)throw Error('Zero hue axis');
  const keys=q<2?['Tex0',...(normal?['Tex1']:[]),'Tex2','Tex3','Tex4','Tex5']:['Tex0'];
  const textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original fish texture');
  const u=Object.fromEntries(keys.map((k,i)=>['mf'+k,{value:textures[i]}]));u.neoTime={value:0};u.neoEmissionScale={value:1};
  setup(m,q<2&&normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal===1);
   s.fragmentShader=`uniform float neoTime,neoEmissionScale;${keys.map(k=>'uniform sampler2D mf'+k+';').join('')}
    vec3 mfLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
    vec3 mfHue(float d){vec3 a=normalize(${col('HueColor')});float s=sin(d*6.283185308),c=cos(d*6.283185308);return vec3(c)+cross(a,vec3(1.))*s+a*dot(a,vec3(1.))*(1.-c);}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 mfUv=t107Uv;mfUv.x+=mfUv.y<.25?${num('FaceUVOffset',0)}*${num('CharOffset',1)}:0.;
    vec4 mf0=texture2D(mfTex0,mfUv*${scalar(p.FaceTexType,0)===1?'4.':'1.'});mf0.rgb=mfLinear(mf0.rgb);
    ${change?`mf0.rgb=dot(mf0.rgb,vec3(.2125,.7154,.0721))*mfLinear(${col('BaseColor')})*${num('TintValue',1)};`:ugc?`float mfBand=step(mf0.a,.35)-step(mf0.a,.3);mf0.rgb=mix(mf0.rgb,mfLinear(mfBand*${col('Color7')}),mfBand)*${num('TintValue',1)};`:`mf0.rgb*=${num('TintValue',1)};`}
    vec4 mf1=${q<2&&normal?'texture2D(mfTex1,mfUv)':'vec4(.5,.5,1.,0.)'},mf2=${q<2?'texture2D(mfTex2,mfUv)':'vec4(1.,1.,0.,0.)'};
    vec3 mfN=t107N,mfV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    mat3 mfTbn=${q<2&&normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    ${q<2&&normal?`vec3 mfDecoded=mf1.xyz*2.-1.;mfDecoded.xy*=${f(intensity[0])};mfN=mfTbn*normalize(mfDecoded);`:''}
    vec3 mfAlbedo=mf0.rgb,mfEmission=${num('BaseEmis',0)}*pow(mf0.rgb,vec3(1.2))*${num('EmissiveValue',1)};
    ${q<2?`
     vec2 mfOffset=normalize(transpose(mfTbn)*mfV).xy*${f(spark[3])};
     float mfNoise1=pow(texture2D(mfTex3,mfUv*${num('SparkTiling',1)}+neoTime*vec2(.02)+mfOffset).r,${f(spark[1])});
     float mfNoise2=pow(texture2D(mfTex3,mfUv*${num('SparkTiling',1)}*1.2+neoTime*vec2(-.005)).r,${f(spark[1])});
     float mfSpark=clamp(mfNoise1-${f(spark[2])},0.,1.)*clamp(mfNoise2-${f(spark[2])},0.,1.);
     vec4 mfMasks=texture2D(mfTex3,mfUv);
     float mfFlowNoise=pow(texture2D(mfTex4,mfUv*5.+neoTime*vec2(.1,-.3)).g,.7);
     vec3 mfFlow2=mfHue(mfFlowNoise)*mfMasks.g*smoothstep(.4,1.,mfFlowNoise);
     float mfNoise=texture2D(mfTex4,mfUv*3.+neoTime*vec2(.08)).g;mfNoise=mfNoise*mfNoise*2.;
     vec3 mfTempN=normalize(mfN+vec3(mfNoise*.5,mfNoise*.4,0.));
     float mfNDV=abs(dot(mfTempN,mfV)),mfHueValue=pow(smoothstep(.8,1.,mfNDV),10.);
     vec3 mfFlow=mfLinear(mfHue(mfHueValue))*mfHueValue;
     vec3 mfViewN=mat3(viewMatrix)*(mfN*vec3(-1.,1.,1.)),mfViewV=normalize(vViewPosition);
     vec3 mfViewT=normalize(cross(mfViewV,vec3(0.,1.,0.))),mfViewB=normalize(cross(mfViewV,mfViewT));
     vec2 mfCapUv=vec2(dot(mfViewN,mfViewT),dot(mfViewN,mfViewB))*.5+.5;
     vec3 mfCap=texture2D(mfTex5,mfCapUv).rgb;mfCap=mfCap*mfCap*pow(smoothstep(.2,1.,mfNDV),3.);
     float mfSparkMask=smoothstep(${f(mask[1])},${f(mask[2])},pow(mf1.a,${f(mask[0])}));
     vec3 mfSparkLight=mfSpark*${f(spark[0])}*pow(mf0.rgb,vec3(1.5))*mfSparkMask;
     vec3 mfTail=mf2.a*pow(mf0.rgb,vec3(1.2))*${num('TailMult',0)}*((sin(neoTime)+1.)*.25+.5)*${col('TailColor')};
     mfEmission+=mfSparkLight+mfFlow*${num('HUEStrength',0)}+mfFlow2*${num('HUE02Strength',0)}+mfCap*mix(.3,1.,mfMasks.b)+mfTail;
    `:''}
    diffuseColor=vec4(mfAlbedo,clamp(pow(mf0.a,.8)+${num('fishTailAlpha',0)},0.,1.)*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(mfN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=mf2.g;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=mf2.b;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=mfEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=mf2.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),mf2.r,material.roughness);
     #endif`);
  };
  return u;
 }catch(e){warnings.push('Mounts-fish remains unsupported: '+e.message);return null;}
}
