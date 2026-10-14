// Source: plastic_iridescent_t.hlsl. Raw textures use the source quality gamma.
export async function configureIridescent(m,p,macros,load,warnings){
  const f=(k,d=0)=>(Number.isFinite(Number(p[k]))?Number(p[k]):d).toFixed(8);
  const v=(k,d)=>{try{const a=JSON.parse(p[k]);if(Array.isArray(a)&&a.length===d.length&&a.every(Number.isFinite))return a;}catch{}return d;};
  const rgb=(k,d)=>`vec3(${v(k,d).slice(0,3).map(x=>x.toFixed(8)).join(',')})`;
  const intensity=v('Intensity',[1,1,1,0]),low=Number(macros.RENDER_QUALITY)>=2;
  const normalEnabled=Number(macros.NORMAL_MAP_ENABLE)!==0;
  const al=await load('Tex0'),nm=await load('Tex1'),cap=await load('Tex2');
  if(!al||!cap||(!low&&!nm))return null;
  m.map=al;m.normalMap=!low&&normalEnabled?nm:null;m.normalScale.setScalar(intensity[0]);
  m.color.set(0xffffff);m.roughness=.5;m.metalness=0;m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoIriAlbedo:{value:al},neoIriNormal:{value:nm},neoIriMatcap:{value:cap},neoEmissionScale:{value:1}};
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.fragmentShader=`uniform sampler2D neoIriAlbedo,neoIriNormal,neoIriMatcap;
      uniform float neoEmissionScale;
      vec3 neoIriLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec4 iriTex0=texture2D(neoIriAlbedo,vMapUv);
      diffuseColor.a=clamp(iriTex0.a+${f('OpacityAmount')},0.0,1.0)*opacity;
    `);
    // MatCap needs the normal computed later than Three's map_fragment chunk.
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 iriRawNormal=normal;
      ${low?'':`vec3 iriLocal=texture2D(neoIriNormal,vMapUv).xyz*2.0-1.0;
      iriLocal.xy*=${intensity[0].toFixed(8)};
      iriRawNormal=${normalEnabled?'normalize(tbn*normalize(iriLocal))':'normalize(mat3(viewMatrix)*(normalize(iriLocal)*vec3(-1.0,1.0,1.0)))'};`}
      ${Number(macros.LIGHT_ENABLE)!==0?'normal=iriRawNormal;':''}
      vec3 iriView=normalize(vViewPosition);
      vec3 iriT=cross(iriView,vec3(0.0,1.0,0.0));
      iriT=length(iriT)>0.000001?normalize(iriT):vec3(1.0,0.0,0.0);
      vec3 iriB=normalize(cross(iriView,iriT));
      vec2 iriUv=vec2(dot(iriRawNormal,iriT),dot(iriRawNormal,iriB))*.5+.5;
      iriUv.y=1.0-iriUv.y;
      vec3 iriCol=neoIriLinear(texture2D(neoIriMatcap,iriUv).rgb)*${f('IridescentAmount')}+${f('Lightness')};
      vec3 iriFinal=mix(iriCol,neoIriLinear(iriTex0.rgb),iriTex0.a);
      ${Number(macros.CHAR_CHANGE_COLOR)===1?`iriFinal=vec3(dot(iriFinal,vec3(.2125,.7154,.0721)))*${rgb('BaseColor',[1,1,1,1])};`:''}
      diffuseColor.rgb=iriFinal*${f('TintValue',1)};
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      float iriF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(normal,normalize(vViewPosition)),5.0),0.0,1.0);
      totalEmissiveRadiance=iriF*${rgb('RimColor',[0,0,0,0])}*${intensity[3].toFixed(8)}*neoEmissionScale;
    `);
  };
  warnings.push('虹彩主通道已转写；当前使用 Three 光照，源切线与原场景光照仍需对照');
  return uniforms;
}
