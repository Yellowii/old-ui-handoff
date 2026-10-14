import * as THREE from 'three';
import {runtimeContract} from './handoff/runtime-contracts.js';
const contracts=runtimeContract("nfx-grass-defaults.json");
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

export function grassPassCount(inner){return contracts[inner?'nfx_grass_integrate_inner':'nfx_grass_integrate'].passes.length;}
export async function configureNfxGrass(m,parameters,macros,load,warnings,inner,pass,o={}){
 const owned=[];
 try{
  const contract=contracts[inner?'nfx_grass_integrate_inner':'nfx_grass_integrate'],p={...contract.parameters,...parameters},step=contract.passes[pass]?.step;
  if(step===undefined)throw Error('Unknown source pass');
  const change=scalar(macros.CHAR_CHANGE_COLOR,inner?1:0);
  const fogEnabled=scalar(macros.FOG_ENABLE,0)!==0;
  if(![0,1].includes(change)||Object.entries(macros).some(([k,v])=>!['CHAR_CHANGE_COLOR','FOG_ENABLE'].includes(k)&&scalar(v,0)!==0))throw Error('Unknown NFX macro requires source scene inputs');
  const fog=o.sourceFog;
  if(fogEnabled&&(!fog?.enabled||!Array.isArray(fog.rayleighColor)||fog.rayleighColor.length<3||!Array.isArray(fog.mieColor)||fog.mieColor.length<3))throw Error('Active fog requires authored source scene fog');
  const fogNum=value=>Number(value).toFixed(8),fogColor=value=>`vec3(${value.slice(0,3).map(fogNum).join(',')})`;
  if(!inner&&change)throw Error('Unknown outer tint permutation');
  const n=k=>f(scalar(p[k],0)),color=k=>rgb(vector(p[k],[1,1,1,1]));
  if(scalar(p.OcclusionPower,1)<=0||scalar(p.FresnalPower,1)<=0)throw Error('Undefined source power boundary');
  const inputs=[await load('Tex0',false),await load('Tex1',false)];
  if(inputs.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original base or noise texture');
  const sampler=(t,wrap)=>{const c=t.clone();c.wrapS=c.wrapT=wrap;c.minFilter=c.magFilter=THREE.LinearFilter;c.generateMipmaps=false;c.colorSpace=THREE.NoColorSpace;c.needsUpdate=true;owned.push(c);return c;};
  const u={ngBase:{value:sampler(inputs[0],THREE.ClampToEdgeWrapping)},ngNoise:{value:sampler(inputs[1],THREE.RepeatWrapping)},neoEmissionScale:{value:1}};
  if(fogEnabled)m.userData.sourceFog=fog;
  setup(m,false);
  if(inner){m.side=THREE.FrontSide;m.depthTest=true;m.depthWrite=pass===0;
   if(pass>0){m.transparent=true;m.blending=THREE.CustomBlending;m.blendEquation=m.blendEquationAlpha=THREE.AddEquation;m.blendSrc=m.blendSrcAlpha=THREE.SrcAlphaFactor;m.blendDst=m.blendDstAlpha=THREE.OneMinusSrcAlphaFactor;}
  }
  m.addEventListener('dispose',()=>owned.forEach(t=>t.dispose()));
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,false);
   const vary='varying vec2 ngLight;varying vec3 ngView;varying vec3 ngWorld;\n';
   s.vertexShader=vary+`uniform sampler2D ngBase;
    #if NUM_DIR_LIGHTS > 0
    struct DirectionalLight {vec3 direction;vec3 color;};
    uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];
    #endif
   `+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>
    vec3 ngOriginalWorld=(modelMatrix*vec4(transformed,1.)).xyz;ngWorld=ngOriginalWorld;
    ${pass?`transformed+=objectNormal*${n('FurLength')}*${f(step)}*textureLod(ngBase,uv,0.).a;`:''}
   `).replace('#include <project_vertex>',`#include <project_vertex>
    float ngDot=0.;
    #if NUM_DIR_LIGHTS > 0
     vec3 ngSun=inverseTransformDirection(directionalLights[0].direction,viewMatrix)*vec3(-1.,1.,1.);
     ngDot=dot(t107N,ngSun);
    #endif
    float ngOcc=clamp(pow(${f(step)},${n('OcclusionPower')})*2.5,0.,1.);
    ngLight.x=clamp(ngDot*.5+.5+${f(step)},0.,1.)*ngOcc;
    // The older outer shader subtracts clip position; preserve that source behavior.
    ngView=normalize(${inner?'cameraPosition-ngOriginalWorld':'cameraPosition*vec3(-1.,1.,1.)-gl_Position.xyz'})${inner?'*vec3(-1.,1.,1.)':''};
    ngLight.y=${pass?`clamp(${n('FresnalBias')}+${n('FresnalScale')}*pow(1.-dot(ngView,t107N),${n('FresnalPower')}),0.,1.)*ngOcc`:'0.'};
   `);
   s.fragmentShader=vary+'uniform sampler2D ngBase,ngNoise;uniform float neoEmissionScale;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 ngTex=texture2D(ngBase,t107Uv);
    float ngDot=0.;
    #if NUM_DIR_LIGHTS > 0
     vec3 ngSun=inverseTransformDirection(directionalLights[0].direction,viewMatrix)*vec3(-1.,1.,1.);
     ngDot=dot(normalize(t107N),ngSun);
    #endif
    float ngRamp=${n('gradValue')}+clamp(ngDot*.5,0.,1.)*2.*(1.-${n('gradValue')});
    vec3 ngColor=ngRamp*ngTex.rgb;float ngAlpha=1.;
    ${pass?`
     ngColor=(ngTex.rgb*ngLight.x+ngLight.y*${color('RimColor01')})*ngRamp*ngTex.rgb;
     float ngMask=texture2D(ngNoise,t107Uv*${n('NoiseTiling')}+${f(step)}*vec2(${n('offsetX')},${n('offsetY')})).r;
     ngAlpha=clamp(ngMask-${f(step)}*${n('FurRadius')},0.,1.)*ngTex.a;
     ${inner?'':'ngColor=mix(ngTex.rgb,ngColor,ngTex.a);ngAlpha*=ngTex.a;'}
    `:''}
    ${inner?`
     ${change?`ngColor=dot(ngTex.rgb,vec3(.2125,.7154,.0721))*${color('BaseColor')}*${n('TintValue')};`:`ngColor*=${n('TintValue')};`}
     float ngF=clamp(${n('FresnalBias')}+${n('FresnalScale')}*pow(1.-dot(ngView,t107N),${n('FresnalPower')}),0.,1.);
     ngColor+=ngF*${color('RimColor')}*${f(vector(p.Intensity,[0,0,0,0])[3])};ngAlpha*=opacity;
    `:''}
    diffuseColor=vec4(0.,0.,0.,ngAlpha);
   `).replace('#include <opaque_fragment>',`${fogEnabled?`
    float ngFogDist=clamp(length(cameraPosition-ngWorld)-${fogNum(fog.start)},0.,${fogNum(fog.rayleighEnd)});
    float ngFogHeight=0.;
    ${Number(fog.heightRange)>0?`float ngFogHeight01=clamp((ngWorld.y-${fogNum(fog.heightStart)})/${fogNum(fog.heightRange)},0.,1.);ngFogHeight=${fogNum(fog.heightRange)}*(1.-ngFogHeight01);`:''}
    float ngRayleighT=clamp(1.-exp2(-${fogNum(fog.rayleighDensity)}*ngFogDist),0.,1.);
    float ngMieT=clamp(1.-exp2(-${fogNum(fog.mieDensity)}*ngFogHeight),0.,1.);
    ngColor=mix(ngColor,${fogColor(fog.mieColor)},ngMieT);
    ngColor=mix(ngColor,${fogColor(fog.rayleighColor)},ngRayleighT);
    ${Number(fog.sunRayleighFactor)>0?`#if NUM_DIR_LIGHTS > 0
    vec3 ngSun=inverseTransformDirection(directionalLights[0].direction,viewMatrix)*vec3(-1.,1.,1.);
    float ngSunView=clamp(dot(normalize(cameraPosition-ngWorld),ngSun)*.66667+.33334,0.,1.);
    ngColor+=${fogColor(fog.sunColor)}*pow(ngSunView,${fogNum(fog.sunRayleighFactor)})*(1.-exp2(-${fogNum(fog.mieDensity)}*max(length(cameraPosition-ngWorld)-${fogNum(fog.sunStart)},0.)));
    #endif`:''}`:''}gl_FragColor=vec4(ngColor*neoEmissionScale,ngAlpha);`);
  };
  return u;
 }catch(e){owned.forEach(t=>t.dispose());warnings.push('DongDong NFX unsupported: '+e.message);return null;}
}
