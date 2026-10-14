import {getHandoffServices} from './handoff/services.js';

// Bounded specialization of reviewed original SPX straight-line GLSL.
// Only missing samplers behind authored zero-weight mixes are candidates.
// This is not a substitute for a texture used by an active shader branch.
const one=text=>/^1(?:\.0*)?(?:e\+?0+)?$/i.test(text.trim());
const allOnes=text=>one(text)||/^vec[234]\(/.test(text)&&argumentsOf(text,text.indexOf('(')).args.every(one);
// Fingerprints cover BOTH original GLSL and decoded expression/default trees.
// Hosts approve exact GLSL + decoded expression/default fingerprints.
// Changing/rebuilding a source bundle cannot silently approve a new graph.
const identities=new Map();
function reviewedProgram(program,number='7'){
 const text=program.glsl+JSON.stringify(program.expressions);
 if(!identities.has(text)){
  let h=14695981039346656037n;for(let i=0;i<text.length;i++)h=BigInt.asUintN(64,(h^BigInt(text.charCodeAt(i)))*1099511628211n);
  identities.set(text,`${text.length}:${h.toString(16)}`);
 }
 const reviewed=getHandoffServices().runtimePolicy?.splendorSpecializationFingerprints?.[number];
 return Array.isArray(reviewed)&&reviewed.includes(identities.get(text));
}

function argumentsOf(text,open){
 let depth=1,start=open+1,args=[];
 for(let i=start;i<text.length;i++){
  if(text[i]==='(')depth++;
  if(text[i]===')'&&!--depth)return {args:[...args,text.slice(start,i).trim()],end:i+1};
  if(text[i]===','&&depth===1){args.push(text.slice(start,i).trim());start=i+1;}
 }
 throw Error('Unbalanced original GLSL call');
}

function eliminateUnused(glsl){
 const match=/void main\(\)\s*\{([\s\S]*)\}\s*$/.exec(glsl);if(!match)return null;
 const lines=match[1].split('\n').filter(x=>x.trim()),types=new Map(),statements=[];
 for(const line of lines){
  const declaration=/^\s*(?:(?:highp|mediump|lowp)\s+)?(float|vec[234])\s+(\w+);\s*$/.exec(line);
  if(declaration){types.set(declaration[2],declaration[1]==='float'?1:Number(declaration[1].at(-1)));statements.push({line,declaration:declaration[2]});continue;}
  const assignment=/^\s*(\w+)(?:\.([xyzw]{1,4}))?\s*=\s*(.+);\s*$/.exec(line);
  if(!assignment)return null; // Unknown control flow must retain original gates.
  statements.push({line,lhs:assignment[1],swizzle:assignment[2],rhs:assignment[3]});
 }
 const live=new Set(['gl_FragColor']),used=new Set(),kept=[];
 for(const statement of statements.toReversed()){
  if(statement.declaration)continue;
  if(!live.has(statement.lhs))continue;
  used.add(statement.lhs);kept.push(statement);
  // A partial vector write must not discard earlier writes to other channels.
  if(!statement.swizzle||statement.swizzle.length===(types.get(statement.lhs)??4))live.delete(statement.lhs);
  for(const name of statement.rhs.match(/\b[a-zA-Z_]\w*\b/g)||[])if(types.has(name)){live.add(name);used.add(name);}
 }
 const body=[...statements.filter(s=>s.declaration&&used.has(s.declaration)),...kept.toReversed()].map(s=>s.line).join('\n');
 return glsl.slice(0,match.index)+'void main()\n{\n'+body+'\n}\n';
}

function specializeZeroDistortion(number,program,parameters,missing){
 if(!missing.has('DistortTex1')||!reviewedProgram(program,number))return program;
 const names=number==='7'
  ? new Set(['DistortStrengthX','DistortStrengthY','AlphaMaskDistortX','AlphaMaskDistortY'])
  : new Set(['DistortStrengthX','DistortStrengthY','AlphaMaskDistortX','AlphaMaskDistortY','DistortStrength_Tex2_X','DistortStrength_Tex2_Y']);
 const guards=[],slots=[];
 for(const [i,node] of program.expressions.scalars.entries()){
  if(node.op!=='scalar'||!names.has(node.name))continue;
  const value=Math.fround(Number(parameters[node.name]??node.default));if(value!==0)return program;
  guards.push({name:node.name,value,default:node.default});slots.push(`ScalarUniformExpressions[${i>>2}].${'xyzw'[i%4]}`);
 }
 if(number==='7' ? guards.length!==4 : ![2,4,6].includes(guards.length))return program;
 // In these reviewed programs fN is the R/G channel of a normalized source
 // sample squared. It is finite [0,1], so multiplication by exact zero can
 // be removed. Preserve all diffuse, UV edge-mask, and Fresnel operations.
 let count=0,glsl=program.glsl.replace(/\(f\d+\*(ScalarUniformExpressions\[\d+\]\.[xyzw])\)/g,(expression,slot)=>{
  if(!slots.includes(slot))return expression;count++;return '0.0';
 });
 if(count!==guards.length+2)return program;
 // common7 reuses the same distortion sample to build two UV offsets. Once
 // all four authored distortion weights are exact zero, the sample itself is
 // semantically irrelevant; expose that constant so the straight-line liveness
 // pass can remove the complete Tex0 chain instead of retaining a dead sampler.
 if(number==='7'){
  glsl=glsl.replace(/texture2D\(Tex0Sampler0,\(VectorUniformExpressions\[4\]\.xy\+\(var_TEXCOORD0\*VectorUniformExpressions\[3\]\.xy\)\)\)/g,'vec4(0.0)');
 }
 glsl=eliminateUnused(glsl);if(!glsl)return program;
 if(/\bTex0Sampler0\b/.test(glsl.slice(glsl.indexOf('void main()'))))return program;
 glsl=glsl.replace(/uniform highp sampler2D Tex0Sampler0;\s*/,'');
 return {...program,glsl,expressions:{...program.expressions,textures:program.expressions.textures.filter(t=>t.name!=='DistortTex1')},specialization:{removedSamplers:['DistortTex1'],zeroParameters:guards.map(g=>g.name),guards,basis:`Finite normalized common${number} distortion samples multiplied by exact zero; original live statements preserved`}};
}

function specializeRampMask(program,parameters,missing){
 if(!missing.has('MaskDiffuseTex')||!reviewedProgram(program,'u5_rampdistort'))return program;
 const names=new Set(['MaskDiffuse_Use','MaskDiffuse_UseA']),slots=new Set(),guards=[];
 for(const [i,node] of program.expressions.scalars.entries()){
  if(node.op!=='scalar'||!names.has(node.name))continue;
  const value=Math.fround(Number(parameters[node.name]??node.default));if(value!==0)return program;
  guards.push({name:node.name,value,default:node.default});slots.add(`ScalarUniformExpressions[${i>>2}].${'xyzw'[i%4]}`);
 }
 if(guards.length!==2)return program;
 // Original branches are normalized texture alpha, or RGB squared. Both
 // are finite regardless of which missing image was authored.
 const aliases=new Map([...program.glsl.matchAll(/\b(\w+)\s*=\s*(ScalarUniformExpressions\[\d+\]\.[xyzw]);/g)].map(m=>[m[1],m[2]])),replacements=[];
 for(const match of program.glsl.matchAll(/\bmix\s*\(/g)){
  const call=argumentsOf(program.glsl,program.glsl.indexOf('(',match.index));if(call.args.length!==3)continue;
  let factor=call.args[2].replace(/^vec[234]\((\w+)\)$/,'$1');factor=aliases.get(factor)||factor;
  if(slots.has(factor)&&allOnes(call.args[0]))replacements.push({start:match.index,end:call.end,value:call.args[0]});
 }
 if(replacements.length!==2)return program;
 let glsl=program.glsl;for(const r of replacements.toReversed())glsl=glsl.slice(0,r.start)+r.value+glsl.slice(r.end);
 glsl=eliminateUnused(glsl);if(!glsl||/\bTex4Sampler4\b/.test(glsl.slice(glsl.indexOf('void main()'))))return program;
 glsl=glsl.replace(/uniform highp sampler2D Tex4Sampler4;\s*/,'');
 return {...program,glsl,expressions:{...program.expressions,textures:program.expressions.textures.filter(t=>t.name!=='MaskDiffuseTex')},specialization:{removedSamplers:['MaskDiffuseTex'],zeroParameters:[...names],guards,basis:'Finite original rampdistort mask RGB-square and alpha branches at exact zero mix weights'}};
}

function specializeCommon3Edge(program,parameters,missing){
 if(!missing.has('DissolveTex')||!reviewedProgram(program,'3'))return program;
 const width=Math.fround(Number(parameters.Dissolve_EdgeWidth??0));
 const range=Math.fround(Number(parameters.Dissolve_Range??.27000001072883606));
 if(width!==0||!Number.isFinite(range))return program;
 // Reviewed program48 has Use_Dissolve disabled: Tex2 only supplies the
 // edge difference. Its two thresholds are Range and Range - EdgeWidth.
 // At exact zero width both comparisons are identical, even at equality.
 // Preserve the following edge color, strength and mix operations verbatim.
 const expression='h78 = (h74+(-h79));';
 if(program.glsl.split(expression).length!==2)return program;
 let glsl=eliminateUnused(program.glsl.replace(expression,'h78 = 0.0;'));
 if(!glsl||/\bTex2Sampler2\b/.test(glsl.slice(glsl.indexOf('void main()'))))return program;
 glsl=glsl.replace(/uniform highp sampler2D Tex2Sampler2;\s*/,'');
 return {...program,glsl,expressions:{...program.expressions,textures:program.expressions.textures.filter(t=>t.name!=='DissolveTex')},specialization:{removedSamplers:['DissolveTex'],zeroParameters:['Dissolve_EdgeWidth'],guards:[{name:'Dissolve_EdgeWidth',value:width,default:0},{name:'Dissolve_Range',value:range,default:.27000001072883606}],basis:'Native common3 disabled dissolve with identical zero-width edge comparisons'}};
}

export function specializeSplendor(number,program,parameters,missing){
 if(number==='3')return specializeCommon3Edge(program,parameters,missing);
 if(number==='u5_rampdistort')return specializeRampMask(program,parameters,missing);
 if(['4','5','6'].includes(number))return specializeZeroDistortion(number,program,parameters,missing);
 if(number!=='7'||!missing.size||!reviewedProgram(program))return program;
 if(missing.has('DistortTex1')){
  const distortion=specializeZeroDistortion(number,program,parameters,missing);
  if(distortion!==program)return distortion;
 }
 const scalars=program.expressions.scalars;
 const defaults=new Map();
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.op==='scalar')defaults.set(node.name,node.default);for(const v of Object.values(node))if(typeof v==='object')Array.isArray(v)?v.forEach(visit):visit(v);};
 visit(program.expressions);
 const value=(name,fallback)=>{
  return Math.fround(Number(parameters[name]??defaults.get(name)??fallback));
 };
 const rules=[];
 const dyn=value('Dissolve_DynV'),width=value('Dissolve_GradWidth',.20000000298023224),invert=value('DissolveOneMinus');
 // The discarded chain is sample^2, lerp with 1-sample^2, ordered
 // smoothstep, step and clamp. For finite normalized texture values its
 // output is finite [0,1], independently of which missing image was intended.
 // With the authored switch exactly zero, the final dissolve mix is
 // `mix(1.0, dissolveFactor, 0.0)`, so the entire finite dissolve chain is
 // dead.  Width zero is explicitly accepted here because it is the common
 // authored inactive form; positive widths still require ordered thresholds.
 if(missing.has('DissolveTex')&&value('Dissolve_UseDissolve')===0&&Number.isFinite(dyn)&&Number.isFinite(width)&&Number.isFinite(Math.fround(dyn+width))&&((width===0)||(width>0&&Math.fround(dyn+width)>dyn))&&invert>=0&&invert<=1)
  rules.push({parameter:'Dissolve_UseDissolve',texture:'DissolveTex',guards:['Dissolve_UseDissolve','Dissolve_DynV','Dissolve_GradWidth','DissolveOneMinus']});
 const power=value('AlphaMask_Power'),useA=value('AlphaMask_UseA');
 // Mask sample RGB is squared, mixed with alpha, abs/max(1e-6), then
 // raised to a nonnegative power: finite for any normalized texture value.
 if(missing.has('MaskTex')&&value('MaskTex_Switch')===0&&Number.isFinite(power)&&power>=0&&power<=64&&useA>=0&&useA<=1)
  rules.push({parameter:'MaskTex_Switch',texture:'MaskTex',guards:['MaskTex_Switch','AlphaMask_Power','AlphaMask_UseA']});
 else if(missing.has('MaskTex')&&power===0&&useA>=0&&useA<=1)
  // The reviewed GLSL explicitly max(abs(sample mix), 1e-6), so its
  // finite positive base raised to zero is one even for a black sample.
  rules.push({parameter:'AlphaMask_Power',texture:'MaskTex',operation:'pow',guards:['AlphaMask_Power','AlphaMask_UseA']});
 if(!rules.length)return program;
 const aliases=new Map([...program.glsl.matchAll(/\b(\w+)\s*=\s*(ScalarUniformExpressions\[\d+\]\.[xyzw]);/g)].map(m=>[m[1],m[2]]));
 const slots=new Map(rules.map(rule=>{const i=scalars.findIndex(n=>n.op==='scalar'&&n.name===rule.parameter);return [`ScalarUniformExpressions[${i>>2}].${'xyzw'[i%4]}`,rule.operation||'mix'];}));
 const replacements=[];
 for(const match of program.glsl.matchAll(/\b(mix|pow)\s*\(/g)){
  const op=match[1],call=argumentsOf(program.glsl,program.glsl.indexOf('(',match.index));if(call.args.length!==(op==='mix'?3:2))continue;
  let factor=call.args.at(-1).replace(/^vec[234]\((\w+)\)$/,'$1');factor=aliases.get(factor)||factor;
  if(slots.get(factor)!==op)continue;
  if(op==='mix'&&allOnes(call.args[0]))replacements.push({start:match.index,end:call.end,value:call.args[0]});
  if(op==='pow'&&call.args[0].startsWith('max(abs(')&&/^vec3\(\w+\)$/.test(call.args[1]))replacements.push({start:match.index,end:call.end,value:'vec3(1.0)'});
 }
 if(replacements.length!==rules.length)return program;
 let glsl=program.glsl;for(const r of replacements.toReversed())glsl=glsl.slice(0,r.start)+r.value+glsl.slice(r.end);
 glsl=eliminateUnused(glsl);if(!glsl)return program;
 const body=glsl.slice(glsl.indexOf('void main()')),removed=[];
 for(const rule of rules){
  const t=program.expressions.textures.find(t=>t.name===rule.texture),sampler=`Tex${t.index}Sampler${t.index}`;
  if(new RegExp('\\b'+sampler+'\\b').test(body))return program;
  glsl=glsl.replace(new RegExp('uniform highp sampler2D '+sampler+';\\s*'),'');removed.push(rule.texture);
 }
 return {...program,glsl,expressions:{...program.expressions,textures:program.expressions.textures.filter(t=>!removed.includes(t.name))},specialization:{removedSamplers:removed,zeroParameters:rules.map(r=>r.parameter),guards:rules.flatMap(r=>r.guards).map(name=>({name,value:value(name),default:defaults.get(name)})),basis:'Finite inactive common7 mix branches; original live statements preserved'}};
}
