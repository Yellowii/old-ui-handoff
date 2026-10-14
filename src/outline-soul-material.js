import * as THREE from 'three';
import {runtimeContract} from './handoff/runtime-contracts.js';
const defaults=runtimeContract("outline-soul-defaults.json");
import {scalar,vector,f,rgb,setup} from './t107-frame.js';

// Original depth-only, colored-grid and expanded-backface passes.
export async function configureOutlineSoul(m,parameters,macros,load,warnings,pass){
 try{
  if(![0,1,2].includes(pass)||Object.values(macros).some(v=>scalar(v,0)!==0))throw Error('Unknown soul pass or macro');
  const p={...defaults.parameters,...parameters},base=vector(p.BaseColor,[1,1,1,1]),outline=vector(p.OutlineCol,[1,1,1,1]);
  const scale=scalar(p.Scale,1),power=scalar(p.Power,1),width=scalar(p.Outline,1),light=scalar(p.Lightness,1),cut=scalar(p.CutOut,0);
  if(power<=0)throw Error('Undefined Fresnel power boundary');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};setup(m,false);
  if(pass<2){const input=await load('Tex0',false);if(!input?.isTexture||input.isCubeTexture)throw Error('Missing original grid texture');
   const t=input.clone();t.minFilter=t.magFilter=THREE.NearestFilter;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.generateMipmaps=false;t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;u.soulGrid={value:t};m.addEventListener('dispose',()=>t.dispose());
  }
  if(pass===0){m.colorWrite=false;m.depthTest=true;m.depthWrite=true;}
  if(pass===2){m.side=THREE.BackSide;m.depthWrite=false;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   const vary='varying vec2 soulUv;varying vec3 soulN,soulView,soulWorld;\n';
   s.vertexShader=vary+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nsoulUv=uv;')
    .replace('#include <normal_vertex>',`#include <normal_vertex>
     vec3 soulNormalView=transformedNormal;
     #ifdef FLIP_SIDED
      soulNormalView=-soulNormalView;
     #endif
     // Source InverseWorld normal is deliberately not normalized.
     soulN=(vec4(soulNormalView,0.)*viewMatrix).xyz*vec3(-1.,1.,1.);
    `).replace('#include <project_vertex>',`#include <project_vertex>
     soulWorld=(modelMatrix*vec4(transformed,1.)).xyz*vec3(-1.,1.,1.);
     soulView=normalize(soulWorld-cameraPosition*vec3(-1.,1.,1.));
     ${pass===2?`gl_Position.xy+=(projectionMatrix*vec4(soulNormalView.xy,0.,0.)).xy*${f(width)};`:''}
    `);
   s.fragmentShader=vary+`uniform float neoTime,neoEmissionScale;${pass<2?'uniform sampler2D soulGrid;':''}
    float soulNoise(vec3 position){
     // Only the original Vec3Noise blue component reaches the output.
     float d=fract(dot(ceil(position*2.5),vec3(4.97,2.08,7.3))/6.28);
     return (fract((d*6.28-660.46*d*d*d)*(neoTime*.005))*2.-1.+1.)*.5;
    }
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    float soulNoiseValue=clamp(soulNoise(soulWorld),0.,1.);
    float soulVisible=step(${f(cut)},soulNoiseValue);
    ${pass<2?`
     vec3 soulGridColor=texture2D(soulGrid,soulUv).rgb*${rgb(base)};
     float soulF=clamp(${f(scale)}+(1.-${f(scale)})*pow(1.-abs(dot(soulN,soulView)),${f(power)}),0.,1.);
     vec3 soulColor=pow(soulF*${rgb(base)}+soulGridColor,vec3(2.2))*${f(light)};
     soulColor+=pow(soulNoiseValue,8.)*step(.001,${f(cut)})*vec3(0.,1.,0.);
     float soulAlpha=(soulGridColor.r+soulF)*soulVisible;
    `:`
     vec3 soulColor=pow(${rgb(outline)},vec3(2.2))*${f(light)};
     // outline_pass2 declares noise03 scalar: vector-to-scalar conversion keeps x=0.
     float soulAlpha=soulVisible;
    `}
    diffuseColor=vec4(0.,0.,0.,soulAlpha);
   `).replace('#include <opaque_fragment>','gl_FragColor=vec4(soulColor*neoEmissionScale,soulAlpha);');
  };
  return u;
 }catch(e){warnings.push('outline_soul unsupported: '+e.message);return null;}
}
