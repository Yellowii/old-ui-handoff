import * as THREE from 'three';
import {previewShadowUniforms,bindPreviewShadow} from './scene-material-shadow.js';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

export async function configureYcymvHair(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1),ugc=scalar(macros.ENABLE_UGC_COLOR,0),tbn=q<2&&normal===1;
  if(![0,1,2].includes(q)||[normal,change,ugc].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  const shadow=scalar(p.Shadow,0);
  if(tbn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  for(const k of ['INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'])if(scalar(macros[k],0)!==0)throw Error('Unsupported active '+k);
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body unresolved');
  const n=(k,d=1)=>f(scalar(p[k],d)),v=(k,d)=>vector(p[k],d),col=(k,d=[1,1,1,1])=>rgb(v(k,d)),intensity=v('Intensity',[1,1,1,0]);
  const u={neoTime:{value:0},...previewShadowUniforms()},keys=['Tex0',...(q<2?['NoiseTex','matcapTex','ColorBampTex',...(tbn?['Tex1']:[])]:[])];
  for(const k of keys){const t=await load(k,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+k);u['yh'+k]={value:t};}
  setup(m,tbn);m.side=THREE.FrontSide;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,tbn);bindPreviewShadow(s);
   s.fragmentShader=`uniform sampler2D yhTex0,yhTex1,yhNoiseTex,yhmatcapTex,yhColorBampTex;uniform float neoTime;
    vec3 yhLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    float yhPow5(float x){float a=x*x;return a*a*x;}
   `+s.fragmentShader;
   let body=`vec2 yhUv=t107Uv;yhUv.x+=yhUv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset')}:0.;
    vec4 yhBase=texture2D(yhTex0,yhUv);yhBase.rgb=yhLinear(yhBase.rgb);
    ${change?`yhBase.rgb=vec3(dot(yhBase.rgb,vec3(.2125,.7154,.0721)))*yhLinear(${col('BaseColor')})*${n('TintValue')};`:ugc?`float yhArea=step(yhBase.a,.35)-step(yhBase.a,.3);yhBase.rgb=mix(yhBase.rgb,yhLinear(yhArea*${col('Color7')}),yhArea)*${n('TintValue')};`:''}
    vec3 yhN=t107N,yhV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);float yhDecal=0.;
    ${tbn?`vec4 yhNormalMap=texture2D(yhTex1,yhUv);yhDecal=yhNormalMap.a;vec3 yhSample=yhNormalMap.xyz*2.-1.;yhSample.xy*=${f(intensity[0])};yhN=mat3(t107T,t107B,t107N)*normalize(yhSample);`:''}
    vec3 yhBasePow=pow(yhBase.rgb,vec3(${n('BasecolorPow')})),yhEmission=yhBasePow*${n('BasecolorMult')};
   `;
   if(q<2)body+=`float yhNoV=max(0.,dot(yhV,yhN)),yhRim=clamp(-.1+(1.-yhNoV)*(1.-yhNoV),0.,1.);
    vec3 yhTangentV=normalize(${tbn?'vec3(dot(t107T,yhV),dot(t107B,yhV),dot(t107N,yhV))':'yhV'});
    float yhDistort=texture2D(yhNoiseTex,yhUv*8.+neoTime*vec2(.1,.15)).b;
    vec2 yhFlowUv=yhUv*8.+neoTime*vec2(${n('FlowNoiseSpeedX',0)},${n('FlowNoiseSpeedY',0)})+yhDistort*.25+yhTangentV.xy*.1;
    float yhFlow=texture2D(yhNoiseTex,yhFlowUv).g,yhBack=texture2D(yhNoiseTex,yhUv).a,yhFront=1.-yhBack;
    vec3 yhMatNormal=mix(t107N,yhN,${n('MatcapNormalKey')});
    vec3 yhViewN=mat3(viewMatrix)*(yhMatNormal*vec3(-1.,1.,1.)),yhViewV=mat3(viewMatrix)*(yhV*vec3(-1.,1.,1.));
    vec3 yhViewT=normalize(cross(yhViewV,vec3(0.,1.,0.))),yhViewB=normalize(cross(yhViewV,yhViewT));
    vec2 yhMatUv=vec2(dot(yhViewN,yhViewT),dot(yhViewN,yhViewB))*.5+.5;
    vec3 yhMatPow=pow(texture2D(yhmatcapTex,yhMatUv).rgb,vec3(${n('MatcapColorPow')}));
    vec4 yhBamp=texture2D(yhColorBampTex,yhUv);yhBamp.rgb=yhLinear(yhBamp.rgb);
    float yhInverseMask=1.-yhBase.a;
    yhEmission+=yhBasePow*(yhRim*yhFront*pow(yhInverseMask,${n('FrontHairRimPow')})*${n('FrontRimMult')}
     +yhFront*pow(yhInverseMask,${n('FrontHairEndPow')})*${n('FrontEndMult')}
     +yhRim*yhBack*pow(yhInverseMask,${n('BackHairRimPow')})*${n('BackRimMult')}
     +yhBack*pow(yhInverseMask,${n('BackHairEndPow')})*${n('BackEndMult')}+yhDecal*${n('DecalEmisMult')});
    float yhMatFresnel=mix(1.-yhBamp.a,pow(yhRim,${n('MatcapFresnelPow')}),${n('MatcapFresnelKey')});
    yhEmission+=yhMatPow*yhMatFresnel*${n('MatcapEmisMult')};
    yhEmission+=clamp(pow(yhFlow,1.5)*(1.-yhRim),0.,1.)*(yhFront*yhBase.a+yhBack*yhBase.a*yhBase.a);
    // Source adds RotateAboutAxis's displacement back to the original color.
    vec3 yhAxis=normalize(vec3(1.)),yhClosest=yhAxis*dot(yhAxis,yhBamp.rgb),yhU=yhBamp.rgb-yhClosest;
    vec3 yhRotated=yhClosest+yhU*cos(neoTime)+cross(yhAxis,yhU)*sin(neoTime);
    yhEmission=mix(yhEmission,yhRotated,yhBamp.a*${n('BampLerpMult')});
   `;
   body+=`float yhFresnel=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*yhPow5(1.-dot(yhN,yhV)),0.,1.);
    yhEmission=(yhEmission+yhFresnel*${col('RimColor',[0,0,0,0])}*${f(intensity[3])})*${n('TintValue')};
    diffuseColor=vec4(0.,0.,0.,${ugc?'1.':'yhBase.a'}*${f(v('BaseColor',[1,1,1,1])[3])});
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=mat3(viewMatrix)*(yhN*vec3(-1.,1.,1.));')
    .replace('#include <emissivemap_fragment>',`totalEmissiveRadiance=yhEmission*(neoPreviewShadow()*${f(shadow)}+1.-${f(shadow)});`)
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('ycymv_hair原五图发光/流动/旋转颜色与阴影混合已接入；当前几何阴影不等于原CSM/圆盘影/淡出，half与完整场景仍未等价。');return u;
 }catch(e){warnings.push('ycymv_hair remains unsupported: '+e.message);return null;}
}
