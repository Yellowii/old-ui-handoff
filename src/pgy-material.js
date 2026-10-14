import * as THREE from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneLightWarning} from './source-scene-light.js';

export async function configurePgy(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),change=scalar(macros.CHAR_CHANGE_COLOR,0),layer=o.pgyFurStep!==undefined;
  if(![0,1,2].includes(q)||![0,1].includes(change))throw Error('Unknown source macro');
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body deformation unresolved');
  const num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d)),intensity=vector(p.Intensity,[1,1,1,0]);
  const keys=[0,1,4,5],maps=await Promise.all(keys.map(i=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing source Tex0/1/4/5');
  // Tex0 uses the source clamp sampler; avoid mutating a texture shared by another material.
  const clamped=maps[0].clone();clamped.wrapS=clamped.wrapT=THREE.ClampToEdgeWrapping;clamped.needsUpdate=true;maps[0]=clamped;
  const u={neoPgyStep:{value:layer?scalar(o.pgyFurStep,0):0}};keys.forEach((k,i)=>u['pgyTex'+k]={value:maps[i]});setup(m,false);
  if(layer)m.side=THREE.FrontSide; // DrawCall CullMode="Back".
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,false);
   if(layer)s.vertexShader='uniform sampler2D pgyTex4;uniform float neoPgyStep;\n'+s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>\ntransformed+=objectNormal*${num('FurLength',1)}*neoPgyStep*textureLod(pgyTex4,uv,0.).a;`);
   s.fragmentShader=`uniform sampler2D pgyTex0,pgyTex1,pgyTex4,pgyTex5;uniform float neoPgyStep;
    vec3 pgyLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
   `+s.fragmentShader;
   let body=`vec3 pgyV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float pgyDot=dot(t107N,pgyV),pgyF=clamp(${num('FresnelScale',0)}+(1.-${num('FresnelScale',0)})*pow(clamp(1.-pgyDot,0.,1.),5.),0.,1.);
    vec3 pgyEmission=vec3(0.);float pgyAlpha=1.;
   `;
   if(layer)body+=`
    vec2 pgyUv=t107Uv;pgyUv.x+=pgyUv.y<.25?${num('FaceUVOffset',0)}*${num('CharOffset',1)}:0.;
    vec4 pgyLerp=texture2D(pgyTex5,pgyUv);pgyLerp.rgb=pgyLinear(pgyLerp.rgb);
    float pgyAO=clamp(pow(max(neoPgyStep,0.),${num('OcclusionPower',1)})*2.,0.,1.),pgyAOA=clamp(pow(max(neoPgyStep,0.),${num('OcclusionPowerA',1)})*2.,0.,1.);
    vec3 pgyOcclusion=mix(mix(${col('OccluColor')},vec3(1.),pgyAO),mix(${col('OccluColorA')},vec3(1.),pgyAOA),pgyLerp.a);
    vec3 pgyN=normalize(t107N),pgyLight=-${sourceSceneSunGlsl()};
    float pgyRim=clamp(pow(max(${num('FresnelScale01',1)}-dot(pgyN,pgyV)*2.,0.),${num('FresnalPower',1)}),0.,1.);
    float pgyLambert=dot(pgyN,pgyLight)*.5+.5,pgyRamp=${num('gradValue',.8)}+clamp(pgyLambert-.5,0.,1.)*2.*(1.-${num('gradValue',.8)});
    float pgyBack=.2-dot(pgyV,pgyLight);pgyBack=mix(.5,2.,clamp(pgyBack*pgyBack,0.,1.));
    vec3 pgyColor=mix(pgyLerp.rgb,${col('RimColor01')}*${num('BaseColor01Intensity',1)}*pgyBack,pgyRim)*${num('test01',1)}*pgyOcclusion*pgyRamp;
    float pgyA=clamp(texture2D(pgyTex4,pgyUv*${num('NoiseTiling',1)}).r-neoPgyStep*${num('FurRadius',1)},0.,1.);
    float pgyB=clamp(texture2D(pgyTex4,pgyUv*${num('NoiseTilingA',1)}).g-neoPgyStep*${num('FurRadius',1)},0.,1.);
    pgyAlpha=mix(pow(max(pgyA,.0001),${num('MaskPower',1)}),pow(max(pgyB,.0001),${num('MaskPowerA',1)}),pgyLerp.a);
    pgyEmission=${change?`pgyLinear(vec3(dot(pgyColor,vec3(.2125,.7154,.0721)))*${col('BaseColor')})*${num('TintValue',1)}+vec3(pgyF)+pgyF*${col('RimColor',[0,0,0,0])}*${num('EmissionIntensity',.8)}`:`pgyColor+vec3(pgyF*${num('EmissionIntensity',.8)})+pgyF*${col('RimColor',[0,0,0,0])}*${f(intensity[3])}`};
   `;
   else if(q<2)body+=`
    float pgyNdotV=clamp(pgyDot,0.,1.),pgyFA=clamp((.9-pgyNdotV)*8.,0.,1.),pgyFB=clamp(pow(clamp(pgyNdotV-.9,0.,1.),.4)*3.,0.,1.);
    float pgyOp=mix(${num('frOp',0)},1.,mix(pgyFB,.5,pgyFA));
    vec4 pgyMask=texture2D(pgyTex1,t107Uv);
    float pgyHalf=1.-dot(pgyV,-${sourceSceneSunGlsl()})-(${num('gradValuetex0',.8)});pgyHalf=clamp(pgyHalf*pgyHalf,0.,1.);
    vec3 pgyViewN=mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.));vec2 pgyXY=pgyViewN.xy*inversesqrt(max(dot(pgyViewN,pgyViewN),.000001));
    float pgyAngle=${num('BillboardSpin',0)}*(3.141592653589793/180.),pgySin=sin(pgyAngle),pgyCos=cos(pgyAngle);
    vec2 pgyMatUv=vec2(pgyXY.x*pgyCos-pgyXY.y*pgySin,pgyXY.x*pgySin+pgyXY.y*pgyCos)*(.5*${num('CenterScale',1)})+.5;
    vec3 pgyTex=pgyLinear(texture2D(pgyTex0,pgyMatUv).rgb)*${num('EmissiveIntensity',1)}*(1.-pgyMask.a)*mix(${num('FrontLight',.8)},${num('BackLight',1.2)},pgyHalf);
    float pgyBlend=texture2D(pgyTex1,t107Uv*${num('tilingB',10)}).r;
    pgyAlpha=mix(clamp(pgyOp,0.,1.)*pgyBlend,1.,pgyMask.a);
    pgyEmission=pgyTex+mix(${col('BaseColorA')},${col('BaseColorB')}*2.,pgyBlend)*${num('TintValue',1)}+pgyF*${col('RimColor',[0,0,0,0])}*${f(intensity[3])};
   `;
   else body+=`pgyEmission=vec3(.7+.3*${num('TintValue',1)})+pgyF*${col('RimColor',[0,0,0,0])}*${f(intensity[3])};`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body+'\ndiffuseColor=vec4(0.,0.,0.,pgyAlpha*opacity);').replace('#include <color_fragment>','')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=pgyEmission;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('pgy complete base/shell source channels; '+sourceSceneLightWarning);return u;
 }catch(e){warnings.push('pgy remains unsupported: '+e.message);return null;}
}
