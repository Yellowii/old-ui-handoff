import * as THREE from 'three';

const finite=(value,fallback)=>{
  if(value===undefined)return fallback;
  if((typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))||!Number.isFinite(Number(value)))throw Error('无效有限数值');
  return Number(value);
};
const vector=(value,fallback)=>{
  if(value===undefined)return fallback;
  let parsed=value;
  if(typeof value==='string'){
    try{parsed=JSON.parse(value);}catch{parsed=value.split(',').map(x=>finite(x,NaN));}
  }
  if(!Array.isArray(parsed)||parsed.length!==fallback.length||!parsed.every(Number.isFinite))throw Error('无效向量参数');
  return parsed;
};
const literal=value=>Number(value).toFixed(8);
const glvec=value=>`vec${value.length}(${value.map(literal).join(',')})`;

// standard_rr_star.hlsl only reaches this adapter for its verified zero-rim path.
export async function configureRrStar(m,p,macros,load,warnings){
  try{
 const change=finite(macros.CHAR_CHANGE_COLOR,1);
  const quality=finite(macros.RENDER_QUALITY,0);
  const intensity=vector(p.Intensity,[1,1,1,0]);
  const softBody=['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'];
  const knownMacros=new Set(['CHAR_CHANGE_COLOR','RENDER_QUALITY','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER','LIGHT_ENABLE','NORMAL_MAP_ENABLE']);
  const activeVertex=Object.entries(macros).some(([key,value])=>!knownMacros.has(key)&&finite(value,0)!==0);
  if(![0,1].includes(change)||![0,1,2].includes(quality)||intensity[3]!==0||activeVertex||softBody.some(key=>vector(p[key],[0,0,0]).some(value=>value!==0))){
    warnings.push('standard_rr_star 活动法线/TBN、顶点或未知宏分支尚未接入，保持未适配');
    return null;
  }
  const raw=await load('Tex0',false);
  if(!raw?.isTexture||raw.isCubeTexture){warnings.push('standard_rr_star 缺少源二维 Tex0，保持未适配');return null;}
  const base=vector(p.BaseColor,[1,1,1,1]);
  const lerp=vector(p.lerpColor,[1,1,1,1]);
  const lerpValue=finite(p.colorLerpV,0),emissive=finite(p.EmissiveValue,1),tint=finite(p.TintValue,1);
  const inverseWorld=new THREE.Matrix4();
  const uniforms={neoRrStarMap:{value:raw},neoRrStarInverseWorld:{value:inverseWorld},neoEmissionScale:{value:1}};
  m.map=null;m.normalMap=null;m.color.set(0x000000);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.roughness=1;m.metalness=0;
  m.onBeforeRender=(_renderer,_scene,_camera,_geometry,object)=>{inverseWorld.copy(object.matrixWorld).invert();};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=`varying vec2 neoRrStarUv;varying vec3 neoRrStarLocalPos;varying vec3 neoRrStarWorldPos;\n${shader.vertexShader}`
      .replace('#include <uv_vertex>','#include <uv_vertex>\nneoRrStarUv=uv;')
      .replace('#include <skinning_vertex>',`#include <skinning_vertex>
        neoRrStarLocalPos=transformed;
        neoRrStarWorldPos=(modelMatrix*vec4(transformed,1.0)).xyz;`);
    shader.fragmentShader=`varying vec2 neoRrStarUv;varying vec3 neoRrStarLocalPos;varying vec3 neoRrStarWorldPos;
      uniform sampler2D neoRrStarMap;uniform mat4 neoRrStarInverseWorld;uniform float neoEmissionScale;
      vec3 neoRrStarLinear(vec3 x){return ${quality===2?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
      ${shader.fragmentShader}`;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <map_fragment>','diffuseColor=vec4(vec3(0.0),opacity);')
      .replace('#include <emissivemap_fragment>',`vec3 neoRrStarWorldView=normalize(cameraPosition-neoRrStarWorldPos);
        vec3 neoRrStarLocalView=(neoRrStarInverseWorld*vec4(neoRrStarWorldView*vec3(1.0,0.0,1.0),0.0)).xyz;
        float neoRrStarAlpha=(dot(neoRrStarLocalView,normalize(neoRrStarLocalPos*vec3(1.0,0.0,1.0)))+1.0)/2.0;
        vec3 neoRrStarRaw=texture2D(neoRrStarMap,neoRrStarUv).rgb;
        vec3 neoRrStarFinal=mix(mix(neoRrStarRaw,${glvec(lerp.slice(0,3))},${literal(lerpValue)}),neoRrStarRaw,neoRrStarAlpha)+neoRrStarRaw*${literal(emissive)}*smoothstep(.2,1.0,neoRrStarAlpha);
        ${change===0?`totalEmissiveRadiance=neoRrStarLinear(neoRrStarFinal*${glvec(base.slice(0,3))})*${literal(tint)};`:`float neoRrStarLuminance=dot(neoRrStarRaw,vec3(.2125,.7154,.0721));totalEmissiveRadiance=neoRrStarLinear(vec3(neoRrStarLuminance)*${glvec(base.slice(0,3))})*${literal(tint)};`}`)
      .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance*neoEmissionScale;\n#include <opaque_fragment>');
  };
  return uniforms;
 }catch(error){warnings.push('standard_rr_star 参数拒绝：'+error.message);return null;}
}
