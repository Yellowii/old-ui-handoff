import {Vector3} from 'three';

// standard_pet_emote.hlsl: two 4-column atlas regions share one UV channel.
export async function configurePetEmote(m,p,macros,load,warnings){
  const n=(key,fallback=0)=>Number.isFinite(Number(p[key]))?Number(p[key]):fallback;
  const v=(key,fallback)=>{try{const value=JSON.parse(p[key]);return Array.isArray(value)&&value.length>=fallback.length&&value.every(Number.isFinite)?value:fallback;}catch{return fallback;}};
  if(Number(macros.ENABLE_SOFT_BODY2)===1&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[NaN,NaN,NaN]).some(x=>!Number.isFinite(x)||x!==0))){warnings.push('standard_pet_emote 的活动 SoftBody 分支未接入，保持未适配');return null;}
  if(['INSTANCE_TYPE','ENABLE_VAT','ENABLE_SCALE_9','ENABLE_TILING'].some(k=>Number(macros[k]??0)!==0)){warnings.push('standard_pet_emote 的活动顶点分支未接入，保持未适配');return null;}
  const row=n('Row',1);if(!Number.isInteger(row)||row<1){warnings.push('standard_pet_emote 的 Row 非法，保持未适配');return null;}
  const albedo=await load('Tex0',false),emissive=await load('Tex1',false);
  if(!albedo||!emissive){warnings.push('standard_pet_emote 缺少源 Tex0 或 Tex1，保持未适配');return null;}
  const emo=v('EmoIndex',[0,0,0,3]),eyes=v('Eyes_Col',[1,0,0,1]);
  m.map=null;m.normalMap=null;m.vertexColors=false;m.color.set(0xffffff);m.roughness=1;m.metalness=0;m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoPetAlbedo:{value:albedo},neoPetEmissive:{value:emissive},neoPetEmoIndex:{value:new Vector3(emo[0],emo[1],emo[2])},neoPetMouthRow:{value:emo[3]},neoPetEyes:{value:new Vector3(...eyes.slice(0,3))},neoPetWild:{value:n('Wild_Key')},neoPetEmission:{value:n('EmissiveAmount')}};
  const linear=Number(macros.RENDER_QUALITY)===2?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))';
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.vertexShader='varying vec2 neoPetUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoPetUv=uv;');s.fragmentShader=`varying vec2 neoPetUv;uniform sampler2D neoPetAlbedo,neoPetEmissive;uniform vec3 neoPetEmoIndex,neoPetEyes;uniform float neoPetMouthRow,neoPetWild,neoPetEmission;vec3 petLinear(vec3 c){return ${linear};}\n`+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec2 petOffset=mix(neoPetEmoIndex.xy,vec2(neoPetEmoIndex.z,neoPetMouthRow),step(.5,neoPetUv.y));vec2 petUv=(vec2(neoPetUv.x,fract(neoPetUv.y*2.0))+petOffset)/vec2(4.0,${row.toFixed(8)});vec4 petBase=texture2D(neoPetAlbedo,petUv);diffuseColor=vec4(petLinear(petBase.rgb),petBase.a*opacity);`).replace('#include <color_fragment>','');
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=1.0;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.0;').replace('#include <emissivemap_fragment>',`vec4 petEm=texture2D(neoPetEmissive,petUv);vec3 petLinearEm=petLinear(petEm.rgb);vec3 petWild=mix(petLinearEm,petLinear(neoPetEyes),step(neoPetUv.y,.5));totalEmissiveRadiance=petLinearEm*neoPetEmission*petEm.a+petWild*neoPetWild;`);
  };
  warnings.push('standard_pet_emote 表情图集、野生眼色和发光公式已接入');return uniforms;
}
