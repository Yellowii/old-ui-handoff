// standard_char_pearl source texture roles: albedo, normal, ORM, spark, matcap and mask.
export async function configurePearl(m,p,macros,load,warnings,overrides={}){
  const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
  const f=(k,d=0)=>n(k,d).toFixed(8);
  const vec=(k,d)=>{try{const v=JSON.parse(p[k]);if(Array.isArray(v)&&v.length===4&&v.every(Number.isFinite))return v;}catch{}return d;};
  const rgb=(k,d=[1,1,1,1])=>`vec3(${vec(k,d).slice(0,3).map(v=>v.toFixed(8)).join(',')})`;
  const base=vec('BaseColor',[1,1,1,1]),intensity=vec('Intensity',[1,1,1,0]);
  const low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const albedo=await load('Tex0',false,overrides.baseColor),normal=await load('Tex1',false,overrides.normal),orm=await load('Tex2'),spark=await load('Tex3'),mask=await load('Tex5');
  const uniforms={neoPearlAlbedo:{value:albedo},neoPearlNormal:{value:normal},neoPearlOrm:{value:orm},neoPearlSpark:{value:spark},neoPearlMask:{value:mask},neoTime:{value:0},neoEmissionScale:{value:1}};
  m.map=albedo;m.normalMap=low?null:normal;m.normalScale.setScalar(intensity[0]);m.roughness=low?.5:intensity[1];m.metalness=low?0:intensity[2];m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 neoPearlUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoPearlUv=uv;');
    shader.fragmentShader='varying vec2 neoPearlUv;\nuniform sampler2D neoPearlAlbedo,neoPearlOrm,neoPearlSpark,neoPearlMask;uniform float neoTime,neoEmissionScale;vec3 neoPearlLinear(vec3 c){return '+(low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))')+';}\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec4 neoPearlD=${albedo?'texture2D(neoPearlAlbedo,neoFaceUv(neoPearlUv))':'vec4(0.0,1.0,0.0,1.0)'};
      vec4 neoPearlM=${orm?'texture2D(neoPearlOrm,neoFaceUv(neoPearlUv))':'vec4(1.0,1.0,0.0,0.0)'};
      vec4 neoPearlS=${spark?'texture2D(neoPearlSpark,neoFaceUv(neoPearlUv)*'+f('SparkScale',20)+')':'vec4(0.0)'};
      vec4 neoPearlK=${mask?'texture2D(neoPearlMask,neoFaceUv(neoPearlUv))':'vec4(1.0)'};
      vec3 neoPearlBase=${change?'vec3(dot(neoPearlD.rgb,vec3(.2125,.7154,.0721)))*'+rgb('BaseColor'):'neoPearlD.rgb*'+rgb('BaseColor')};
      diffuseColor.rgb=neoPearlLinear(neoPearlBase)*${f('TintValue',1)};diffuseColor.a=neoPearlD.a*${base[3].toFixed(8)}*opacity;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment', '#include <roughnessmap_fragment');
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`float neoPearlNdV=dot(normal,normalize(vViewPosition));float neoPearlF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-neoPearlNdV,5.0),0.0,1.0);float neoPearlSpec=pow(max(neoPearlS.r,0.0),${f('SparkPow',4)})*neoPearlK.r*${f('SparkIntensity',1)};totalEmissiveRadiance=(neoPearlF*${rgb('RimColor',[0,0,0,0])}*${intensity[3].toFixed(8)}+neoPearlM.a*${rgb('EmissiveColor')}*${f('EmissiveValue',1)}+neoPearlSpec*${rgb('SpecularColor')})*neoEmissionScale;`);
  };
  warnings.push('Pearl 源纹理角色、染色、透明、闪点和 Fresnel 已接入；SSS/Matcap 空间仍待校准');return uniforms;
}
