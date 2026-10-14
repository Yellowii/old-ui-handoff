import {Vector4} from 'three';

const scalarKeys = ['AutoProgress', 'GrowthProgress', 'GrowthNoiseTiling', 'GrowthNoiseStr',
  'GrowthGradientRange', 'GrowthCrackEmissive', 'MatCapBNormalSwitch', 'MatCap1Intensity',
  'DepthNormalSpeed', 'FresStr', 'EmissiveValue', 'FresnelScale', 'TintValue', 'DepthOffset',
  'DepthNormalUVTilingA', 'DepthNormalUVTilingB', 'DepthNormalIntensity', 'MatCapBFA',
  'MatCapBFB', 'MatCapBIntensity'];
const vectorKeys = ['FresColor', 'BaseColor', 'EmissiveColor', 'RimColor',
  'TestColor', 'TestColorB', 'TestColorC', 'Intensity'];
const textureKeys = ['Tex0', 'BaseNormal', 'MatCap', 'MatCapB', 'DepthNormal', 'MixTex'];

// HLSL GetRawData upgrade-mask block. Keep frac and linear ramps, not smoothstep.
export const hdcbGrowthGlsl = `
  vec4 hMaskSample=texture2D(hMixTex,hUv*5.0*hGrowthNoiseTiling);
  hMaskMain=hUv1.y+(hMaskSample.g-0.5)*hGrowthNoiseStr;
  hProgress=mix(1.0-(1.0+0.5*hGrowthNoiseStr)*hGrowthProgress,
    1.0-(1.0+0.5*hGrowthNoiseStr)*fract(neoTime/10.0),hAutoProgress);
  float hUpgradeMin=hProgress-0.5*hGrowthGradientRange;
  float hTemp=clamp(clamp(hMaskMain-hUpgradeMin,0.0,hGrowthGradientRange)/hGrowthGradientRange,0.0,1.0);
  float hGem=10.0*hMaskSample.r*fract(0.001+clamp(
    clamp(hMaskMain-hUpgradeMin+0.05,0.0,2.0*hGrowthGradientRange)/(2.0*hGrowthGradientRange),0.0,1.0));
  float hRock=10.0*hMaskSample.r*fract(1.001-clamp(
    clamp(hMaskMain-hUpgradeMin,0.0,3.0*hGrowthGradientRange)/(3.0*hGrowthGradientRange),0.0,1.0));
  float hRockMask=clamp(hTemp-hRock,0.0,1.0);
  float hGemMask=clamp(hTemp+hGem,0.0,1.0);
  hCrack=clamp(hGemMask*(1.0-hRockMask)-0.05,0.0,1.0)/0.95;
  hCrack*=clamp(1.0-clamp(hProgress-0.975,0.0,1.0)*80.0,0.0,1.0);
`;

