import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSpecular,sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';

// shader/surf/s25/standard_diamond_metal.hlsl. The authored shader is a
// textured metal/diamond pass; active normal mapping requires original tangents.
export async function configureDiamondMetal(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),alphaTest=scalar(macros.ALPHA_TEST_ENABLE,0),high=q<2,on=high&&normal===1;
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(alphaTest))throw Error('Unknown source macro');
  if(alphaTest)throw Error('Original dissolve world-height program required');
  if(on&&!o.sourceTangents)throw Error('Original tangent basis required');
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','ALPHA_TEST_ENABLE','LIGHT_ENABLE']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active source macro');
  const n=(k,d=0)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d),c=(k,d=[1,1,1,1])=>rgb(v(k,d));
  const base=v('BaseColor',[1,1,1,1]),em=v('EmissiveColor',[0,0,0,0]),inten=v('Intensity',[1,1,1,0]),dp=v('DiamondParam',[1,1,1,.6]);
  const add=v('addPara',[1,1,1,0]),pointKey=n('PointKey',0);
  if(add[0]<0||add[1]<0||inten[3]<0||![0,1].includes(pointKey))throw Error('Undefined source power input');
  const keys=['Tex0',...(high?['Tex1','Tex2','Tex3','Tex4',...(pointKey?['Tex5']:[])]:[])],u={};
  for(const k of keys){const t=await load(k,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing original '+k);u['dm'+k]={value:t};}
  setup(m,on);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,on);
   s.fragmentShader=`uniform sampler2D dmTex0,dmTex1,dmTex2,dmTex3,dmTex4,dmTex5;
    vec3 dmLinear(vec3 x){return ${high?'pow(max(x,vec3(0.0)),vec3(2.2))':'x*x'};}
    vec3 dmHsv(vec3 x){vec3 h=clamp(vec3(abs(x.x*6.-3.)-1.,2.-abs(x.x*6.-2.),2.-abs(x.x*6.-4.)),0.,1.);return ((h-1.)*x.y+1.)*x.z;}
   `+s.fragmentShader;
   const tbn=on?'mat3 dmTbn=mat3(t107T,t107B,t107N);':'mat3 dmTbn=mat3(1.);';
   const body=`vec4 dmA=texture2D(dmTex0,t107Uv);dmA.rgb=dmLinear(dmA.rgb);vec4 dmM=vec4(1.,.5,0.,0.),dmNTex=vec4(.5,.5,1.,1.),dmDTex=vec4(0.);vec3 dmN=t107N;vec3 dmMat=vec3(0.);float dmMask=0.;float dmPoint=0.;vec3 dmV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${high?`${tbn}vec3 dmTv=normalize(vec3(dot(dmTbn[0],dmV),dot(dmTbn[1],dmV),dot(dmTbn[2],dmV)));vec2 dmOff=dmTv.xy/dmTv.z;
     vec2 dmDiamondUv=t107Uv*vec2(${f(dp[0])},${f(dp[1])})+vec2(.2,.1)-dmOff*.1;
     dmNTex=texture2D(dmTex1,t107Uv);dmNTex.xyz=dmNTex.xyz*2.-1.;dmDTex=texture2D(dmTex3,dmDiamondUv);dmDTex.xyz=dmDTex.xyz*2.-1.;
     vec3 dmBlend=normalize(vec3(dmNTex.xy+dmDTex.xy*${f(dp[2])},dmNTex.z*dmDTex.z));dmBlend=mix(dmBlend,dmNTex.xyz,dmNTex.a);dmBlend.xy*=${f(inten[0])};dmN=dmTbn*normalize(dmBlend);dmM=texture2D(dmTex2,t107Uv);
     dmMask=mix(dmNTex.a,dmM.b,${f(n('MetalnessMask',0))});
     vec3 dmViewN=mat3(viewMatrix)*(dmN*vec3(-1.,1.,1.))*vec3(1.,1.,-1.),dmViewV=normalize(vViewPosition)*vec3(1.,1.,-1.);
     vec3 dmViewT=normalize(cross(dmViewV,vec3(0.,1.,0.))),dmViewB=normalize(cross(dmViewV,dmViewT));vec2 dmCapUv=vec2(dot(dmViewN,dmViewT),dot(dmViewN,dmViewB))*.5+.5;
     dmMat=dmLinear(texture2D(dmTex4,dmCapUv).rgb)*dmMask;dmMat=mix(dmA.rgb*${c('BaseColor',base)},dmMat,dmM.a);dmA.rgb=mix(dmA.rgb,vec3(0.),dmMask);
     ${pointKey?`float dmSparkOffset=dmOff.x*.2*dmA.a;dmPoint=pow(saturate(texture2D(dmTex5,t107Uv*2.-dmSparkOffset).r*texture2D(dmTex5,t107Uv*1.5).r),5.);`:''}`:''}
    vec3 dmBase=pow(dmA.rgb,vec3(${f(add[0])}))*${f(n('TintValue',1))};diffuseColor=vec4(dmBase,dmA.a*opacity);`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body)
    .replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(dmN*vec3(-1.,1.,1.)));`)
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'.5':`clamp(dmM.g*${f(inten[1])},0.,1.)`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':`clamp(dmM.b*${f(inten[2])},0.,1.)`};`)
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=${q===2?'1.':'dmM.r'};
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),${q===2?'1.':'dmM.r'},material.roughness);
     #endif`)
    .replace('#include <lights_physical_fragment>',sourceSpecular('.5',sourceGrazing))
    .replace('#include <emissivemap_fragment>',`float dmNoV=clamp(1.-dot(dmN,dmV),0.,1.),dmF=pow(dmNoV,5.);
     float dmH=fract(dmNoV*${f(n('DiamondH',2))})*${f(n('DiamondHmax',1))}+${f(n('DiamondHmin',0))};
     vec3 dmDiamond=dmHsv(vec3(dmH,${f(n('DiamondS',.5))},clamp(${f(n('DiamondV',1))}-dmNoV,0.,1.)))*pow(dmM.a,2.)*${f(n('DiamondIntensity',2))};
     vec3 dmE4=dmA.rgb*dmM.a*dmDTex.a*(1.-dmNTex.a)*${f(inten[3])};
     vec3 dmEm=mix(dmDiamond,dmA.rgb,${f(dp[3])})*(1.-dmNTex.a)*${f(1-pointKey)}+dmPoint*${c('EmissiveColor',em)}*${f(n('PointIntensity',0))}+dmMat*(getShadowMask()*.2+.8)*${f(n('MetalnessIntensity',1))}*mix(1.,dmA.a,${f(n('MetalLightMask',0))})+pow(dmE4,vec3(${f(add[1])}))*${f(add[2])}+dmF*${c('FresenlColor',[0,0,0,1])}*${f(n('FresenlIntensity',0))}*dmNTex.a;totalEmissiveRadiance=dmEm;`);
   s.fragmentShader=s.fragmentShader.replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
   sourceIsotropy(s,{quality:q,smoothDiffuse:false,light:scalar(macros.LIGHT_ENABLE,1)===1});
  };
  warnings.push(`standard_diamond_metal: Tex0-Tex4、DiamondNormal、MatCap、金属/钻石发光已接入；源TBN；完整原场景光照仍待校准`);return u;
 }catch(e){warnings.push('standard_diamond_metal remains unsupported: '+e.message);return null;}
}
