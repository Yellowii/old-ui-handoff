export async function configureRampDistort(m,p,macros,load,warnings,overrides={}){
 const scalars=['Distort_Speed_X','Distort_Speed_Y','Distort_Tiling_X','Distort_Tiling_Y','Noise_Speed_X','Noise_Speed_Y','Noise_Tiling_X','Noise_Tiling_Y','Mask_UV_VPow','Mask_Offset_X','Mask_Offset_Y','Mask_Speed_X','Mask_Speed_Y','Mask_Tiling_X','Mask_Tiling_Y','Distort_Strength','NoisePower','Mask_Rotator','Ramp_Speed_X','Ramp_Speed_Y','Ramp_Tiling_X','Ramp_Tiling_Y','Mask_Power','RadialMask_Radius','RadialMask_Density','MaskDiffuse_Use','MaskDiffuse_UseA','WholeOpacity','Emission_Strength','DesaturationPara'];
 const n=k=>Number(p[k]),f=k=>n(k).toFixed(8),v=k=>{try{return JSON.parse(p[k]);}catch{return null;}};
 const reject=why=>{warnings.push('u5_rampdistort: '+why);return null;},color=v('DiffuseColor');
 if(scalars.some(k=>p[k]===undefined||!Number.isFinite(n(k)))||!Array.isArray(color)||color.length!==4||!color.every(Number.isFinite))return reject('invalid source parameters');
 if(n('RadialMask_Radius')===0||['Mask_UV_VPow','NoisePower','Mask_Power'].some(k=>n(k)<=0))return reject('zero radius or undefined power endpoint');
 if(Number(macros.VERTEX_COLOR_ENABLE||0)!==0||Number(macros.INSTANCE_TYPE||0)!==0)return reject('active vertex-color/instance input requires source runtime verification');
 if(Number(macros.ENABLE_SOFT_BODY2)!==0){
  const keys=['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'];
  if(keys.some(k=>!Array.isArray(v(k))||v(k).length!==3||v(k).some(x=>!Number.isFinite(x)||x!==0)))return reject('active or invalid source soft body is not implemented');
 }
 const keys=['DistortTex','NoiseTex','MaskDiffuseTex','MaskTex','RampTex'],maps={},white=new Set();
 for(const key of keys){
  const binding=overrides.textureBindings?.[key];
  if(!binding?.url&&!binding?.path&&p[key]==='white')white.add(key);
  else{maps[key]=await load(key,false);if(!maps[key])return reject('missing authored texture '+key);}
 }
 // White RGB is sufficient; do not invent builtin Alpha for an active consumer.
 if(white.has('MaskDiffuseTex')&&n('MaskDiffuse_UseA')!==0)return reject('builtin MaskDiffuseTex Alpha is unverified');
 const sample=(key,uv,component='rgb')=>white.has(key)?(component==='rgb'?'vec3(1.0)':'1.0'):`texture2D(rd${key},${uv}).${component}`;
 const uniforms={neoTime:{value:0},neoEmissionScale:{value:1}};
 for(const key of keys)uniforms['rd'+key]={value:maps[key]||null};
 m.roughness=1;m.metalness=0;m.color.set(0);m.emissive.set(0xffffff);m.emissiveIntensity=1;
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,uniforms);
  s.vertexShader='varying vec2 rdUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nrdUv=uv;');
  s.fragmentShader=`varying vec2 rdUv;uniform float neoTime,neoEmissionScale;uniform sampler2D rdDistortTex,rdNoiseTex,rdMaskDiffuseTex,rdMaskTex,rdRampTex;\n`+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   vec2 rdQ=rdUv*2.0-1.0;
   vec2 rdCoord=${Number(macros.PolarSwitch)!==0?'vec2(fract(atan(rdQ.y,rdQ.x)/6.28318),length(rdQ))':'rdUv'};
   vec2 rdDistortUv=rdCoord*vec2(${f('Distort_Tiling_X')},${f('Distort_Tiling_Y')})+neoTime*vec2(${f('Distort_Speed_X')},${f('Distort_Speed_Y')});
   vec3 rdDistort=${sample('DistortTex','rdDistortUv')};rdDistort*=rdDistort;
   vec2 rdOffset=rdDistort.xy*${f('Distort_Strength')};
   vec2 rdNoiseUv=rdCoord*vec2(${f('Noise_Tiling_X')},${f('Noise_Tiling_Y')})+neoTime*vec2(${f('Noise_Speed_X')},${f('Noise_Speed_Y')})+rdOffset;
   float rdNoise=${sample('NoiseTex','rdNoiseUv','r')};rdNoise*=rdNoise;
   vec2 rdMaskUv=vec2(rdCoord.x,pow(rdCoord.y,${f('Mask_UV_VPow')}))*vec2(${f('Mask_Tiling_X')},${f('Mask_Tiling_Y')})+vec2(${f('Mask_Offset_X')},${f('Mask_Offset_Y')})+neoTime*vec2(${f('Mask_Speed_X')},${f('Mask_Speed_Y')});
   ${Number(macros.Mask_U_Clamp_Switch)!==0?'rdMaskUv.x=clamp(rdMaskUv.x,0.0,1.0);':''}
   ${Number(macros.Mask_V_Clamp_Switch)!==0?'rdMaskUv.y=clamp(rdMaskUv.y,0.0,1.0);':''}
   rdMaskUv+=rdOffset;rdMaskUv-=vec2(0.5);
   float rdAngle=${f('Mask_Rotator')}*6.283185307179586;
   rdMaskUv=mat2(cos(rdAngle),sin(rdAngle),-sin(rdAngle),cos(rdAngle))*rdMaskUv+vec2(0.5);
   vec3 rdMaskDiffuse=${sample('MaskDiffuseTex','rdMaskUv')};rdMaskDiffuse*=rdMaskDiffuse;
   float rdMask=${sample('MaskTex','rdMaskUv','r')};rdMask*=rdMask;
   float rdAlphaWeight=${n('MaskDiffuse_UseA')===0?'1.0':`mix(1.0,${sample('MaskDiffuseTex','rdMaskUv','a')},${f('MaskDiffuse_UseA')})`};
   float rdDepth=1.0-distance(rdUv,vec2(0.5))/${f('RadialMask_Radius')};
   float rdDensity=rdDepth*${f('RadialMask_Density')};
   float rdEdge=rdDepth>0.0?1.0-1.0/pow(2.71828,rdDensity*rdDensity):0.0;
   diffuseColor=vec4(0.0,0.0,0.0,rdAlphaWeight*pow(rdMask,${f('Mask_Power')})*rdEdge*${f('WholeOpacity')}*opacity);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
   vec2 rdRampUv=vec2(${f('Ramp_Tiling_X')},${f('Ramp_Tiling_Y')})*pow(rdNoise,${f('NoisePower')})+neoTime*vec2(${f('Ramp_Speed_X')},${f('Ramp_Speed_Y')});
   vec3 rdRamp=${sample('RampTex','rdRampUv')};rdRamp*=rdRamp;
   vec3 rdEmission=rdRamp*mix(vec3(1.0),rdMaskDiffuse,${f('MaskDiffuse_Use')})*${f('Emission_Strength')};
   rdEmission=mix(rdEmission,vec3(dot(rdEmission,vec3(0.3,0.59,0.11))),${f('DesaturationPara')});
   totalEmissiveRadiance=sqrt(max(rdEmission*vec3(${color.slice(0,3).map(x=>x.toFixed(8)).join(',')}),vec3(0.0)))*neoEmissionScale;
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
 };
 warnings.push('u5_rampdistort: source UV/masks/emission and clock restored; active vertex/instance and soft-body inputs remain unsupported');
 return uniforms;
}
