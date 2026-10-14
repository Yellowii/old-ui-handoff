import * as THREE from 'three';

const scalar=(value,fallback)=>{
  const n=value===undefined?fallback:Number(value);
  if(!Number.isFinite(n))throw Error('Invalid source scalar');
  return n;
};
const vector=(value,fallback)=>{
  if(value===undefined)return fallback;
  const parsed=Array.isArray(value)?value:JSON.parse(String(value).startsWith('[')?value:'['+value+']');
  if(parsed.length!==fallback.length||!parsed.every(Number.isFinite))throw Error('Invalid source vector');
  return parsed;
};
const f=value=>Number(value).toFixed(8);

// The source ppp DrawCall is an untextured back-face pass. It explicitly
// consumes UV1 and the red vertex-color channel.
export function configureBoomSugarPass(material,p,macros,warnings,o={}){
  try{
    if(o.sourceSecondUv!==true)throw Error('Missing original second UV');
    if(o.sourceVertexColors!==true)throw Error('Missing original vertex color');
    const quality=scalar(macros.RENDER_QUALITY,0);
    if(![0,1,2].includes(quality))throw Error('Unknown source quality');
    const width=scalar(p.OutlineWidth1,3),vertexIntensity=scalar(p.VertexIntensity,0);
    const opa=scalar(p.opa,.8),opb=scalar(p.opb,.3),opc=scalar(p.opc,.3);
    const powa=scalar(p.powa,1),powb=scalar(p.powb,1),floora=scalar(p.floora,4),timea=scalar(p.timea,4),tilinga=scalar(p.tilinga,4);
    const rainbow=vector(p.RainbowColor,[.580,.678,1,1]),hue=vector(p.RainbowHue,[.235,.772,1,1]);
    const flowSpeed=scalar(p.FlowRainbowSpeed,.8),rainbowTiling=scalar(p.RainbowTiling,.8),emissive=scalar(p.pass2EvmIntensity,4);
    if(width<0||vertexIntensity<0||floora<=0||timea<=0||tilinga<=0||rainbowTiling<0)throw Error('Undefined source boomsugar boundary');
    material.map=null;material.normalMap=null;material.roughnessMap=null;material.metalnessMap=null;material.aoMap=null;
    material.vertexColors=true;
    material.color.set(0x000000);material.emissive.set(0xffffff);material.emissiveIntensity=1;
    material.side=THREE.BackSide;material.transparent=true;material.depthWrite=false;material.depthTest=true;material.blending=THREE.NormalBlending;
    const uniforms={neoTime:{value:0},neoEmissionScale:{value:1}};
    material.userData.uniforms=uniforms;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      const noise=quality<2
        ?'float boomRandom(vec2 q){return fract(sin(dot(q,vec2(12.9898,78.233)))*43758.5453123);}\nfloat boomNoise(vec2 q){vec2 i=floor(q),v=fract(q),u=v*v*(3.0-2.0*v);float a=boomRandom(i),b=boomRandom(i+vec2(1.0,0.0)),c=boomRandom(i+vec2(0.0,1.0)),d=boomRandom(i+vec2(1.0,1.0));return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}\n'
        :'';
      shader.vertexShader='attribute vec2 uv1;\nvarying vec2 boomUv;\nvarying vec2 boomUv1;\nvarying float boomColorR;\nuniform float neoTime;\n'+noise+shader.vertexShader
        .replace('#include <uv_vertex>','#include <uv_vertex>\nboomUv=uv;\nboomUv1=uv1;')
        .replace('#include <color_vertex>','#include <color_vertex>\nboomColorR=color.r;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\n'
          +(quality<2
            ?'float boomNoiseA=clamp(smoothstep('+f(powa)+','+f(powb)+',boomNoise(boomUv1*'+f(tilinga)+'+floor(neoTime*'+f(timea)+')/'+f(floora)+')),0.0,1.0)*boomColorR;\nfloat boomMask=sin(transformed.y+floor(neoTime*1.8)*4.0)*'+f(vertexIntensity)+';\ntransformed.xyz+=boomNoiseA*'+f(vertexIntensity)+'*objectNormal;\n'
            :'')
          +'transformed.xyz+=objectNormal*'+f(width)+'*.01;');
      const hueShift='vec3 boomHueShift(float key,vec3 color,float tiling){float rotation=(key+floor(neoTime*'+f(flowSpeed)+')/'+f(floora)+')*tiling*6.28318530718;float sn=sin(rotation),cs=cos(rotation),one=1.0-cs;vec3 axis=normalize(vec3('+f(hue[0])+','+f(hue[1])+','+f(hue[2])+'));mat3 rot=mat3(one*axis.x*axis.x+cs,one*axis.x*axis.y-axis.z*sn,one*axis.z*axis.x+axis.y*sn,one*axis.x*axis.y+axis.z*sn,one*axis.y*axis.y+cs,one*axis.y*axis.z-axis.x*sn,one*axis.z*axis.x-axis.y*sn,one*axis.y*axis.z+axis.x*sn,one*axis.z*axis.z+cs);return rot*color;}\n';
      shader.fragmentShader='varying vec2 boomUv;\nvarying vec2 boomUv1;\nvarying float boomColorR;\nuniform float neoTime,neoEmissionScale;\n'+hueShift+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <map_fragment>','float boomA=clamp(dot(normalize(inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0)),normalize(vNormal))- '+f(opa)+',0.0,1.0);float boomOp=clamp(pow(boomA,'+f(opb)+')*'+f(opc)+',0.0,1.0);diffuseColor=vec4(0.0,0.0,0.0,1.0-boomOp);')
        .replace('#include <color_fragment>','')
        .replace('#include <alphatest_fragment>','')
        .replace('#include <emissivemap_fragment>','vec3 boomBase=boomHueShift(boomUv.x,vec3('+f(rainbow[0])+','+f(rainbow[1])+','+f(rainbow[2])+'),'+f(rainbowTiling)+');totalEmissiveRadiance=sRGBTransferEOTF(vec4(boomBase*'+f(emissive)+',1.0)).rgb*neoEmissionScale;');
    };
    warnings.push('boomsugar ppp：UV1 噪声位移、背面扩张、视角透明和 Rainbow 发光已接入；原场景光照与 half 精度仍待标定');
    return uniforms;
  }catch(error){warnings.push('boomsugar ppp remains unsupported: '+error.message);return null;}
}
