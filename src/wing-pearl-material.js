// anglel_wing_pearl: source matcap pair, normal, diffuse and parallax sparkle.
export async function configureWingPearl(m,p,macros,load,warnings,overrides={}){
  const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
  const f=(k,d=0)=>n(k,d).toFixed(8);
  const vec=(k,d)=>{try{const v=JSON.parse(p[k]);if(Array.isArray(v)&&v.length===4&&v.every(Number.isFinite))return v;}catch{}return d;};
  const rgb=(k,d=[1,1,1,1])=>`vec3(${vec(k,d).slice(0,3).map(v=>v.toFixed(8)).join(',')})`;
  const base=vec('BaseColor',[1,1,1,1]),intensity=vec('Intensity',[1,1,1,0]);
  const low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const cap=await load('Tex0',true),normal=await load('Tex1',false,overrides.normal),capB=await load('Tex2',true),diffuse=await load('Tex3');
  const uniforms={neoWingPearlCap:{value:cap},neoWingPearlNormal:{value:normal},neoWingPearlCapB:{value:capB},neoWingPearlDiffuse:{value:diffuse},neoTime:{value:0},neoEmissionScale:{value:1}};
  m.map=diffuse;m.normalMap=low?null:normal;m.normalScale.setScalar(intensity[0]);m.roughness=1;m.metalness=0;m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 neoWingPearlUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoWingPearlUv=uv;');
    shader.fragmentShader='varying vec2 neoWingPearlUv;\nuniform sampler2D neoWingPearlCap,neoWingPearlNormal,neoWingPearlCapB,neoWingPearlDiffuse;uniform float neoTime,neoEmissionScale;\nvec3 neoWingPearlLinear(vec3 c){return '+(low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))')+';}\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec4 neoWingPearlD=texture2D(neoWingPearlDiffuse,neoFaceUv(neoWingPearlUv));
      diffuseColor.rgb=neoWingPearlLinear(${change?'vec3(dot(neoWingPearlD.rgb,vec3(.2125,.7154,.0721)))*'+rgb('BaseColor'):'neoWingPearlD.rgb*'+rgb('BaseColor')})*${f('TintValue',1)};
      diffuseColor.a=neoWingPearlD.a*${base[3].toFixed(8)}*opacity;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      ${low?'':'vec3 neoWingPearlN=texture2D(neoWingPearlNormal,neoFaceUv(neoWingPearlUv)).xyz*2.0-1.0;neoWingPearlN.xy*='+intensity[0].toFixed(8)+';normal=normalize(tbn*normalize(neoWingPearlN));'}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      vec3 neoWingPearlView=normalize(vViewPosition);float neoWingPearlNdV=dot(normal,neoWingPearlView);
      vec2 neoWingPearlMatUv=vec2(normal.x*.5+.5,1.0-(normal.y*.5+.5));
      vec3 neoWingPearlA=neoWingPearlLinear(texture2D(neoWingPearlCap,neoWingPearlMatUv).rgb);
      vec3 neoWingPearlB=neoWingPearlLinear(texture2D(neoWingPearlCapB,neoWingPearlMatUv).rgb);
      float neoWingPearlSpark=texture2D(neoWingPearlDiffuse,neoFaceUv(neoWingPearlUv)*10.0).a*texture2D(neoWingPearlDiffuse,neoFaceUv(neoWingPearlUv)*14.0).a*${f('SparkleIntensity',1)};
      float neoWingPearlRef=${f('Reflection')}*mix(1.0,smoothstep(0.0,.5,saturate(1.0-neoWingPearlNdV)),${f('RefFresnel')});
      vec3 neoWingPearlFinal=mix(neoWingPearlA,saturate(neoWingPearlA*neoWingPearlSpark*3.0)*neoWingPearlD.r,neoWingPearlSpark);
      neoWingPearlFinal=mix(neoWingPearlFinal,neoWingPearlB,neoWingPearlRef)*${f('Lightness',2)}*neoWingPearlD.rgb+texture2D(neoWingPearlCap,neoWingPearlMatUv).a*${f('Highlight')}*${rgb('HighlightColor')};
      float neoWingPearlF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-neoWingPearlNdV,5.0),0.0,1.0);
      totalEmissiveRadiance=(neoWingPearlFinal*${f('TintValue',1)}+neoWingPearlF*${rgb('RimColor',[0,0,0,0])}*${intensity[3].toFixed(8)})*neoEmissionScale;
    `);
  };
  warnings.push('anglel_wing_pearl 的双 Matcap、法线、Diff、闪点、Reflection、透明与 Fresnel 已接入；源阴影和场景光照仍待校准');
  return uniforms;
}
