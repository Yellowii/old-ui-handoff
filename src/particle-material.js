// Android u5_vfx_common_{4,5,6}.hlsl and built_in/common/functions.hlsl.
// Retain Three's skinning/normal pipeline, but replace its lit output entirely.
export function particle5Gaps(p, macros) {
  const on = key => macros[key] === true || String(macros[key]).toLowerCase() === 'true' || Number(macros[key]) === 1;
  const gaps=[];
  if(on('ENABLE_SCALE_9'))gaps.push('VFX5 需要源 world_scale 分支，尚未接入');
  if(on('DEPTH_FADE_ENABLE')&&Number(macros.RENDER_QUALITY||0)<2)gaps.push('VFX5 需要场景深度淡化，尚未接入');
  if(Number(p.DepthBias))gaps.push('VFX5 需要源视空间 DepthBias，尚未接入');
  if(on('SubUV_Switch')&&[Number(p.SubUV_x??2),Number(p.SubUV_y??1)].some(n=>!Number.isFinite(n)||n<=0))gaps.push('VFX5 帧图行列参数无效');
  return gaps;
}

export async function configureParticle(m,p,macros,load,vfx6,warnings,vfx5=false,vfx7=false){
  const f=(key,fallback=0)=>Number.isFinite(Number(p[key]))?Number(p[key]).toFixed(8):fallback.toFixed(8);
  const on=key=>macros[key]===true||String(macros[key]).toLowerCase()==='true'||Number(macros[key])!==0&&Number.isFinite(Number(macros[key]));
  const vector=(key,fallback=[1,1,1,1])=>{let a;try{a=JSON.parse(p[key]);}catch{}return Array.isArray(a)&&a.length===4&&a.every(Number.isFinite)?a:fallback;};
  const rgb=key=>`vec3(${vector(key).slice(0,3).map(n=>n.toFixed(8)).join(',')})`;
  const pair=(x,y,fx=0,fy=fx)=>`vec2(${f(x,fx)},${f(y,fy)})`;
  const pan=(tx,ty,ox,oy,sx,sy,time='neoTime')=>`(neoUv*${pair(tx,ty,1)}+${pair(ox,oy)}+${time}*${pair(sx,sy)})`;
  const diffuse=await load('DiffuseTex1'),distort=await load('DistortTex1'),mask=await load('MaskTex'),diffuse2=vfx6?await load('DiffuseTex2'):null,dissolve=vfx7?await load('DissolveTex'):null;
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1},neoWindSpeed:{value:0},neoVfxDiffuse:{value:diffuse},neoVfxDistort:{value:distort},neoVfxMask:{value:mask},neoVfxDiffuse2:{value:diffuse2},neoVfxDissolve:{value:dissolve}};
  m.map=diffuse;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.roughness=1;m.metalness=0;
  const sample=(map,uv,exists)=>exists?`texture2D(${map},${uv})`:'vec4(1.0)';
  const duv=pan('Diffuse1_Tiling_X','Diffuse1_Tiling_Y','Diffuse1_Offset_X','Diffuse1_Offset_Y','Diffuse1_Speed_X','Diffuse1_Speed_Y');
  const muv=pan('Mask_TilingX','Mask_TilingY','Mask_OffsetX','Mask_OffsetY','Mask_SpeedX','Mask_SpeedY');
  const tuv=pan('Distort_Tiling_X','Distort_Tiling_Y',null,null,'Distort_Speed_X','Distort_Speed_Y','neoDistortTime');
  const d2uv=pan('Diffuse2_Tiling_X','Diffuse2_Tiling_Y','Diffuse2_Offset_X','Diffuse2_Offset_Y','Diffuse2_Speed_X','Diffuse2_Speed_Y');
  const t2uv=pan('Distorttiling_Tex2_X','DistortTiling_Tex2_Y',null,null,'DistortSpeed_Tex2_X','DistortSpeed_Tex2_Y');
  const ugc=on('UGC_FX'),fresnel=on('GIM_MODE')&&on('Use_Frenel');
  const uvPara=vector('UVPara');
  const body=`
    vec2 neoUv=neoVfxUv;
    ${vfx6&&Number(p.UVSampleKey)?`neoUv=neoUv*vec2(${uvPara.slice(0,2).join(',')})+vec2(${uvPara.slice(2).join(',')})+neoTime*${pair('Speed_U','Speed_V')};`:''}
    float neoDistortTime=${vfx6||vfx5?'neoTime':`mix(neoTime,ceil(neoTime*${f('DistortFrameSpeed',1)})*${f('DistortFrameStep',1)},${f('DistortFrameKey')})`};
    vec4 neoDist=${sample('neoVfxDistort',tuv,distort)};
    ${ugc?'neoDist.rgb*=neoDist.rgb;':''}
    vec2 neoDiffuseUv=${on('Diffuse1_Clamp_Switch')?`clamp(${duv},0.0,1.0)`:duv};
    neoDiffuseUv=neoRotate(neoDiffuseUv+neoDist.rg*${pair('DistortStrengthX','DistortStrengthY')},${f('Diffuse1_Rotate')}*8.0*3.141592654);
    ${vfx5&&on('SubUV_Switch')?`float neoRows=${f('SubUV_x',2)},neoColumns=${f('SubUV_y',1)};
    float neoTotalFrames=neoRows*neoColumns;
    float neoPhase=fract(neoTime*${f('SubUV_Speed',1)}+${f('SubUV_Index')}/neoTotalFrames);
    neoDiffuseUv=(neoDiffuseUv+floor(vec2(neoTotalFrames,neoRows)*neoPhase))/vec2(neoColumns,neoRows);`:''}
    vec4 neoD=${sample('neoVfxDiffuse','neoDiffuseUv',diffuse)};
    vec2 neoMaskUv=neoRotate(${muv},${f('MaskTex_Rotate')}*25.13)+neoDist.rg*${pair('AlphaMaskDistortX','AlphaMaskDistortY')};
    vec4 neoMask=${sample('neoVfxMask','neoMaskUv',mask)};
    ${ugc?'neoD.rgb*=neoD.rgb;neoMask.rgb*=neoMask.rgb;':''}
    vec4 neoPower=pow(neoD,vec4(${f('DiffuseTex1_Power',1)}));
    float neoFresnel=1.0;
    ${vfx5&&on('GIM_MODE')?`float neoViewFresnel=pow(abs(dot(normalize(neoVfxNormal),normalize(vViewPosition))),${f('FresnelAlpha_Pow',1)});
    neoFresnel=mix(1.0,mix(1.0-neoViewFresnel,neoViewFresnel,${f('FresnelAlpha_Inverse')}),${f('UseFresnelAlpha')});`:
    !vfx5&&fresnel?`neoFresnel=abs(dot(normalize(neoVfxNormal),normalize(vViewPosition)));neoFresnel=pow(${on('Frenel_Turn_Over')?'1.0-neoFresnel':'neoFresnel'},${f('Frenel_Power',1)});`:''}
    vec2 neoEdge=pow(abs(sin(neoVfxUv*3.14)),${pair('MaskR_Power','MaskG_Power')});
    float neoAlphaMask=${on('MaskTex_Switch')?`pow(${vfx6?`max(mix(neoMask.r,neoMask.a,${f('AlphaMask_UseA')}),.001)`:'neoMask.r'},${f('AlphaMask_Power',1)})`:'1.0'};
    diffuseColor.a=${on('Use_RGB')?`neoPower.r${vfx6?'*'+vector('Diffuse1_ColorMult')[0].toFixed(8):''}`:'neoPower.a'}*clamp(neoEdge.x*neoEdge.y*neoAlphaMask,0.0,1.0)*neoFresnel*${f('Alpha_Strength',1)}*opacity${vfx7&&dissolve?`*mix(1.0,smoothstep(${f('Dissolve_DynV')},${f('Dissolve_DynV')}+${f('Dissolve_GradWidth',.2)},${Number(p.DissolveOneMinus||0)!==0?'1.0-texture2D(neoVfxDissolve,neoUv).r':'texture2D(neoVfxDissolve,neoUv).r'}),${f('Dissolve_UseDissolve')})`:''};
    vec3 neoEmission=${vfx6?`neoDesaturate(neoPower.rgb,${f('DiffuseTex1_Desaturation')})*${rgb('Diffuse1_ColorMult')}`:'neoPower.rgb'};
    ${vfx6?`
    float neoDist2=${sample('neoVfxDistort',t2uv,distort)}.r;
    vec2 neoD2Uv=neoRotate(${d2uv},${f('Diffuse2_Rotate')}*8.0*3.141592654)+neoDist2*${pair('DistortStrength_Tex2_X','DistortStrength_Tex2_Y')};
    vec4 neoD2=${sample('neoVfxDiffuse2','neoD2Uv',diffuse2)};
    ${ugc?'neoD2.rgb*=neoD2.rgb;':''}
    neoEmission+=neoHue(neoDesaturate(pow(neoD2.rgb,vec3(${f('DiffuseTex2_Power',1)}))*${f('DiffuseTex2_Strength',1)},${f('DiffuseTex2_Desaturation')}),${f('DiffuseTex2_HueShift')})*${rgb('Diffuse2_ColorMult')};`:''}
    neoEmission=neoDesaturate(neoEmission,${f('Desaturation')})*${rgb('DiffuseColor')}*${f('DiffuseColor_Strength',1)}${vfx5?'':`+${rgb('Frenel_Emission_Color')}*neoFresnel*${f('Frenel_Emission_Strength')}`};
    ${!vfx5&&on('Use_AudioKey')?`neoEmission*=neoWindSpeed*${f('BrightnessRange',.8)}+1.0-${f('BrightnessRange',.8)}+${f('BrightnessMin')};`:''}
    neoEmission=neoHue(neoEmission,${f('FinalHuePercent')});
    ${ugc?'neoEmission=sqrt(max(neoEmission,vec3(0.0)));':''}
    ${vfx6&&Number(macros.RENDER_QUALITY)>=1?'neoEmission/=1.0+max(neoEmission.r,max(neoEmission.g,neoEmission.b));':''}
    #ifdef USE_COLOR_ALPHA
      diffuseColor.a*=vColor.a;
      neoEmission*=vColor.rgb;
    #elif defined(USE_COLOR)
      neoEmission*=vColor;
    #endif
    totalEmissiveRadiance=neoEmission*neoEmissionScale;
    diffuseColor.rgb=vec3(0.0);
  `;
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 neoVfxUv;\nvarying vec3 neoVfxNormal;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoVfxUv=uv;').replace('#include <normal_vertex>','#include <normal_vertex>\nneoVfxNormal=normalize(transformedNormal);');
    shader.fragmentShader=`
      varying vec2 neoVfxUv; varying vec3 neoVfxNormal;
      uniform float neoTime; uniform float neoEmissionScale; uniform float neoWindSpeed;
      uniform sampler2D neoVfxDiffuse; uniform sampler2D neoVfxDistort; uniform sampler2D neoVfxMask; uniform sampler2D neoVfxDiffuse2; uniform sampler2D neoVfxDissolve;
      vec2 neoRotate(vec2 uv,float time){float a=time*.25;vec2 d=uv-.5;return vec2(dot(vec2(cos(a),-sin(a)),d),dot(vec2(sin(a),cos(a)),d))+.5;}
      vec3 neoDesaturate(vec3 c,float f){return c*(1.0-f)+dot(c,vec3(.3,.59,.11))*f;}
      vec3 neoHue(vec3 c,float f){vec3 p=vec3(.55735)*dot(vec3(.55735),c);vec3 u=c-p;return u*cos(f*6.2832)+cross(vec3(.55735),u)*sin(f*6.2832)+p;}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',body).replace('#include <emissivemap_fragment>','').replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push(vfx5?'VFX5 原帧图、扭曲、遮罩及透明公式已接入；源软体、粒子实例与后处理尚未还原':'粒子颜色、遮罩通道、UV 和菲涅耳按当前 PPK shader 接入；粒子实例、软体及原场景后处理尚未还原');
  if(on('DEPTH_FADE_ENABLE')&&Number(macros.RENDER_QUALITY||0)<2)warnings.push('该粒子需要场景深度淡化，尚未接入深度缓冲');
  if(Number(p.DepthBias))warnings.push('该粒子需要源视空间 DepthBias，尚未适配');
  if(on('Use_AudioKey'))warnings.push('该粒子需要原 WindSpeed 音频输入，尚未接入；当前输入为 0');
  return uniforms;
}
