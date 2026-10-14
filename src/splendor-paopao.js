// Apple Pipi: native PS0/VS0, with source-disabled second-UV use removed.
// Keep the emitted arithmetic intact; the bridge only supplies engine inputs.
export function preparePaopao(program,parameters){
 if(program.index!==0)throw Error('Paopao 尚未验收的音频/遮罩/Clamp 程序');
 const expression=program.expressions.scalars[14];
 if(expression.op!=='scalar'||expression.name!=='AnimTex_Use2UV'||expression.default!==0)throw Error('Paopao UV 表达式结构变化');
 const value=Math.fround(Number(parameters.AnimTex_Use2UV??0));
 if(value!==0)throw Error('Paopao 活动第二 UV 路径尚未接入');
 const vsMix='mix(texcoord0,texcoord1,ScalarUniformExpressions[3].zz)';
 const psMix='mix(var_TEXCOORD0,var_TEXCOORD1,vec2(ScalarUniformExpressionsPS[3].z))';
 if(!program.vertex.includes(vsMix)||!program.glsl.includes(psMix))throw Error('Paopao UV 程序结构变化');
 return {...program,
  vertex:program.vertex.replace(vsMix,'texcoord0').replace('TEXCOORD1 attribute highp vec2 texcoord1;','').replace('var_TEXCOORD1.xy = texcoord1;',''),
  glsl:program.glsl.replace(psMix,'var_TEXCOORD0').replaceAll('UniformExpressionsPS','UniformExpressions'),
  specialization:{kind:'paopao-source-uv0',guards:[{name:'AnimTex_Use2UV',default:0,value:0}]},
 };
}

export function paopaoVertexBridge(vertex){
 let glsl=vertex.slice(vertex.indexOf('uniform '))
  .replace(/uniform highp vec4 (?:ViewProjection|InvWorld|World)\[4\];\s*/g,'')
  .replace(/\w+ attribute[^;]+;\s*/g,'').replace(/varying[^;]+;\s*/g,'')
  .replace(/\bWorld\b/g,'modelMatrix').replace(/\bInvWorld\b/g,'neoPaopaoInvWorld')
  .replace(/\bViewProjection\b/g,'neoPaopaoVP').replace(/\bposition\b/g,'neoPaopaoPosition')
  .replace(/\bnormal\b/g,'neoPaopaoNormal').replace(/\btexcoord0\b/g,'neoPaopaoUv')
  .replaceAll('texture2DLodEXT','textureLod')
  .replace('void main()\n{',`void neoPaopaoVertex(vec4 neoPaopaoPosition,vec3 neoPaopaoNormal,vec2 neoPaopaoUv)
{
 mat4 neoPaopaoInvWorld=inverse(modelMatrix);
 mat4 neoPaopaoVP=projectionMatrix*viewMatrix;`);
 if(/\b(?:texcoord1|attribute|main|World|InvWorld|ViewProjection)\b/.test(glsl))throw Error('Paopao 未闭合顶点输入');
 return glsl;
}

export function paopaoFragmentBridge(glsl){
 // Native view space looks toward +Z, Three toward -Z. Its XY matcap lookup
 // and vector length are unchanged by this Z reflection. World-space Fresnel
 // is likewise invariant under the source-to-Three X reflection.
 return glsl.replace(/uniform highp vec4 View\[4\];\s*/g,'').replace(/\bView\[/g,'viewMatrix[');
}
