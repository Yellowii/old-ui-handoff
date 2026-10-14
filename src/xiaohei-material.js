import {sourceSpecular} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
import * as THREE from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneLightWarning} from './source-scene-light.js';
import {sourceValueNoise} from './source-value-noise.js';
export async function configureXiaohei(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),change=scalar(macros.CHAR_CHANGE_COLOR,1),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  // The source default_functions path initializes diffuse to white unless
  // IA_VERTEX_COLOR is explicitly enabled. Treat an omitted macro as 0 so
  // models without COLOR_0 follow the original default instead of being
  // rejected by the conversion guard.
  const ia=scalar(macros.IA_VERTEX_COLOR,0),uv1=scalar(macros.TEXCOORD1_ENABLE,0),lm=scalar(macros.LIGHT_MAP_ENABLE,0),outline=o.xhOutline===true;
  const light=scalar(macros.LIGHT_ENABLE,1);
  if(![0,1,2].includes(q)||[change,normal,ia,uv1,lm,light].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  for(const k of ['USE_SKIN_LUT','USE_ANISOTROPIC_SPECULAR','USE_SPECULAR_COLOR'])if(scalar(macros[k],0)!==0)throw Error('Original alternate direct lighting branch not connected');
  for(const k of ['INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','NEOX_METAL'])if(scalar(macros[k],0)!==0)throw Error('Unsupported active '+k);
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body unresolved');
  const n=(k,d)=>f(scalar(p[k],d)),v=(k,d)=>vector(p[k],d),col=(k,d=[1,1,1,1])=>rgb(v(k,d));
  const moving=q<2&&(scalar(p.VertexOffsetBase,0)!==0||scalar(p.VertexOffsetGlitch,0)!==0),expand=outline&&scalar(p.OutlineWidth,3)!==0;
  const tbn=!outline&&q<2&&normal===1,color=ia===1&&(moving||expand),second=moving&&uv1===1;
  if(tbn&&!o.sourceTangents)throw Error('Missing source tangent basis');
  if(color&&!o.sourceVertexColors)throw Error('Missing source COLOR0');
  if(moving&&lm)throw Error('Active LIGHT_MAP vertex transform unresolved');
  if(second&&!o.sourceSecondUv)throw Error('Missing source UV1');
  const keys=outline?(q<2?['Tex3']:[]):q<2?['Tex0',...(normal?['Tex1']:[]),'Tex2','Tex3','Tex4']:['Tex0'];
  const u={neoTime:{value:0},xhRTSize:{value:new THREE.Vector4(1,1,1,1)}};
  for(const k of keys){const t=await load(k,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+k);u['xh'+k]={value:t};}
  setup(m,tbn);if(outline)m.side=THREE.BackSide;
  const size=new THREE.Vector2();
  m.onBeforeRender=r=>{const target=r.getRenderTarget();if(target){const scale=2**r.getActiveMipmapLevel();size.set(Math.max(1,Math.floor(target.width/scale)),Math.max(1,Math.floor(target.height/scale)));}else r.getDrawingBufferSize(size);u.xhRTSize.value.set(size.x,size.y,1/size.x,1/size.y);};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,tbn);
   const vary='varying vec3 xhLocal,xhCenterView;varying float xhCenterDistance;\n';
   let offset='vec3 xhPosition=transformed*vec3(-1.,1.,1.);\n';
   if(q<2&&(moving||outline)){
    offset+=`vec2 xhSecond=${second?'uv1':'vec2(0.)'};float xhRed=${color?'color.r':'1.'};
     float xhA=clamp(neoSourceNoise(xhSecond*3.+floor(neoTime*3.6+.5)),0.,1.)*.1;
     float xhRotation=floor(neoTime*2.5+.5);
     vec3 xhBase=(vec3(.03*sin(xhRotation),0.,.03*cos(xhRotation))+vec3(sin(xhPosition.x*4.+xhRotation)*.03,0.,0.)+vec3(xhA))*${n('VertexOffsetBase',0)};
    `;
    if(outline)offset+=`xhPosition+=xhBase*xhRed;
     float xhB=(floor(neoSourceNoise(uv*5.+floor(neoTime*6.))*5.+.5)-2.5)*${n('OutlineNoiseOffsetStr',.01)};xhPosition+=vec3(xhB);
    `;
    offset+=`float xhT=floor(-neoTime*12.)+xhPosition.y*7.;
     vec3 xhGlitch=vec3((floor(10.*(sin(xhT)+1.)+.5)-10.)*.02,0.,(floor(10.*(sin(xhT+.5)+1.)+.5)-10.)*.02)*neoSourceNoise(xhSecond*6.+floor(neoTime*12.+.5));
     xhGlitch=floor(xhGlitch*6.5+.5)/6.5*.25*${n('VertexOffsetGlitch',0)};
     xhPosition+=${outline?`xhGlitch*xhRed*${n('VertexOffsetGlitch',0)}`:'(xhBase+xhGlitch)*xhRed'};
    `;
   }
   if(expand)offset+=`float xhDistance=length(cameraPosition-(modelMatrix*vec4(xhPosition*vec3(-1.,1.,1.),1.)).xyz);
    xhPosition+=objectNormal*vec3(-1.,1.,1.)*.01*${n('OutlineWidth',3)}*mix(.1,1.,clamp(xhDistance/10.,0.,1.))*${color?'color.a':'1.'};
   `;
   offset+=`transformed=xhPosition*vec3(-1.,1.,1.);xhLocal=xhPosition;
    vec3 xhWorld=(modelMatrix*vec4(transformed,1.)).xyz;
    xhCenterView=mat3(viewMatrix)*(xhWorld-modelMatrix[3].xyz);
    xhCenterDistance=length(cameraPosition-modelMatrix[3].xyz);
   `;
   s.vertexShader=vary+`uniform float neoTime;${color?'attribute vec4 color;':''}${second?'attribute vec2 uv1;':''}\n`+(q<2?sourceValueNoise:'')+s.vertexShader.replace('#include <skinning_vertex>','#include <skinning_vertex>\n'+offset);
   s.fragmentShader=vary+`uniform sampler2D xhTex0,xhTex1,xhTex2,xhTex3,xhTex4;uniform float neoTime;uniform vec4 xhRTSize;
    vec3 xhLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    float xhPow5(float x){float y=x*x;return y*y*x;}
   `+(q<2?sourceValueNoise:'')+s.fragmentShader;
   let body=`vec3 xhV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 xhN=t107N;vec3 xhEmission=vec3(0.);float xhMask=0.,xhMaskLight=0.;
   `;
   if(outline){
    body+=`vec3 xhViewNormal=normalize(mat3(viewMatrix)*(normalize(t107N)*vec3(-1.,1.,1.)));
     vec3 xhWeights=clamp(vec3(-xhViewNormal.x,xhViewNormal.x,xhViewNormal.y),0.,1.);
     vec3 xhColor=(${col('OutlineColorLeft',[.4,.2,.9,1])}*xhWeights.x+${col('OutlineColorRight',[1,.85,.2,1])}*xhWeights.y+${col('OutlineColorTop',[.5,.9,1,1])}*xhWeights.z)/max(xhWeights.x+xhWeights.y+xhWeights.z,.001);
     float xhAlpha=mix(1.,.6,clamp(dot(normalize(t107N),xhV),0.,1.));
    `;
   }else{
    body+=`vec2 xhUv=t107Uv;xhUv.x+=xhUv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset',1)}:0.;
     vec4 xh0=texture2D(xhTex0,xhUv);xh0.rgb=xhLinear(xh0.rgb);
     ${change?`xh0.rgb=vec3(dot(xh0.rgb,vec3(.2125,.7154,.0721)))*xhLinear(${col('BaseColor')})*${n('TintValue',1)};`:`xh0.rgb*=${n('TintValue',1)};`}
     float xhAlpha=xh0.a*${f(v('BaseColor',[1,1,1,1])[3])};
    `;
    if(tbn)body+=`vec3 xhTangentN=texture2D(xhTex1,xhUv).xyz*2.-1.;xhTangentN.xy*=${f(v('Intensity',[1,1,1,0])[0])};xhN=mat3(t107T,t107B,t107N)*normalize(xhTangentN);\n`;
   }
   if(q<2){
    body+=`float xhNdotL=dot(t107N,${outline?'-'+sourceSceneSunGlsl():`normalize(mix(-${sourceSceneSunGlsl()},${col('SunOverrideDir',[1,1,0])},${n('SunOverrideEnable',0)}))`})*.5+.5;
     vec2 xhAspect=vec2(xhRTSize.x/xhRTSize.y,1.);
     vec2 xhScreen=gl_FragCoord.xy*xhRTSize.zw*xhAspect;
     vec2 xhScreenUv=(xhScreen-.5*xhAspect)*mix(1.,log2(max(xhCenterDistance*.1,1.)+1.),${n('EnableTilingByDistance',0)})*${outline?n('OutlineHalftoneTiling',24):n('HalftoneTiling',6)};
     float xhPattern=texture2D(xhTex3,xhScreenUv).r;
     float xhMaskScale=${outline?'1.5':`texture2D(xhTex3,xhCenterView.xy+floor(neoTime+.5)*.1).b`};
     xhMask=clamp(xhPattern*smoothstep(1.-${n('HalftoneDarkThreshold',.4)},1.-${n('HalftoneDarkThreshold',.4)}+.5,1.-xhNdotL)*xhMaskScale,0.,1.);
     xhMaskLight=clamp(xhPattern*smoothstep(1.-${n('HalftoneBrightThreshold',.6)},1.-${n('HalftoneBrightThreshold',.6)}+.5,1.-xhNdotL)*xhMaskScale,0.,1.);
    `;
   }
   if(outline)body+=`xhEmission=mix(xhColor*${n('OutlineEmissiveIntensity',2)},${col('OutlineHalftoneColor',[0,0,0,0])},max(xhMaskLight,xhMask));diffuseColor=vec4(0.,0.,0.,xhAlpha*opacity);\n`;
   else if(q<2){
    const intensity=v('Intensity',[1,1,1,0]),flow=v('FlowTiling',[6,3]);
    body+=`vec4 xhMix=texture2D(xhTex2,xhUv);
     vec3 xhViewV=mat3(viewMatrix)*(xhV*vec3(-1.,1.,1.));
     vec3 xhViewN=mat3(viewMatrix)*(xhN*vec3(-1.,1.,1.));
     vec3 xhMatT=normalize(cross(xhViewV,vec3(0,1,0))),xhMatB=normalize(cross(xhViewV,xhMatT));
     vec2 xhMatUv=vec2(dot(xhViewN,xhMatT),dot(xhViewN,xhMatB))*.5+.5;
     vec3 xhMatcap=texture2D(xhTex4,xhMatUv).rgb;
     vec4 xhFlow=texture2D(xhTex3,xhUv*vec2(${flow.map(f).join(',')})+vec2(0.,neoTime*${n('FlowSpeed1',1)}));
     float xhNoiseMask=clamp(neoSourceNoise(xhLocal.xy*3.+vec2(0.,neoTime*${n('FlowSpeed2',-2)})),0.,1.)*2.;
     float xhGeomDot=dot(xhV,t107N),xhDot=dot(xhV,xhN);
     float xhEmF=clamp(pow(max(xhGeomDot-.5,0.),${n('FresPow1',4)})*2.,0.,1.);
     vec3 xhFire=mix(${col('EmColorB')}*${n('FresIntensity',0)}*xhFlow.a,${col('EmColorA')}*${n('FresInnerInt',0)},xhEmF*xhNoiseMask*3.);
     vec3 xhFlowEmission=mix(${col('EmColorC')}*${n('FresIntensity2',0)},xhFire,clamp(pow(max(xhGeomDot-.3,0.),${n('FresPow2',.3)})*1.5,0.,1.));
     float xhFresnel=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*xhPow5(1.-xhDot),0.,1.);
     xhEmission=xhFresnel*${col('RimColor',[0,0,0,0])}*${f(intensity[3])}+mix(vec3(xhMix.a),xhMix.a*xh0.rgb,${n('BaseEmissiveKey',0)})*xhLinear(${col('EmissiveColor')})*${n('EmissiveValue',1)};
     float xhShadow=step(${n('ShadowOffset',.5)},xhNdotL);
     float xhLine=mix(1.,1.+mix(0.,.5,xhShadow)*${n('HighLightLineStr',1)},step(.05,clamp(xhDot-.6,0.,1.)));
     vec3 xhBase=xh0.rgb*mix(${col('ShadowColor')},vec3(1.),xhShadow)*${n('BaseColInten',1)}*xhLine;
     vec3 xhOut=mix(xhBase,${col('HalftoneBrightColor')}*${n('HalftoneBrightStrength',.6)},xhMaskLight-xhMask);
     xhEmission+=mix(xhOut,${col('HalftoneColor')}*${n('HalftoneStrength',.6)},xhMask);
     vec3 xhRim3=${col('frcolor')}*step(.1,clamp(1.-xhGeomDot-.5,0.,1.))*5.;
     xhEmission+=mix(xhRim3*${col('frcolor2')}*20.,xhRim3,xhShadow)*30.*${n('frstr',1)};
     float xhRim1=1.-step(.05,clamp(xhDot-${n('FresOffset',.3)},0.,1.));
     float xhRim2=pow(1.-clamp(clamp(xhDot-${n('Fres2Offset',.3)},0.,1.)*2.,0.,1.),${n('Fres2Pow',1)});
     xhEmission+=xhRim1*${n('FresStr',1)}*${col('FresColor')}+xhRim2*${n('Fres2Str',0)}*${col('Fres2Color')};
     xhEmission+=pow(clamp(xhMatcap,0.,1.),vec3(${n('MatcapPow',1)}))*${n('MatcapStr',1)}+xhFlowEmission;
     diffuseColor=vec4(0.,0.,0.,xhAlpha*opacity);
    `;
   }else body+='diffuseColor=vec4(xh0.rgb,xhAlpha*opacity);\n';
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=mat3(viewMatrix)*(xhN*vec3(-1.,1.,1.));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=xhEmission;');
   if(outline)s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
   else{
    s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',sourceSpecular('0.','0.'));
    sourceIsotropy(s,{quality:q,smoothDiffuse:true,light:light===1,standardMaterial:true});
   }
  };
  warnings.push('小黑原主体/独立描边通道与位移；'+sourceSceneLightWarning);return u;
 }catch(e){warnings.push('xiaohei remains unsupported: '+e.message);return null;}
}
