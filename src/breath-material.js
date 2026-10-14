import {sourceSpecular,sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
// Android standard_common_emisbreath: diffuse alpha masks Tex3 emission, not ORM alpha.
export async function configureBreath(m,p,macros,load,warnings,overrides={}){
  const n=(key,fallback=0)=>Number.isFinite(Number(p[key]))?Number(p[key]):fallback;
  const f=(key,fallback=0)=>n(key,fallback).toFixed(8);
  const vec=(key,fallback)=>{try{const a=JSON.parse(p[key]);if(Array.isArray(a)&&a.length===4&&a.every(Number.isFinite))return a;}catch{}return fallback;};
  const base=vec('BaseColor',[1,1,1,1]),intensity=vec('Intensity',[1,1,1,0]);
  const quality=Number(macros.RENDER_QUALITY??0),light=Number(macros.LIGHT_ENABLE??1);
  if(![0,1,2].includes(quality)||![0,1].includes(light)||['USE_SKIN_LUT','USE_ANISOTROPIC_SPECULAR','USE_SPECULAR_COLOR','LIGHT_MAP_ENABLE'].some(k=>Number(macros[k]??0)!==0)){
    warnings.push('呼吸材质的此光照分支尚未接入');return null;
  }
  const low=quality===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const diffuse=await load('Tex0',false,overrides.baseColor),normal=await load('Tex1',false,overrides.normal),mix=await load('Tex2'),emission=await load('Tex3');
  const builtins={green:'vec4(0.0,1.0,0.0,1.0)',normal:'vec4(.5,.5,1.0,1.0)',black:'vec4(0.0,0.0,0.0,1.0)',white:'vec4(1.0)'};
  const sample=(key,texture,uniform,fallback)=>{
    if(texture)return `texture2D(${uniform},neoBreathUv)`;
    const name=p[key]||fallback;
    if(!builtins[name])warnings.push(`呼吸材质贴图未绑定：${key} (${name})`);
    return builtins[name]||'vec4(1.0,1.0,0.0,0.0)';
  };
  m.color.set(0xffffff);m.map=diffuse;m.normalMap=low||Number(macros.NORMAL_MAP_ENABLE)===0||Number(macros.LIGHT_ENABLE)===0?null:normal;
  m.normalScale.setScalar(intensity[0]);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoBreathDiffuse:{value:diffuse},neoBreathMix:{value:mix},neoBreathEmission:{value:emission},neoTime:{value:0},neoEmissionScale:{value:1}};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 neoBreathUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoBreathUv=uv;');
    shader.fragmentShader=`varying vec2 neoBreathUv;
      uniform sampler2D neoBreathDiffuse;uniform sampler2D neoBreathMix;uniform sampler2D neoBreathEmission;
      uniform float neoTime;uniform float neoEmissionScale;
      vec3 neoBreathLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 neoBreathD=${sample('Tex0',diffuse,'neoBreathDiffuse','green')};
      vec4 neoBreathM=${low?'vec4(1.0,.5,0.0,0.0)':sample('Tex2',mix,'neoBreathMix','unbound')};
      diffuseColor.rgb=neoBreathLinear(${change?'vec3(dot(neoBreathD.rgb,vec3(.2125,.7154,.0721)))':'neoBreathD.rgb'}*vec3(${base.slice(0,3).map(x=>x.toFixed(8)).join(',')}))*${f('TintValue',1)};
      diffuseColor.a=neoBreathD.a*${base[3].toFixed(8)}*opacity;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(neoBreathM.g*${intensity[1].toFixed(8)},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(neoBreathM.b*${intensity[2].toFixed(8)},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',low?'':`
      reflectedLight.indirectDiffuse*=neoBreathM.r;
      #if defined(USE_ENVMAP) && defined(STANDARD)
      float neoBreathDotNV=clamp(dot(geometryNormal,geometryViewDir),0.0,1.0);
      reflectedLight.indirectSpecular*=computeSpecularOcclusion(neoBreathDotNV,neoBreathM.r,material.roughness);
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      vec4 neoBreathE=${sample('Tex3',emission,'neoBreathEmission','black')};
      float neoBreathCycle=clamp(sin(neoTime*${f('EmissiveSpeed',1)})+1.0,0.0,${f('EmissiveClamp',1)});
      totalEmissiveRadiance=neoBreathLinear(neoBreathE.rgb)*pow(neoBreathD.a,${f('EmissiveAoPow',1)})*${f('EmissiveStrength',1)}*mix(1.0,neoBreathCycle,${f('emisWay')})*neoEmissionScale;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',sourceSpecular('.5',sourceGrazing));
    sourceIsotropy(shader,{quality,smoothDiffuse:false,light:light===1,standardMaterial:true});
  };
  warnings.push('呼吸发光、颜色、透明和直接光按源公式接入；原场景光源、SH及间接光仍待补齐');
  return uniforms;
}
