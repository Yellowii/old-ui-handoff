import {ClampToEdgeWrapping,LinearFilter,NoColorSpace,Vector4} from 'three';
import {runtimeContract} from './handoff/runtime-contracts.js';
const programs=runtimeContract("splendor-programs.json");
import {specializeSplendor} from './splendor-specialization.js';
import {preparePaopao,paopaoVertexBridge,paopaoFragmentBridge} from './splendor-paopao.js';
import {prepareJiguangRamp} from './splendor-jiguangramp.js';

const f=Math.fround;
const splat=n=>[n,n,n,n];
const decimal='[+-]?(?:(?:\\d+\\.\\d*)|(?:\\d*\\.\\d+)|(?:\\d+))(?:[eE][+-]?\\d+)?';
const commaFloat4=new RegExp(`^\\s*(${decimal})\\s*,\\s*(${decimal})\\s*,\\s*(${decimal})\\s*,\\s*(${decimal})\\s*$`);
const scalarFloat=new RegExp(`^\\s*${decimal}\\s*$`);

function finiteFloat32(value,name){
 if((typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&!scalarFloat.test(value)))throw Error('无效参数 '+name);
 const number=Number(value),float32=f(number);
 if(!Number.isFinite(number)||!Number.isFinite(float32))throw Error('无效参数 '+name);
 return float32;
}

function switchBit(value,name){
 if(value===true||value==='true')return 1;
 if(value===false||value==='false')return 0;
 if(typeof value==='number'&&(value===0||value===1))return value;
 if(typeof value==='string'&&scalarFloat.test(value)&&(Number(value)===0||Number(value)===1))return Number(value);
 throw Error('无效开关 '+name);
}

function expressionValues(expressions,parameters,time){
 const scalars=expressions.scalars.map(node=>evaluateExpression(node,parameters,time)[0]);
 const vectors=expressions.vectors.map(node=>evaluateExpression(node,parameters,time));
 if(!scalars.every(Number.isFinite)||!vectors.every(vector=>vector.every(Number.isFinite)))throw Error('SPX 表达式结果超出有限 float32 范围');
 return {scalars,vectors};
}

// Descriptors use either a JSON array or NeoX's four-component comma text.
// Keep this narrow: malformed vectors must not silently acquire default values.
export function parseSplendorFloat4(value,name){
 let vector=value;
 if(typeof value==='string'){
  try{vector=JSON.parse(value);}catch{
   const match=value.match(commaFloat4);
   if(!match)throw Error('无效向量 '+name);
   vector=match.slice(1).map(Number);
  }
 }
 if(!Array.isArray(vector)||vector.length!==4||!vector.every(Number.isFinite))throw Error('无效向量 '+name);
 const float32=vector.map(f);
 if(!float32.every(Number.isFinite))throw Error('无效向量 '+name);
 return float32;
}
// Original CPU expression operations; round each arithmetic result to float32.
export function evaluateExpression(n,p,time){
 const child=k=>evaluateExpression(n[k],p,time);
 switch(n.op){
  case 'scalar':return splat(finiteFloat32(p[n.name]===undefined?n.default:p[n.name],n.name));
  case 'vector':return parseSplendorFloat4(p[n.name]===undefined?n.default:p[n.name],n.name);
  case 'constant':return n.value.map(f);
  case 'time':return splat(finiteFloat32(time,'time'));
  case 'math': {const a=child('a'),b=child('b');if(![0,1,2,3].includes(n.kind))throw Error('未验证数学操作');return a.map((v,i)=>{const d=b[i];return f(n.kind===0?v+d:n.kind===1?v-d:n.kind===2?v*d:v/(Math.abs(d)<f(1e-5)?(d<0?-f(1e-5):f(1e-5)):d));});}
  case 'floor':return child('a').map(v=>f(Math.floor(v)));
  case 'frac':
  case 'periodic':return child('a').map(v=>f(v-Math.floor(v)));
  case 'sine':if(![0,1].includes(n.isCosine))throw Error('无效三角操作');return child('a').map(v=>f(n.isCosine?Math.cos(v):Math.sin(v)));
  case 'append': {if(n.count<1||n.count>4)throw Error('无效向量拼接');const a=child('a'),b=child('b');return [...a.slice(0,n.count),...b].slice(0,4);}
  case 'swizzle': {const a=child('a');return n.indices.map(i=>i>=0&&i<4?a[i]:0);}
  default:throw Error('未验证表达式 '+n.op);
 }
}

