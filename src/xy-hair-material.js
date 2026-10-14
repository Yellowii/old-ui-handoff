// standard_xy_hair.hlsl: all five inputs use UV0, even when TEXCOORD1 is enabled.
export async function configureXyHair(m,p,macros,load,warnings){
  const f=(k,d=0)=>(Number.isFinite(Number(p[k]))?Number(p[k]):d).toFixed(8);
  const v=(k,d)=>{try{const a=JSON.parse(p[k]);if(Array.isArray(a)&&a.length===d.length&&a.every(Number.isFinite))return a;}catch{}return d;};
  const rgb=(k,d)=>`vec3(${v(k,d).slice(0,3).map(x=>x.toFixed(8)).join(',')})`;
  const low=Number(macros.RENDER_QUALITY)===2;
  const useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0&&Number(macros.LIGHT_ENABLE)!==0;
  const maps={};for(const key of ['Tex0','Tex1','Tex2','Tex3','Tex4'])maps[key]=await load(key);
  const required=['Tex0','Tex2','Tex3','Tex4',...(useNormal?['Tex1']:[])];
  const missing=required.filter(k=>!maps[k]);
  if(missing.length){warnings.push(`XY Hair 源输入未就绪：${missing.join(', ')}；未用其他贴图替代`);return null;}
  const base=v('BaseColor',[1,1,1,1]),i=v('Intensity',[1,1,1,0]);
  m.map=maps.Tex0;m.normalMap=useNormal?maps.Tex1:null;m.normalScale.setScalar(i[0]);
  m.roughness=low?.5:i[1];m.metalness=low?0:i[2];m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1}};
  for(const [key,texture] of Object.entries(maps))uniforms['neoXy'+key]={value:texture};
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='varying vec2 neoXyUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoXyUv=uv;');
    s.fragmentShader=`varying vec2 neoXyUv;
      uniform sampler2D neoXyTex0,neoXyTex1,neoXyTex2,neoXyTex3,neoXyTex4;
      uniform float neoTime,neoEmissionScale;
      vec3 neoXyLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec4 xyBase=texture2D(neoXyTex0,neoXyUv);
      vec4 xyMix=texture2D(neoXyTex2,neoXyUv);
      vec3 xyAlbedo=${Number(macros.CHAR_CHANGE_COLOR)===1?'vec3(dot(xyBase.rgb,vec3(.2125,.7154,.0721)))':'xyBase.rgb'};
      diffuseColor.rgb=neoXyLinear(xyAlbedo*${rgb('BaseColor',[1,1,1,1])})*${f('TintValue',1)};
      diffuseColor.a=xyBase.a*${base[3].toFixed(8)}*opacity;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(xyMix.g*${i[1].toFixed(8)},0.0,1.0)`};`);
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(xyMix.b*${i[2].toFixed(8)},0.0,1.0)`};`);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',useNormal?`
      vec3 xyNormal=texture2D(neoXyTex1,neoXyUv).xyz*2.0-1.0;
      xyNormal.xy*=${i[0].toFixed(8)};
      normal=normalize(tbn*normalize(xyNormal));
    `:'');
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      float xyMask=texture2D(neoXyTex3,neoXyUv).r;
      float xyGradient=texture2D(neoXyTex4,neoXyUv+vec2(0.0,-neoTime*.2)).r;
      vec3 xyHair=mix(${rgb('HairColor1',[1,1,1,1])},${rgb('HairColor2',[1,1,1,1])},xyGradient*xyGradient)*clamp(xyMask+.1,0.0,1.0)*6.0;
      float xyFresnel=clamp(${f('FresnelScale')}+pow(max(1.0-dot(normal,normalize(vViewPosition)),0.0),${f('frenelPow',1)}),0.0,1.0);
      totalEmissiveRadiance=(xyFresnel*${rgb('RimColor',[0,0,0,0])}*${i[3].toFixed(8)}+xyMix.a*${rgb('EmissiveColor',[1,1,1,1])}*${f('EmissiveValue',1)}+xyHair)*neoEmissionScale;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',low?'':`
      reflectedLight.indirectDiffuse*=xyMix.r;
      #if defined(USE_ENVMAP) && defined(STANDARD)
      reflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),xyMix.r,material.roughness);
      #endif
    `);
  };
  warnings.push('XY Hair 主 UV、双色流动与源发光公式已接入；源切线、软体和 SmoothDiffuse 光照仍待还原');
  return uniforms;
}
