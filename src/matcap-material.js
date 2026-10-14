// Android matcap_common.surf/.hlsl. Texture samples stay raw until source conversion.
export async function configureMatcap(m,p,macros,load,warnings,overrides={},variant=false){
  const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
  const f=(k,d=0)=>n(k,d).toFixed(8);
  const v=(k,d)=>{try{const a=JSON.parse(p[k]);if(Array.isArray(a)&&a.length===4&&a.every(Number.isFinite))return a;}catch{}return d;};
  const rgb=(k,d=[1,1,1,1])=>`vec3(${v(k,d).slice(0,3).map(x=>x.toFixed(8)).join(',')})`;
  const variable=v('Variable',[1,0,0,0]),intensity=v('Intensity',[0,0,0,0]);
  const low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const cap=await load('Tex0'),normalMap=await load('Tex1',false,overrides.normal),albedo=await load('Tex2',false,overrides.baseColor);
  const builtins={normal:'vec4(.5,.5,1.0,1.0)',white:'vec4(1.0)',black:'vec4(0.0,0.0,0.0,1.0)'};
  const sample=(key,t,uniform,uv,fallback)=>{
    if(t)return `texture2D(${uniform},${uv})`;
    const name=p[key]||fallback;
    if(!builtins[name])warnings.push(`Matcap 贴图未绑定：${key} (${name})`);
    return builtins[name]||builtins[fallback];
  };
  m.map=variant&&!low?null:albedo;m.normalMap=Number(macros.NORMAL_MAP_ENABLE)===0||(variant&&low)?null:normalMap;
  m.normalScale.setScalar(variable[0]);m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoMatcap:{value:cap},neoMatcapNormal:{value:normalMap},neoMatcapAlbedo:{value:albedo},neoEmissionScale:{value:1}};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 neoMatcapUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoMatcapUv=uv;');
    shader.fragmentShader=`varying vec2 neoMatcapUv;
      uniform sampler2D neoMatcap;uniform sampler2D neoMatcapNormal;uniform sampler2D neoMatcapAlbedo;
      uniform float neoEmissionScale;
      vec3 neoMatcapLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 neoMatcapN=${variant&&low?'vec4(0.0)':sample('Tex1',normalMap,'neoMatcapNormal','neoMatcapUv','normal')};
      vec4 neoMatcapD=${variant&&!low?'vec4(0.0)':sample('Tex2',albedo,'neoMatcapAlbedo','neoMatcapUv','white')};
      float neoMatcapMask=mix(1.0,step(.25,neoMatcapUv.y),${f('AdaptValue',1)});
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 neoCapNormal=normal;
      ${Number(macros.NORMAL_MAP_ENABLE)===0?`neoCapNormal=mat3(viewMatrix)*normalize(vec3((neoMatcapN.xy*2.0-1.0)*${variable[0].toFixed(8)},neoMatcapN.z*2.0-1.0));`:''}
      vec3 neoCapView=normalize(vViewPosition)*vec3(1.0,1.0,-1.0);
      vec3 neoCapN=neoCapNormal*vec3(1.0,1.0,-1.0);
      vec3 neoCapT=normalize(cross(neoCapView,vec3(0.0,1.0,0.0)));
      vec3 neoCapB=normalize(cross(neoCapView,neoCapT));
      vec2 neoCapUv=vec2(dot(neoCapN,neoCapT),dot(neoCapN,neoCapB))*.5+.5;
      vec4 neoMatcapC=${variant&&low?'vec4(0.0)':sample('Tex0',cap,'neoMatcap','neoCapUv','normal')};
      ${low?'normal=nonPerturbedNormal;':''}
      diffuseColor.rgb=${change?`neoMatcapLinear(vec3(dot(neoMatcapC.rgb,vec3(.2125,.7154,.0721)))*${rgb('BaseColor')})`:`mix(neoMatcapLinear(neoMatcapC.rgb*${rgb('BaseColor')})*neoMatcapMask*${low?'1.2':'1.0'},neoMatcapLinear(neoMatcapD.rgb),neoMatcapD.a)`}*${f('TintValue',1)};
      diffuseColor.a=max(neoMatcapC.a,${f('AlphaValue',1)})*opacity;
      ${variant?`
      diffuseColor.rgb=${change?`neoMatcapLinear(vec3(dot(neoMatcapLinear(neoMatcapD.rgb),vec3(.2125,.7154,.0721)))*${rgb('BaseColor')})`:low?'neoMatcapLinear(neoMatcapD.rgb)':`neoMatcapLinear(neoMatcapC.rgb*${rgb('BaseColor')})*(1.0+${variable[3].toFixed(8)})*mix(1.0,${f('Ag_lerpMult',1)},pow(neoMatcapN.a,${f('Ag_lerpPow',1)}))`}*${f('TintValue',1)};
      diffuseColor.a=opacity;`:''}
      roughnessFactor=${low?'.5':`mix(1.0,${variable[1].toFixed(8)},neoMatcapMask)`};
      metalnessFactor=${low?'0.0':`mix(0.0,${variable[2].toFixed(8)},neoMatcapMask)`};
      #include <alphatest_fragment>
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      float neoCapF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(normal,normalize(vViewPosition)),5.0),0.0,1.0);
      ${variant?`totalEmissiveRadiance=neoCapF*${rgb('RimColor',[0,0,0,0])}*${intensity[3].toFixed(8)}*neoEmissionScale;`:`totalEmissiveRadiance=(neoMatcapLinear(${rgb('EmissiveColor')})*neoMatcapD.a*${f('Emissive',1)}
        +neoCapF*${rgb('RimColor',[0,0,0,0])}*${intensity[3].toFixed(8)}
        ${change?'':`+neoMatcapLinear(neoMatcapC.rgb)*neoMatcapN.a*${variable[3].toFixed(8)}*${f('TintValue',1)}`})*neoEmissionScale;`}
    `);
  };
  warnings.push('Matcap 分区、染色、透明与发光按源公式接入；原场景光照与非标准 BRDF 尚未还原');
  return uniforms;
}
