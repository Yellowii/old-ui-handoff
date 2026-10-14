// char_xln_hair: UV1 color/waves, UV0 normal/base texture, world-view sparkle.
export async function configureHair(m,p,macros,load,warnings,overrides={}){
  const f=(k,d=0)=>(Number.isFinite(Number(p[k]))?Number(p[k]):d).toFixed(8);
  const vec=(k,d)=>{try{const v=JSON.parse(p[k]);if(Array.isArray(v)&&v.length===4&&v.every(Number.isFinite))return v;}catch{}return d;};
  const rgb=(k,d=[0,0,0,0])=>`vec3(${vec(k,d).slice(0,3).map(v=>v.toFixed(8)).join(',')})`;
  const intensity=vec('Intensity',[1,1,1,0]),base=vec('BaseColor',[1,1,1,1]);
  const low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const textures={};for(const key of ['Tex0','Tex1','Tex3','Tex4','Tex5','Tex6'])textures[key]=await load(key,false,key==='Tex1'?overrides.normal:undefined);
  const sample=(key,uv)=>textures[key]?`texture2D(neoHair${key},${uv})`:key==='Tex0'?'vec4(0.0,1.0,0.0,1.0)':key==='Tex1'?'vec4(.5,.5,1.0,1.0)':'vec4(1.0)';
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1}};
  for(const [key,t] of Object.entries(textures))uniforms['neoHair'+key]={value:t};
  m.defines={...m.defines,USE_UV1:''};m.color.set(0xffffff);m.map=textures.Tex6;
  m.normalMap=low||Number(macros.LIGHT_ENABLE)===0?null:textures.Tex1;
  m.normalScale.setScalar(intensity[0]);m.roughness=.5;m.metalness=0;m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    const varying='varying vec2 neoHairUv;varying vec2 neoHairUv1;\n';
    shader.vertexShader=varying+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoHairUv=uv;neoHairUv1=uv1;');
    shader.fragmentShader=varying+Object.keys(textures).map(k=>`uniform sampler2D neoHair${k};`).join('\n')+`
      uniform float neoTime;uniform float neoEmissionScale;
      vec3 neoHairLinear(vec3 c){return ${Number(macros.RENDER_QUALITY??0)>=2?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 neoHairMask=${sample('Tex0','neoHairUv1')};
      vec4 neoHairN=${sample('Tex1',`neoHairUv*${f('NormalTiling',1)}`)};
      vec4 neoHairD=${sample('Tex6','neoHairUv')};
      vec2 neoHairNoiseUv=neoHairUv1*vec2(${f('noiseTex_UTiling',1)},${f('noiseTex_VTiling',1)})+neoTime*vec2(${f('noiseTex_USpeed')},${f('noiseTex_VSpeed')});
      float neoHairNoise=${sample('Tex3','neoHairNoiseUv')}.b*${f('noiseTex_Strength',1)};
      vec2 neoHairStarNoiseUv=neoHairUv1*vec2(${f('Star_NUTiling',1)},${f('Star_NVTiling',1)})+neoTime*vec2(${f('Star_NUSpeed')},${f('Star_NVSpeed')});
      float neoHairStarNoise=${sample('Tex3','neoHairStarNoiseUv')}.b*${f('Star_NStrength',1)};
      vec2 neoHairStarUv=neoHairUv1*vec2(${f('Star_UTiling',1)},${f('Star_VTiling',1)})+vec2(0.0,neoTime*${f('Star_Speed')})+neoHairStarNoise;
      float neoHairStar=${sample('Tex3','neoHairStarUv')}.a;
      vec2 neoHairWaveUv=neoHairUv1*vec2(1.0,${f('mainTex_VTiling',1)})+vec2(0.0,neoTime*${f('mainTex_Speed')})+neoHairNoise*.5;
      vec4 neoHairWave=${sample('Tex4','neoHairWaveUv')};
      vec2 neoHairBottomUv=neoHairUv1+vec2(0.0,${f('waveTexOffset',-.1)})+neoHairNoise;
      vec4 neoHairBottom=${sample('Tex4','neoHairBottomUv')};
      vec3 neoHairColor=neoHairLinear(mix(${rgb('highColor')},${rgb('lowColor')},pow(neoHairUv1.y,${f('xlnhairPow',1)})))*${f('Switch_Color')};
      neoHairColor+=neoHairLinear(neoHairD.rgb)*${f('Switch_Tex')};
      neoHairColor=mix(neoHairColor,neoHairBottom.rgb*neoHairBottom.rgb,neoHairBottom.a*${f('Switch_BottomWave')});
      neoHairColor=mix(neoHairColor,neoHairWave.rgb*neoHairWave.rgb,neoHairWave.a*${f('Switch_Wave')});
      neoHairColor+=vec3(neoHairStar*20.0*${f('RandomStarMult',1)}*(1.0-pow(neoHairUv1.y,${f('WholeVPower',1)})));
      // Viewer maps NeoX world to Three with world.scale.x=-1; undo it for this source-world sample.
      vec3 neoHairWorldView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0);
      vec2 neoHairViewStarUv=neoHairUv*${f('DotScale',2.5)}+neoHairWorldView.xy*.04;
      vec4 neoHairViewStar=${sample('Tex5','neoHairViewStarUv')};
      vec2 neoHairTimedStarUv=neoHairUv*${f('DotScale',2.5)}+neoTime*vec2(.003,.002);
      vec4 neoHairTimedStar=${sample('Tex5','neoHairTimedStarUv')};
      neoHairColor+=neoHairViewStar.rgb*neoHairTimedStar.a*neoHairViewStar.a*3500.0*${f('ViewStarMult')};
      ${change?`vec3 neoHairLuma=vec3(dot(neoHairColor,vec3(.2125,.7154,.0721)))*${rgb('BaseColor',[1,1,1,1])};
      diffuseColor.rgb=neoHairLinear(${low?'neoHairLuma':'mix(neoHairColor,neoHairLuma,neoHairN.a)'})*${f('TintValue',1)};`:`diffuseColor.rgb=neoHairColor*${f('TintValue',1)};`}
      diffuseColor.a=${base[3].toFixed(8)}*opacity;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #ifdef USE_NORMALMAP_TANGENTSPACE
      vec3 neoHairLocalNormal=neoHairN.xyz*2.0-1.0;neoHairLocalNormal.xy*=${intensity[0].toFixed(8)};
      normal=normalize(tbn*normalize(neoHairLocalNormal));
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      float neoHairDot=dot(normal,normalize(vViewPosition));
      float neoHairFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-neoHairDot,5.0),0.0,1.0);
      ${change?`float neoHairFresnel01=clamp(.001+.25*pow(1.0-neoHairDot,3.0),0.0,50.0);
      totalEmissiveRadiance=(neoHairFresnel01*neoHairLinear(vec3(neoHairMask.r*3.0))*15.0*neoHairMask.a*${rgb('BaseColor',[1,1,1,1])}+neoHairFresnel*${rgb('RimColor')}*${intensity[3].toFixed(8)})*${f('TintValue',1)};`:`totalEmissiveRadiance=neoHairFresnel*(${rgb('RimColor')}*${intensity[3].toFixed(8)}+${rgb('hairRimColor')}*${f('hairRimStrength')});`}
      totalEmissiveRadiance*=neoEmissionScale;
    `);
  };
  warnings.push('头发源渐变、波纹、星点与边缘发光已接入；源切线法线、软体及场景光照尚未完整还原');
  return uniforms;
}