export async function configureHdcbCrystal(m,p,macros,load,warnings,overrides={}) {
  const low=Number(macros.RENDER_QUALITY)>=2;
  const useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  if(Number(macros.ENABLE_SOFT_BODY2)!==0){
    warnings.push('hdcb_crystal: ENABLE_SOFT_BODY2 尚未还原，保持未适配');return null;
  }
  if(!low&&overrides.sourceSecondUv!==true){
    warnings.push('hdcb_crystal: 源强制 TEXCOORD1，但此子网格缺少已验证第二 UV');return null;
  }
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};
  for(const k of scalarKeys){
    if(p[k]===undefined||!Number.isFinite(Number(p[k]))){
      warnings.push('hdcb_crystal: 缺少已验证 SURF 参数 '+k);return null;
    }
    u['h'+k]={value:Number(p[k])};
  }
  for(const k of vectorKeys){
    let a;try{a=JSON.parse(p[k]);}catch{}
    if(!Array.isArray(a)||a.length!==4||!a.every(Number.isFinite)){
      warnings.push('hdcb_crystal: 无效源向量 '+k);return null;
    }
    u['h'+k]={value:new Vector4(...a)};
  }
  if(!low&&u.hGrowthGradientRange.value<=0){
    warnings.push('hdcb_crystal: 源 GrowthGradientRange 为零的除法行为未验证');return null;
  }
  const required=['Tex0',...(!low?['MatCap','MatCapB','MixTex']:[]),...(useNormal?['BaseNormal','DepthNormal']:[])];
  for(const k of textureKeys)u['h'+k]={value:required.includes(k)?await load(k):null};
  const missing=required.filter(k=>!u['h'+k].value);
  if(missing.length){warnings.push('hdcb_crystal: 源贴图未就绪 '+missing.join(', '));return null;}

  // Keep source alpha/blend/cull/depth states supplied by sourceMaterial.
  m.map=u.hTex0.value;m.normalMap=useNormal?u.hBaseNormal.value:null;
  m.normalScale.setScalar(2);m.roughness=u.hIntensity.value.y;m.metalness=u.hIntensity.value.z;
  m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  if(!low)m.defines={...m.defines,USE_UV1:''};
  const fidelityGaps=['源场景 SmoothDiffuse、光照与 specular=1 尚未等价于 Three.js PBR'];
  if(useNormal&&!overrides.sourceTangents)fidelityGaps.push('源切线未导出，TBN 使用 Three.js 导数重建');
  m.userData.fidelity='source-channels-preview';
  m.userData.fidelityGaps=fidelityGaps;
  warnings.push('hdcb_crystal: '+fidelityGaps.join('；'));
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,u);
    s.vertexShader='varying vec2 hUv; varying vec2 hUv1;\n'+s.vertexShader.replace(
      '#include <uv_vertex>','#include <uv_vertex>\nhUv=uv; hUv1='+(low?'vec2(0.0)':'uv1')+';');
    const declarations=[
      'varying vec2 hUv; varying vec2 hUv1; uniform float neoTime,neoEmissionScale;',
      ...scalarKeys.map(k=>'uniform float h'+k+';'),
      ...vectorKeys.map(k=>'uniform vec4 h'+k+';'),
      ...textureKeys.map(k=>'uniform sampler2D h'+k+';'),
      'vec3 hLinear(vec3 c){return '+(low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))')+';}'
    ].join('\n');
    s.fragmentShader=declarations+'\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec4 hBase=texture2D(hTex0,hUv);
      hBase.rgb=hLinear(hBase.rgb);
      `+(Number(macros.CHAR_CHANGE_COLOR)===1?
        'hBase.rgb=dot(hBase.rgb,vec3(.2125,.7154,.0721))*hLinear(hBaseColor.rgb)*hTintValue;':
        'hBase.rgb*=hTintValue;')+`
      float hProgress=0.0,hMaskMain=0.0,hCrack=0.0;
      `+(low?'':hdcbGrowthGlsl)+`
      diffuseColor.rgb=hBase.rgb;
      diffuseColor.a=hBase.a*step(hProgress,hMaskMain)*opacity;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 hView=normalize(vViewPosition),hGeoNormal=normal;
      vec3 hNormalA=vec3(0.0),hNormalB=vec3(0.0);
      float hBaseMask=1.0;
      `+(useNormal?`
        vec3 hTangentView=vec3(dot(tbn[0],hView),dot(tbn[1],hView),dot(tbn[2],hView));
        vec4 hBaseN=texture2D(hBaseNormal,hUv);
        hBaseMask=hBaseN.a;
        vec3 hN=hBaseN.xyz*2.0-1.0;hN.xy*=2.0;
        hNormalB=normalize(tbn*normalize(hN));
        vec2 hDepthA=hUv*hDepthNormalUVTilingA+hDepthOffset*(hTangentView.xy/hTangentView.z);
        vec2 hDepthB=hUv*hDepthNormalUVTilingB+hDepthOffset*(hTangentView.xy/hTangentView.z);
        vec2 hDepthUv=mix(hDepthA,hDepthB,hBase.a)+vec2(0.0,0.3)*(neoTime*hDepthNormalSpeed);
        vec3 hN1=texture2D(hDepthNormal,hDepthUv).xyz*2.0-1.0;hN1.xy*=hDepthNormalIntensity;
        hNormalA=normalize(tbn*normalize(hN1));
        vec3 hBlendBase=vec3(hN.xy*0.5,hN.z+1.0),hBlendAdd=vec3(-hN1.xy,hN1.z);
        vec3 hBlend=hBlendBase*dot(hBlendBase,hBlendAdd)-(hBlendBase.z+1.0)*hBlendAdd;
        float hNormalF=1.0-clamp(pow(max(dot(hView,hGeoNormal)-1.0,0.0),0.1)*2.0,0.0,1.0);
        normal=mix(normalize(tbn*normalize(hBlend)),hNormalB,hNormalF);
      `:''));
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      vec3 hAdd=vec3(0.0);
      `+(low?'':`
        // Three fragment normals already live in view space; do not transform again.
        vec2 hCapUv=hNormalA.xy*0.5+0.5,hCapBUv=hNormalB.xy*0.5+0.5;
        hCapUv.y*=-1.0;hCapBUv.y*=-1.0;
        vec3 hCap=hLinear(texture2D(hMatCap,hCapUv).rgb)*hTestColorC.rgb*3.5;
        vec3 hCapB=hLinear(texture2D(hMatCapB,hCapBUv).rgb)*hTestColor.rgb*hMatCapBIntensity;
        float hF=1.0-clamp(pow(max(dot(hView,hNormalA)-0.48,0.0),0.1)*3.0,0.0,1.0);
        float hFB=1.0-clamp(pow(max(dot(hView,hNormalB)-0.8,0.0),0.2)*2.0,0.0,1.0);
        float hFBA=1.0-clamp(pow(max(dot(hView,mix(hGeoNormal,hNormalA,hMatCapBNormalSwitch))-hMatCapBFA,0.0),hMatCapBFB)*2.0,0.0,1.0);
        float hColF=clamp(pow(max(dot(hView,hGeoNormal)-0.08,0.0),0.6)*2.0,0.0,1.0);
        float hEmF=clamp(pow(max(dot(hView,hGeoNormal)-0.4,0.0),0.7)*2.0,0.0,1.0);
        hAdd=mix(hCap*hBaseMask,vec3(0.0),hF)*hMatCap1Intensity
          +hCapB*(hFB*hFBA)+mix(hTestColorB.rgb*0.3,hBase.rgb,hEmF)+mix(hTestColor.rgb,vec3(0.0),hColF);
      `)+`
      float hFresnel=clamp(hFresnelScale+(1.0-hFresnelScale)*pow(1.0-dot(normal,hView),5.0),0.0,1.0);
      totalEmissiveRadiance=(hAdd+hFresnel*hRimColor.rgb*hIntensity.a
        +hBase.rgb*hEmissiveColor.rgb*hEmissiveValue*hBase.a
        +hBase.rgb*hCrack*hGrowthCrackEmissive
        +clamp(dot(hView,hNormalA)-0.3,0.0,1.0)*hFresColor.rgb*hFresStr)*neoEmissionScale;
    `);
  };
  return u;
}
