import * as THREE from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl} from './source-scene-light.js';

export async function configureXmbl2(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),ia=scalar(macros.IA_VERTEX_COLOR,1),outline=o.xmblOutline===true;
  if(![0,1,2].includes(q)||[normal,change,ia].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  for(const k of ['INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'])if(scalar(macros[k],0)!==0)throw Error('Unsupported active '+k);
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body unresolved');
  const tbn=!outline&&q<2&&normal===1,derivedTbn=tbn&&!o.sourceTangents,expand=outline&&scalar(p.VertexOffset,0)!==0,color=expand&&ia===1;
  if(color&&!o.sourceVertexColors)throw Error('Missing original COLOR0');
  const n=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d)),intensity=vector(p.Intensity,[1,1,1,0]);
  const u={neoTime:{value:0}},keys=outline?[]:['Tex0',...(q<2?['Tex2','Rainbow',...(tbn?['Tex1']:[])]:[])];
  for(const k of keys){const t=await load(k,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+k);u['xb'+k]={value:t};}
  setup(m,tbn&&!derivedTbn);
  if(derivedTbn){m.extensions={...m.extensions,derivatives:true};m.userData.xmblDerivedTangent=true;}
  if(outline){m.side=THREE.BackSide;m.transparent=true;m.blending=THREE.NormalBlending;m.depthWrite=false;m.depthTest=true;m.depthFunc=THREE.LessEqualDepth;m.alphaTest=0;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,tbn&&!derivedTbn);
   const vary='varying vec3 xbLocal;\n';
   s.vertexShader=vary+(color?'attribute vec3 color;\n':'')+s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>
    ${expand?`transformed+=objectNormal*${n('VertexOffset',0)}*${color?'color.r':'1.'};`:''}
    xbLocal=transformed*vec3(-1.,1.,1.);`);
   s.fragmentShader=vary+`uniform sampler2D xbTex0,xbTex1,xbTex2,xbRainbow;uniform float neoTime;
    vec3 xbLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    float xbPow5(float x){float a=x*x;return a*a*x;}
   `+s.fragmentShader;
   let body;
   if(outline)body=`vec3 xbEmission=${col('pass2StarsColor')}*${n('VwhateIntensity',1)};diffuseColor=vec4(1.);`;
   else{
    body=`vec3 xbBase=xbLinear(texture2D(xbTex0,t107Uv).rgb);
     ${change?`xbBase=vec3(dot(xbBase,vec3(.2125,.7154,.0721)))*xbLinear(${col('BaseColor')});`:''}
     xbBase*=${n('TintValue',1)};vec3 xbEmission=xbBase;
    `;
    if(q<2)body+=`vec3 xbNormal=t107N;
     ${tbn?(derivedTbn?`vec3 xbDp1=dFdx(vViewPosition),xbDp2=dFdy(vViewPosition);vec2 xbDu1=dFdx(t107Uv),xbDu2=dFdy(t107Uv);vec3 xbDt=normalize(xbDp1*xbDu2.y-xbDp2*xbDu1.y);vec3 xbDb=normalize(-xbDp1*xbDu2.x+xbDp2*xbDu1.x);if(dot(cross(xbDt,xbDb),t107N)<0.0)xbDb=-xbDb;vec3 xbSample=texture2D(xbTex1,t107Uv).xyz*2.-1.;xbSample.xy*=${f(intensity[0])};xbNormal=mat3(xbDt,xbDb,t107N)*normalize(xbSample);`:`vec3 xbSample=texture2D(xbTex1,t107Uv).xyz*2.-1.;xbSample.xy*=${f(intensity[0])};xbNormal=mat3(t107T,t107B,t107N)*normalize(xbSample);`):''}
     vec4 xbMask=texture2D(xbTex2,t107Uv);
     float xbNoise=texture2D(xbTex2,t107Uv*1.5+neoTime*vec2(0.,-.05)).r;
     float xbStarEmission=clamp((xbMask.a-.5)*2.,0.,1.)*10.;
     float xbStarMask=(1.-xbMask.a-.51)>0.?1.:0.;
     vec3 xbRainbowColor=xbLinear(texture2D(xbRainbow,t107Uv+neoTime*vec2(0.,.3)).rgb);
     vec2 xbFlowUv=t107Uv*vec2(3.,1.5)+xbNoise*.5+neoTime*vec2(.1,-.1);
     float xbFlow=texture2D(xbTex2,xbFlowUv).b*(1.-xbStarMask);
     float xbStars=texture2D(xbTex2,t107Uv+neoTime*vec2(.01,.02)).g*texture2D(xbTex2,t107Uv+neoTime*vec2(0.,-.02)).g*20.;
     float xbPop=smoothstep(0.,.01,dot(xbNormal,-${sourceSceneSunGlsl()})*.5);
     xbEmission=mix(.8,1.,xbPop)*xbBase+xbFlow*(xbLocal.y-.1)*xbRainbowColor+xbStars+xbStarEmission;
    `;
    body+=`vec3 xbView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
     float xbFresnel=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*xbPow5(1.-dot(t107N,xbView)),0.,1.);
     xbEmission+=xbFresnel*${col('RimColor',[0,0,0,0])}*${f(intensity[3])};diffuseColor=vec4(0.,0.,0.,1.);
    `;
   }
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=xbEmission;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('xmbl_base2原主体/星光/流光及独立描边；half与完整运行时未等价。');return u;
 }catch(e){warnings.push('xmbl_base2 remains unsupported: '+e.message);return null;}
}
