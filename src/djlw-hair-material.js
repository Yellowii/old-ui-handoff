import {sourceValueNoise} from './source-value-noise.js';

export async function configureDjlwHair(m,p,macros,load,warnings,overrides={}){
  const low=Number(macros.RENDER_QUALITY)>=2;
  const useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const f=k=>Number(p[k]).toFixed(8);
  const v=k=>{try{return JSON.parse(p[k]);}catch{return null;}};
  const scalarKeys=['VertexOff','FlowSpeed1','FlowSpeed2','TintValue','FresPow1','FresPow2',
    'FresIntensity','FresIntensity2','FresInnerInt','FresEmisInt','BaseColEnable',
    'MatCapIntensity','FresnelScale'];
  const vectorKeys=['Intensity','BaseColor','EmColorA','EmColorB','EmColorC','RimColor','MatCapColor'];
  if(scalarKeys.some(k=>p[k]===undefined||!Number.isFinite(Number(p[k])))||
    vectorKeys.some(k=>!Array.isArray(v(k))||v(k).length!==4||!v(k).every(Number.isFinite))){
    warnings.push('djlw_hair: 缺少已验证源参数');return null;
  }
  const displacement=!low&&Number(p.VertexOff)!==0;
  if(displacement&&(overrides.sourceSecondUv!==true||overrides.sourceVertexColors!==true)){
    warnings.push('djlw_hair: 活跃源位移缺少第二 UV 或顶点色');return null;
  }
  const keys=['Tex0',...(!low?['Tex2','Tex3','Tex4']:[]),...(useNormal?['Tex1']:[])];
  const maps={};for(const k of keys)maps[k]=await load(k,false);
  const missing=keys.filter(k=>!maps[k]);
  if(missing.length){warnings.push('djlw_hair: 源贴图未就绪 '+missing.join(', '));return null;}
  const rgb=k=>'vec3('+v(k).slice(0,3).map(x=>x.toFixed(8)).join(',')+')',i=v('Intensity');
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1}};
  for(const k of ['Tex0','Tex1','Tex2','Tex3','Tex4'])uniforms['d'+k]={value:maps[k]||null};
  m.map=maps.Tex0;m.normalMap=useNormal?maps.Tex1:null;
  m.normalScale.setScalar(i[0]);m.roughness=i[1];m.metalness=i[2];
  m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.vertexColors=displacement;
  if(displacement)m.defines={...m.defines,USE_UV1:''};
  m.userData.fidelity='source-channels-preview';
  m.userData.fidelityGaps=['原场景光照未等价还原；local_pos 暂取模型局部位置，蒙皮阶段映射仍待源引擎核验',
    ...(useNormal&&!overrides.sourceTangents?['无源切线时使用导数 TBN']:[])];
  warnings.push('djlw_hair: '+m.userData.fidelityGaps.join('；'));
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    const varying='varying vec2 dUv; varying vec3 dLocalPos;\n';
    s.vertexShader=varying+'uniform float neoTime;\n'+(low?'':sourceValueNoise)+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ndUv=uv;');
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      `+(displacement?`
      float dNoise=clamp(neoSourceNoise(uv1*3.0+vec2(neoTime*6.0)),0.0,1.0)*0.1;
      vec3 dRotation=vec3(0.03*sin(neoTime*5.0),0.0,0.05*cos(neoTime*5.0));
      vec3 dMask=vec3(sin(transformed.x*4.0+neoTime*5.0)*0.03,0.0,0.0);
      transformed+=(dRotation+dMask+vec3(dNoise))*color.r*${f('VertexOff')};
      `:'')+'\ndLocalPos=transformed;');
    s.fragmentShader=varying+`
      uniform sampler2D dTex0,dTex1,dTex2,dTex3,dTex4;
      uniform float neoTime,neoEmissionScale;
      vec3 dLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+(low?'':sourceValueNoise)+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec4 dBase=texture2D(dTex0,dUv);dBase.rgb=dLinear(dBase.rgb);
      ${Number(macros.CHAR_CHANGE_COLOR)===1?
        'dBase.rgb=dot(dBase.rgb,vec3(.2125,.7154,.0721))*'+rgb('BaseColor')+'*'+f('TintValue')+';':
        'dBase.rgb*='+f('TintValue')+';'}
      vec4 dMix=${low?'vec4(1.0,1.0,0.0,0.0)':'texture2D(dTex2,dUv)'};
      diffuseColor.a=opacity;
    `);
    // Vertex color is a displacement mask, not a diffuse/alpha multiplier.
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','');
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',
      'float roughnessFactor=clamp(dMix.g*'+i[1].toFixed(8)+',0.0,1.0);');
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>',
      'float metalnessFactor=clamp(dMix.b*'+i[2].toFixed(8)+',0.0,1.0);');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 dGeoNormal=normal,dView=normalize(vViewPosition);
      `+(useNormal?`
      vec3 dN=texture2D(dTex1,dUv).xyz*2.0-1.0;dN.xy*=${i[0].toFixed(8)};
      normal=normalize(tbn*normalize(dN));
      `:'')+`
      vec3 dEmission=dBase.rgb,dMatcap=vec3(0.0);
      `+(low?'':`
      float dFlow=texture2D(dTex3,dUv*vec2(6.0,3.0)+vec2(0.0,neoTime*${f('FlowSpeed1')})).r;
      float dNoiseMask=clamp(neoSourceNoise(dLocalPos.xy*3.0+vec2(0.0,neoTime*${f('FlowSpeed2')})),0.0,1.0)*2.0;
      float dDot=dot(dView,dGeoNormal);
      float dEmfr=clamp(pow(max(dDot-0.5,0.0),${f('FresPow1')})*2.0,0.0,1.0);
      vec3 dFire=mix(${rgb('EmColorB')}*${f('FresIntensity')}*dFlow,
        ${rgb('EmColorA')}*${f('FresInnerInt')},dEmfr*dNoiseMask*3.0);
      float dEmfrB=clamp(pow(max(dDot-0.3,0.0),${f('FresPow2')})*1.5,0.0,1.0);
      dEmission=mix(${rgb('EmColorC')}*${f('FresIntensity2')},dFire,dEmfrB);
      vec3 dTangent=normalize(cross(dView,vec3(0.0,1.0,0.0)));
      vec3 dBinormal=normalize(cross(dView,dTangent));
      vec2 dCapUv=vec2(dot(dGeoNormal,dTangent),dot(dGeoNormal,dBinormal))*0.5+0.5;
      dCapUv.y=1.0-dCapUv.y;
      dMatcap=dLinear(texture2D(dTex4,dCapUv).rgb)*${rgb('MatCapColor')}*${f('MatCapIntensity')};
      `)+`
      diffuseColor.rgb=mix(dBase.rgb,vec3(0.0),${f('BaseColEnable')})+dMatcap+dEmission;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      float dFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(normal,dView),5.0),0.0,1.0);
      totalEmissiveRadiance=(dFresnel*${rgb('RimColor')}*${i[3].toFixed(8)}
        +dEmission*${f('FresEmisInt')}+dMatcap)*neoEmissionScale;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',`
      reflectedLight.indirectDiffuse*=dMix.r;
      #if defined(USE_ENVMAP) && defined(STANDARD)
      reflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),dMix.r,material.roughness);
      #endif
    `);
  };
  return uniforms;
}