export function selectSplendor(number,macros={}){
 const program=programs[number];if(!program)throw Error('未知 SPX');let index=0;
 const allowed=new Set(program.switches.map(s=>s.name));
 for(const [key,value] of Object.entries(macros)){
  if(allowed.has(key))continue;
  if(['INSTANCE_TYPE','SP_QUALITY_LEVEL'].includes(key)){
   const numberValue=finiteFloat32(value,key);
   if(numberValue!==0&&(key==='INSTANCE_TYPE'||number==='mat_ui_rotation_v01'))throw Error('实例输入未接入');
   continue;
  }
  if(![false,'false',0,'0'].includes(value))throw Error('未验证宏 '+key);
 }
 program.switches.forEach((s,i)=>{const value=macros[s.name]===undefined?s.default[0]:macros[s.name];index|=switchBit(value,s.name)<<i;});
 return {index,...program.variants[index]};
}

export async function configureSplendor(m,source,load,warnings,overrides){
 const effect=(source.technique?.TechName||'').replaceAll('\\','/').toLowerCase();
  const number=effect.match(/^shader\/splendor\/u5_vfx_common_([34567])\.spx::tshader$/)?.[1]
  ??(effect==='shader/splendor/mat_light_v12.spx::tshader'?'mat_light_v12':undefined)
  ??(effect==='shader/splendor/mat_light_v07.spx::tshader'?'mat_light_v07':undefined)
  ??(effect==='shader/splendor/u5_emisedge.spx::tshader'?'u5_emisedge':undefined)
  ??(effect==='shader/splendor/u5_rampdistort.spx::tshader'?'u5_rampdistort':undefined)
  ??(effect==='shader/splendor/u5_vfx_common_paopao.spx::tshader'?'u5_vfx_common_paopao':undefined)
  ??(effect==='shader/splendor/u5_vfx_jiguangramp.spx::tshader'?'u5_vfx_jiguangramp':undefined)
  ??(effect==='shader/splendor/mat_ui_rotation_v01.spx::tshader'?'mat_ui_rotation_v01':undefined)
  ??(effect==='shader/splendor/mat_emissive_v01.spx::tshader'?'mat_emissive_v01':undefined);
  const cb=effect==='shader/splendor/model_cb_v04.spx::tshader';
  const sequence=effect==='shader/splendor/mat_sequence_pickone_v02.spx::tshader';
  const resolvedNumber=cb?'model_cb_v04':sequence?'mat_sequence_pickone_v02':number;
 const p={...(source.parameters||{})};
 const ownedTextures=[];
 try{
  const selectedProgram=selectSplendor(resolvedNumber,source.macros);
  const missing=new Set(selectedProgram.expressions.textures.filter(t=>!source.textures?.[t.name]?.url).map(t=>t.name));
  const paopao=resolvedNumber==='u5_vfx_common_paopao';
  const program=paopao?preparePaopao(selectedProgram,p):resolvedNumber==='u5_vfx_jiguangramp'?prepareJiguangRamp(selectedProgram,p):specializeSplendor(resolvedNumber,selectedProgram,p,missing),e=program.expressions;
  const uv2=program.vertex.includes('texcoord1;');
  if(uv2&&!overrides.sourceSecondUv)throw Error('缺少原第二 UV');
  if(cb&&!overrides.sourceTangents)throw Error('缺少原CB切线');
  if(e.frameScalars.length||e.frameVectors.length)throw Error('尚未验证帧表达式');
  if(Number(p.AudioKey??0)!==0)throw Error('缺少原音频输入');
  const initial=expressionValues(e,p,0),scalarValues=initial.scalars;
  const vectors=initial.vectors.map(value=>new Vector4(...value));
  const scalars=Array.from({length:Math.ceil(scalarValues.length/4)},(_,i)=>new Vector4(...[0,1,2,3].map(j=>scalarValues[i*4+j]??0)));
  const scalarArray=/uniform highp vec4 ScalarUniformExpressions\s*\[/.test(program.glsl);
  const vectorArray=/uniform highp vec4 VectorUniformExpressions\s*\[/.test(program.glsl);
  const uniforms={VectorUniformExpressions:{value:vectorArray?vectors:(vectors[0]??new Vector4())},ScalarUniformExpressions:{value:scalarArray?scalars:(scalars[0]??new Vector4())},AlphaMtl:{value:m.opacity},neoEmissionScale:{value:1}};
  if(resolvedNumber==='mat_emissive_v01'&&m.opacity!==1)throw Error('未验证 AlphaVal 状态');
  // Native World is row-major; its three basis-row lengths equal the column
  // lengths of Three's modelMatrix. Carry those per draw, including parent TRS
  // and shared materials, instead of a stale custom uniform.
  const worldScale=program.glsl.includes('uniform highp vec4 World[4];');
  for(const t of e.textures){
   if(t.op!=='texture')throw Error('未验证纹理索引');
   const texture=await load(t.name,false);
   if(!texture?.isTexture||texture.isCubeTexture||texture.isData3DTexture||texture.isDataArrayTexture||texture.isCompressedArrayTexture)throw Error('缺少源二维贴图 '+t.name);
   let sampler=texture;
   if(resolvedNumber==='mat_ui_rotation_v01'){
    sampler=texture.clone();sampler.wrapS=sampler.wrapT=ClampToEdgeWrapping;
    sampler.magFilter=sampler.minFilter=LinearFilter;sampler.generateMipmaps=false;sampler.colorSpace=NoColorSpace;sampler.needsUpdate=true;
    ownedTextures.push(sampler);
   }
    if(cb){
     // CB resource IDs and compiled sampler slots differ (e.g. Tex7Sampler5).
     const names=[...program.glsl.matchAll(new RegExp('uniform highp sampler2D (Tex'+t.index+'Sampler\\d+);','g'))].map(match=>match[1]);
     if(names.length!==1)throw Error('未闭合CB纹理映射 '+t.name);
     uniforms[names[0]]={value:sampler};
    }else uniforms['Tex'+t.index+'Sampler'+t.index]={value:sampler};
  }
  for(const t of e.cubeTextures){
   if(t.op!=='texture')throw Error('未验证立方图索引');
   const texture=await load(t.name,false);
   if(!texture?.isCubeTexture)throw Error('缺少源立方图 '+t.name);
   uniforms['Tex'+t.index+'Sampler'+t.index]={value:texture};
  }
  let time=0;
  uniforms.neoTime={get value(){return time;},set value(v){
   if(program.specialization?.guards.some(g=>f(Number(p[g.name]??g.default))!==g.value))throw Error('SPX specialized branch changed; rebuild material from updated parameters');
   const nextTime=finiteFloat32(v,'time');
   const {scalars:nextScalars,vectors:nextVectors}=expressionValues(e,p,nextTime);
   nextScalars.forEach((value,i)=>scalars[i>>2].setComponent(i%4,value));
   nextVectors.forEach((value,i)=>vectors[i].fromArray(value));
   uniforms.AlphaMtl.value=m.opacity;time=nextTime;
  }};
  // Dynamic ShaderComponent values share the original expression evaluator.
  // Validate all changes before committing; specialized branches cannot change.
  Object.defineProperty(uniforms,'setSourceParameters',{value:changes=>{
   const next={...p,...changes};
   for(const [name,value] of Object.entries(changes)){
    if(typeof value!=='number'||!Number.isFinite(value))throw Error('Dynamic scalar required: '+name);
   }
   if(program.specialization?.guards.some(g=>f(Number(next[g.name]??g.default))!==g.value))throw Error('SPX specialized branch changed; rebuild material from updated parameters');
   expressionValues(e,next,time);Object.assign(p,changes);uniforms.neoTime.value=time;
  }});
  let glsl=program.glsl.slice(program.glsl.indexOf('uniform '));
  glsl=glsl.replace(/uniform highp vec4 CameraPos;\s*/g,'').replaceAll('CameraPos.xyz','cameraPosition')
   .replace(/varying[^;]+;\s*/g,'').replace('void main()','vec4 neoSplendor()')
   .replace(/gl_FragColor\.xyzw\s*=\s*(\w+);/,'return $1;');
  if(worldScale){
   glsl=glsl.replace(/uniform highp vec4 World\[4\];\s*/g,'');
   for(let i=0;i<3;i++)glsl=glsl.replaceAll(`length(World[${i}].xyz)`,`neoSplendorWorldScale.${'xyz'[i]}`);
   if(/\bWorld\b/.test(glsl))throw Error('尚未验证的 World 使用方式');
  }
  if(glsl.includes('gl_FragColor'))throw Error('未知输出入口');
  if(paopao)glsl=paopaoFragmentBridge(glsl);
  if(cb)glsl=glsl.replaceAll('cameraPosition','(cameraPosition*vec3(-1.,1.,1.))');
  if(/\bREVERT_FRONTFACING\b/.test(glsl))throw Error('未验证 FRONTFACING 反转宏');
  glsl=glsl.replace(/\bFRONTFACING\b/g,'gl_FrontFacing');
  const varying='varying highp vec2 var_TEXCOORD0; varying highp vec2 var_TEXCOORD1; varying highp vec4 var_TEXCOORD5; varying highp vec4 var_TEXCOORD11;\n'+(cb?'varying highp vec4 var_TEXCOORD10;\n':'')+(worldScale?'varying highp vec3 neoSplendorWorldScale;\n':'');
  if(uv2)m.defines={...m.defines,USE_UV1:''};
  if(cb)m.defines={...m.defines,USE_TANGENT:''};
  const paopaoVertex=paopao?paopaoVertexBridge(program.vertex):'';
  m.map=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.roughness=1;m.metalness=0;m.toneMapped=false;
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader=varying+shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\nvar_TEXCOORD0=uv;var_TEXCOORD1=${uv2?'uv1':'vec2(0.0)'};`)
    .replace('#include <project_vertex>',`#include <project_vertex>\nvar_TEXCOORD5=modelMatrix*vec4(transformed,1.0);var_TEXCOORD11=vec4(normalize(mat3(modelMatrix)*objectNormal),1.0);${worldScale?'neoSplendorWorldScale=vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));':''}`);
   if(cb){
    // Preserve the source World-vector transform (including nonuniform scale),
    // and orthogonalize in object space before transforming. Raw positive
    // tangent length cancels at the final normalization; mirror is source data.
    shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',`vec3 neoCbT=cross(cross(objectNormal,objectTangent),objectNormal);\n#include <defaultnormal_vertex>`)
     .replace('var_TEXCOORD11=vec4(normalize(mat3(modelMatrix)*objectNormal),1.0);',`var_TEXCOORD10=vec4(normalize(mat3(modelMatrix)*neoCbT)*vec3(-1.,1.,1.),0.);var_TEXCOORD11=vec4(normalize(mat3(modelMatrix)*objectNormal)*vec3(-1.,1.,1.),tangent.w);var_TEXCOORD5.xyz*=vec3(-1.,1.,1.);`);
   }
   if(paopao){
    shader.vertexShader=shader.vertexShader.replace('void main() {',paopaoVertex+'\nvoid main() {')
     .replace('#include <project_vertex>','neoPaopaoVertex(vec4(transformed,1.0),objectNormal,uv);\nvec4 mvPosition=viewMatrix*vec4(var_TEXCOORD5.xyz,1.0);')
     .replace('var_TEXCOORD5=modelMatrix*vec4(transformed,1.0);var_TEXCOORD11=vec4(normalize(mat3(modelMatrix)*objectNormal),1.0);','');
   }
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+varying+'uniform float neoEmissionScale;\n'+glsl)
    .replace('#include <map_fragment>','vec4 neoSpxOutput=neoSplendor(); diffuseColor=vec4(0.0,0.0,0.0,neoSpxOutput.a); totalEmissiveRadiance=sRGBTransferEOTF(vec4(neoSpxOutput.rgb,1.0)).rgb*neoEmissionScale;')
    .replace('#include <emissivemap_fragment>','')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  m.userData.splendorVariant=program.index;
  if(program.specialization)m.userData.splendorSpecialization=program.specialization;
  if(ownedTextures.length)m.addEventListener('dispose',()=>ownedTextures.forEach(texture=>texture.dispose()));
  warnings.push('SPX 原 GLSL 与二进制参数表达式已接入；保留原输出色彩，完整原场景后处理和粒子实例未还原');
  return uniforms;
 }catch(error){ownedTextures.forEach(texture=>texture.dispose());warnings.push('SPX 保持未适配：'+error.message);return null;}
}
