import {sourceValueNoise} from './source-value-noise.js';

export async function configureHdcbFamily(m,p,macros,load,warnings,overrides={}){
  const inner=p.__surface==='inner',low=Number(macros.RENDER_QUALITY)>=2;
  const useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const n=k=>Number(p[k]),f=k=>n(k).toFixed(8);
  const v=k=>{try{return JSON.parse(p[k]);}catch{return null;}};
  const scalars=['TintValue','FaceUVOffset','CharOffset','FlowColPow','FlowColStr','FlowLightnessOffset',
    'FlowLightnessMaxClamp','FresnelScale','BaseEmissiveKey','EmissiveValue',
    ...(inner?['EmisDepthStr','EmisNoiseStr','DiffuseDepthStr','StarsTiling','StarsSpeed','StarsColStr',
      'MeteorUseUV2','MeteorSpeed','MeteorEmis','AddEmisStr']:
      ['FlowNoiseStr','FlowDepthStr','DiffuseNoiseStr','FRScale','FRPow','MatcapStr','AddMatcapStr'])];
  const vectors=['Intensity','BaseColor','EmissiveColor','RimColor',...(inner?['MeteorColor','StarsColor','AddEmisColor']:[])];
  if(scalars.some(k=>p[k]===undefined||!Number.isFinite(n(k)))||
    vectors.some(k=>!Array.isArray(v(k))||v(k).length!==4||!v(k).every(Number.isFinite))||
    [inner?'MeteorUVScale':'FlowTiling'].some(k=>!Array.isArray(v(k))||v(k).length!==2||!v(k).every(Number.isFinite))){
    warnings.push('hdcb: 缺少已验证源参数');return null;
  }
  const useUv1=inner&&useNormal&&n('MeteorUseUV2')!==0;
  if(useUv1&&overrides.sourceSecondUv!==true){
    warnings.push('hdcb_inner: 活跃 MeteorUseUV2 缺源第二 UV');return null;
  }
  const keys=['Tex0',...(!low&&!inner?['Tex2','Tex4','Tex5']:[]),
    ...(useNormal?['Tex1','Tex3',...(inner?['Tex2','Tex5']:[])]:[])];
  const maps={};for(const k of keys)maps[k]=await load(k,false);
  const missing=keys.filter(k=>!maps[k]);
  if(missing.length){warnings.push('hdcb: 源贴图未就绪 '+missing.join(', '));return null;}
  const rgb=k=>'vec3('+v(k).slice(0,3).map(x=>x.toFixed(8)).join(',')+')';
  const vec2=k=>'vec2('+v(k).map(x=>x.toFixed(8)).join(',')+')',i=v('Intensity');
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1},neoFaceOffset:{value:n('FaceUVOffset')}};
  for(const k of ['Tex0','Tex1','Tex2','Tex3','Tex4','Tex5'])uniforms['h'+k]={value:maps[k]||null};
  m.map=maps.Tex0;m.normalMap=useNormal?maps.Tex1:null;
  m.normalScale.setScalar(i[0]);m.roughness=i[1];m.metalness=i[2];
  m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  if(useUv1)m.defines={...m.defines,USE_UV1:''};
  m.userData.fidelity='source-channels-preview';
  m.userData.fidelityGaps=['源 isotropy specular、SH 环境光、SunDirection/LightProbeSHV2 补光未还原',
    '公共软体宏仍待核验；此源 ApplyVertexOffsetLocal 为空',
    ...(useNormal&&!overrides.sourceTangents?['无源切线时使用导数 TBN']:[])];
  warnings.push('hdcb_'+(inner?'inner':'opaque')+': '+m.userData.fidelityGaps.join('；'));
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='varying vec2 hUv,hUv1;\n'+s.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\nhUv=uv;hUv1='+(useUv1?'uv1':'uv')+';');
    s.fragmentShader=`
      varying vec2 hUv,hUv1;uniform float neoTime,neoEmissionScale,neoFaceOffset;
      uniform sampler2D hTex0,hTex1,hTex2,hTex3,hTex4,hTex5;
      vec3 hLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+(inner&&useNormal?sourceValueNoise:'')+s.fragmentShader;
    // Source sampling needs the TBN; defer raw-data evaluation until after normal setup.
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec2 hMainUv=hUv;hMainUv.x+=hUv.y<0.25?neoFaceOffset*${f('CharOffset')}:0.0;
      vec2 hBaseUv=hMainUv;
      vec3 hGeoNormal=normal,hView=normalize(vViewPosition);
      vec4 hN=vec4(0.5,0.5,1.0,1.0),hMix=vec4(1.0,1.0,0.0,0.0);
      float hFlow=0.0,hStars=0.0;
      vec3 hMeteor=vec3(0.0);
      `+(useNormal?`
      hN=texture2D(hTex1,hMainUv);
      vec3 hLocalN=hN.xyz*2.0-1.0;
      hLocalN.z=sqrt(clamp(1.0-dot(hLocalN.xy,hLocalN.xy),0.0,1.0));hLocalN.xy*=${i[0].toFixed(8)};
      normal=normalize(tbn*normalize(hLocalN));
      vec3 hTangentView=vec3(dot(tbn[0],hView),dot(tbn[1],hView),dot(tbn[2],hView));
      `+(inner?`
      hFlow=pow(0.5,${f('FlowColPow')});
      vec2 hMixUv=hMainUv-(clamp(hTangentView.xy*0.02*${f('EmisDepthStr')},vec2(-0.01),vec2(0.01))
        +vec2(0.5*0.01*${f('EmisNoiseStr')}))*hN.b;
      hMix=texture2D(hTex2,hMixUv);
      hBaseUv=hMainUv-hTangentView.xy*0.002*${f('DiffuseDepthStr')}*hN.b;
      vec2 hStarUv=hMainUv*${f('StarsTiling')};
      hStars=texture2D(hTex3,hStarUv-hTangentView.xy*0.15).b*
        texture2D(hTex3,hStarUv*1.2+vec2(0.0,neoTime*${f('StarsSpeed')})).b;
      vec2 hMeteorUv=mix(hMainUv,hUv1,${f('MeteorUseUV2')})*vec2(1.0,-1.0);
      vec2 hMeteorMaskUv=hMeteorUv*${vec2('MeteorUVScale')};
      float hSeed=floor(hMeteorUv.x*20.0*${v('MeteorUVScale')[0].toFixed(8)})*0.1;
      float hNoiseX=neoSourceNoise(vec2(hSeed)),hNoiseCol=neoSourceNoise(vec2(hSeed+neoTime*0.5));
      hMeteorMaskUv+=vec2(0.0,-1.0)*(neoTime*${f('MeteorSpeed')}+hNoiseX)*mix(0.75,0.1,hNoiseX);
      hMeteor=texture2D(hTex5,hMeteorMaskUv).r*${f('MeteorEmis')}*${rgb('MeteorColor')}*
        hN.a*clamp(hNoiseCol*hNoiseCol,0.0,1.0);
      `:`
      vec4 hNoise=texture2D(hTex3,hMainUv*2.0+vec2(0.0,neoTime*0.1));
      vec2 hFlowUv=hMainUv*${vec2('FlowTiling')}+vec2(0.0,neoTime*0.03)
        -hTangentView.xy*0.51*${f('FlowDepthStr')}+hNoise.rr*0.1*${f('FlowNoiseStr')};
      hFlow=pow(texture2D(hTex3,hFlowUv).a,${f('FlowColPow')});
      hBaseUv=mix(hMainUv,hMainUv+((hNoise.gg-0.5)*0.005-hTangentView.xy*0.001)*
        ${f('DiffuseNoiseStr')}*hN.b,hN.a);
      `):'')+`
      vec4 hBase=texture2D(hTex0,hBaseUv);hBase.rgb=hLinear(hBase.rgb);
      `+(!low&&!inner?`
      hBase.rgb*=mix(1.0,clamp(${f('FlowLightnessOffset')}+hFlow,0.0,${f('FlowLightnessMaxClamp')}),hN.a);
      hMix=texture2D(hTex2,hMainUv);
      `:'')+(Number(macros.CHAR_CHANGE_COLOR)===1?
        'hBase.rgb=dot(hBase.rgb,vec3(.2125,.7154,.0721))*hLinear('+rgb('BaseColor')+')*'+f('TintValue')+';':
        'hBase.rgb*='+f('TintValue')+';')+(!low&&inner?
        'hBase.rgb*=clamp('+f('FlowLightnessOffset')+'+hFlow,0.0,'+f('FlowLightnessMaxClamp')+');':'')+`
      diffuseColor.rgb=hBase.rgb;diffuseColor.a=${inner?'opacity':'hBase.a*opacity'};
      roughnessFactor=clamp(hMix.g*${i[1].toFixed(8)},0.0,1.0);
      metalnessFactor=clamp(hMix.b*${i[2].toFixed(8)},0.0,1.0);
    `);
    // Alpha is calculated after normal-dependent UV displacement.
    s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>','');
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      #include <alphatest_fragment>
      float hF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(normal,hView),5.0),0.0,1.0);
      vec3 hBaseEmission=mix(vec3(hMix.a),hMix.a*hBase.rgb,${f('BaseEmissiveKey')})*
        hLinear(${rgb('EmissiveColor')})*${f('EmissiveValue')};
      totalEmissiveRadiance=hF*${rgb('RimColor')}*${i[3].toFixed(8)}+hBaseEmission;
      `+(low?'':inner?`
      totalEmissiveRadiance+=hBase.rgb*(${f('FlowColStr')}+${f('AddEmisStr')}*hBase.a*${rgb('AddEmisColor')});
      totalEmissiveRadiance+=${rgb('StarsColor')}*${f('StarsColStr')}*hStars*200.0*hMix.a+hMeteor;
      `:`
      vec2 hCapUv=normal.xy*0.5+0.5;hCapUv.y*=-1.0;
      vec3 hCap=hLinear(texture2D(hTex4,hCapUv).rgb)*hBase.rgb*hMix.r;
      float hCapF=1.0-clamp(pow(clamp(dot(hView,hGeoNormal)-${f('FRScale')},0.0,1.0),${f('FRPow')})*2.0,0.0,1.0);
      totalEmissiveRadiance+=hMix.r*hCap*hCapF*${f('MatcapStr')}+hBase.rgb*${f('FlowColStr')}*hN.a
        +hLinear(texture2D(hTex5,hCapUv).rgb)*hN.a*${f('AddMatcapStr')};
      `)+`
      totalEmissiveRadiance*=neoEmissionScale;
    `);
  };
  return uniforms;
}
