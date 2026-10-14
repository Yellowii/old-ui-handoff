import * as THREE from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Native unlit base/layer passes. Negative-base fractional pow remains unresolved;
// the caller keeps its existing, explicitly labelled preview for those materials.
export async function configureDongdongFur(m,p,macros,load,warnings,o,layer,step){
 const owned=[];
 try{
  const scale=scalar(p.FresnelScale01,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),q=scalar(macros.RENDER_QUALITY,0);
  if(![0,1].includes(change)||![0,1,2].includes(q))throw Error('Unknown source permutation');
  if(!change&&scale<1)throw Error('Negative-base source pow semantics unresolved');
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(v=>v!==0))throw Error('Active soft body unresolved');
  const n=(k,d)=>f(scalar(p[k],d)),color=(k,d=[1,1,1,1])=>rgb(vector(p[k],d));
  const intensity=vector(p.Intensity,[1,1,1,0]);
  const base=await load('Tex0',false,o.baseColor),noise=await load('Tex1',false);
  if(!base?.isTexture||!noise?.isTexture||base.isCubeTexture||noise.isCubeTexture)throw Error('Missing original texture');
  const sampler=(texture,wrap)=>{const t=texture.clone();t.wrapS=t.wrapT=wrap;t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;owned.push(t);return t;};
  const u={neoFurStep:{value:step},neoFaceOffset:{value:scalar(p.FaceUVOffset,0)},neoFurBase:{value:sampler(base,layer?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping)},neoFurTex:{value:sampler(noise,THREE.RepeatWrapping)}};
  setup(m,false);m.side=THREE.FrontSide;
  if(layer&&o.sourceSurface.endsWith('fur1.surf')){m.transparent=true;m.blending=THREE.NormalBlending;m.depthWrite=true;m.depthTest=true;m.depthFunc=THREE.LessEqualDepth;}
  m.addEventListener('dispose',()=>owned.forEach(t=>t.dispose()));
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,false);
   s.vertexShader='uniform float neoFurStep;uniform sampler2D neoFurBase;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>
    transformed+=objectNormal*${n('FurLength',1)}*neoFurStep*textureLod(neoFurBase,uv,0.).a;`);
   s.fragmentShader='uniform float neoFurStep,neoFaceOffset;uniform sampler2D neoFurBase,neoFurTex;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 furUv=t107Uv;furUv.x+=furUv.y<.25?neoFaceOffset*${n('CharOffset',1)}:0.;
    vec4 furBase=texture2D(neoFurBase,furUv);
    vec3 furN=t107N,furView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float furDotLight=0.;
    #if NUM_DIR_LIGHTS > 0
     vec3 furLight=inverseTransformDirection(directionalLights[0].direction,viewMatrix)*vec3(-1.,1.,1.);
     furDotLight=dot(normalize(furN),furLight);
    #endif
    float furRamp=${n('gradValue',.8)}+clamp(furDotLight*.5,0.,1.)*2.*(1.-${n('gradValue',.8)});
    vec3 furColor=furBase.rgb*furRamp;
    float furAlpha=texture2D(neoFurTex,furUv).a;
    ${layer?`
     float furOcclusion=clamp(pow(neoFurStep,${n('OcclusionPower',1)})*2.,0.,1.);
     ${change?'':`float furEdge=clamp(pow(${f(scale)}-dot(furN,furView),${n('FresnalPower',1)}),0.,1.)*furOcclusion;
      vec3 furDiffuse=${color('BaseColor01')}*${n('BaseColor01Intensity',1)}*clamp(furDotLight*.5+.5+neoFurStep+1.,0.,1.);
      vec3 furShell=furDiffuse*mix(${color('OccluColor')},vec3(1.),furOcclusion)*mix(furBase.rgb,${color('RimColor01')}*5.,clamp(furEdge,0.,1.))*furColor;
      furColor=mix(furColor,furShell,clamp(furBase.a,0.,1.));`}
     float furMask=texture2D(neoFurTex,furUv*${n('NoiseTiling',1)}+vec2(${n('offsetX',1)},${n('offsetY',1)})*neoFurStep).r;
     furAlpha=pow(clamp(furMask-neoFurStep*${n('FurRadius',1)}*furBase.a,0.,1.)*furBase.a,${n('MaskPower',1)});
    `:''}
    ${change?`vec3 furTint=dot(furBase.rgb,vec3(.2125,.7154,.0721))*${color('BaseColor')};
     furColor=${layer?(q===2?'furTint*furTint':'pow(max(furTint,vec3(0.)),vec3(2.2))'):'furTint'}*${n('TintValue',1)};`:''}
    ${layer?`float furX=1.-dot(furN,furView),furX2=furX*furX;
     furColor+=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*furX2*furX2*furX,0.,1.)*${color('RimColor',[0,0,0,0])}*${f(intensity[3])};`:''}
    diffuseColor=vec4(0.,0.,0.,opacity*furAlpha);
   `).replace('#include <color_fragment>','')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=furColor;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('DongDong绒毛原无光照颜色/渐变/自遮蔽已接入；方向使用当前主光，原场景精确对照未验。');return u;
 }catch(e){owned.forEach(t=>t.dispose());warnings.push('DongDong绒毛颜色未完整适配，保留既有预览：'+e.message);return null;}
}
