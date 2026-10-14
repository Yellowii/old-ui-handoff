// Native jiguangramp program0. All current callers author the source-default
// WaveStrength=0, so a finite normalized WaveTex sample cannot move a vertex.
// The five active pixel-stage textures remain mandatory.
export function prepareJiguangRamp(program,parameters){
 if(program.index!==0)throw Error('Unreviewed jiguangramp permutation');
 const node=program.expressions.scalars[13];
 if(node.op!=='scalar'||node.name!=='WaveStrength'||node.default!==0)throw Error('Jiguangramp source wave expression changed');
 if(Math.fround(Number(parameters.WaveStrength??0))!==0)throw Error('Jiguangramp active vertex wave requires original WaveTex');
 const offset='(v7.xyz+(vec3(((v9.xyz*v9.xyz).x*ScalarUniformExpressions[3].y))*v10))';
 if(!program.vertex.includes(offset)||/Tex4Sampler4/.test(program.glsl))throw Error('Jiguangramp source wave usage changed');
 return {...program,
  glsl:program.glsl.replaceAll('UniformExpressionsPS','UniformExpressions'),
  expressions:{...program.expressions,textures:program.expressions.textures.filter(t=>t.name!=='WaveTex')},
  specialization:{kind:'jiguangramp-zero-vertex-wave',removedSamplers:['WaveTex'],guards:[{name:'WaveStrength',default:0,value:0}],basis:'Native normalized red squared times exact zero; original PS retained, source World normal/position supplied by shared vertex stage'},
 };
}
